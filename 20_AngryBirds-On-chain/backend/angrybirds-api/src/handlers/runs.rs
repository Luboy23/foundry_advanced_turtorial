use std::sync::Arc;

use angrybirds_core::validate_evidence;
use axum::{
  body::Body,
  extract::State,
  http::{HeaderMap, Response, StatusCode},
  Json,
};
use tracing::info;

  use crate::{
    app_state::AppState,
    db::{
      runs::insert_validated_run_tx,
      sessions::{increment_accepted_run_count_tx, load_session_row, load_session_row_tx},
    },
    errors::{require_request_id, ApiError},
    format_address,
    format_b256,
    idempotency::{execute_idempotent_json, hash_request_bytes},
    models::{UploadRunRequest, UploadRunResponse, SESSION_STATUS_ACTIVE, SESSION_STATUS_CONFIRMED},
    now_ms,
  };

fn ensure_session_accepts_runs(
  session: &crate::models::SessionRow,
  now_seconds: u64,
) -> Result<(), ApiError> {
  // 会话尚未激活（缺少 permit 签名）时，不允许上传 run。
  if session.permit_signature.is_none() {
    return Err(ApiError::new(
      StatusCode::CONFLICT,
      "session must be activated before uploading runs",
    ));
  }
  if !matches!(session.status.as_str(), SESSION_STATUS_ACTIVE | SESSION_STATUS_CONFIRMED)
    || session.finalize_requested_at_ms.is_some()
  {
    // 进入 finalize 流程后需要冻结写入，避免链下链上状态不一致。
    return Err(ApiError::new(
      StatusCode::CONFLICT,
      "session is finalizing and cannot accept more runs",
    ));
  }
  // permit 过期后直接拒绝，防止旧会话被继续写入。
  if now_seconds > session.permit.deadline {
    return Err(ApiError::new(StatusCode::GONE, "session permit expired"));
  }
  // 达到 max_runs 上限后拒绝新增 run。
  if session.accepted_run_count >= i64::from(session.permit.max_runs) {
    return Err(ApiError::new(
      StatusCode::CONFLICT,
      "session maxRuns exceeded",
    ));
  }

  Ok(())
}

/// 上传单条 run 证据并写入数据库。
/// 流程：请求幂等 -> 会话校验 -> 链上关卡哈希校验 -> 事务内抢占 run 配额 -> 入库。
pub async fn upload_run(
  State(state): State<Arc<AppState>>,
  headers: HeaderMap,
  Json(request): Json<UploadRunRequest>,
) -> Result<Response<Body>, ApiError> {
  let request_id = require_request_id(&headers)?;
  let request_hash =
    hash_request_bytes(&serde_json::to_vec(&request).map_err(ApiError::internal)?);
  let state_for_operation = state.clone();

  execute_idempotent_json(
    &state.db,
    "upload_run",
    &request_id,
    &request_hash,
    move || async move {
      // 先做一次事务外读取，快速失败无效会话请求。
      let session = load_session_row(
        &state_for_operation.db,
        request.session_id,
        request.player,
        &state_for_operation.config.deployment_id,
      )
      .await
      .map_err(ApiError::internal)?
      .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "session not found"))?;

      let now_seconds = now_ms() / 1_000;
      ensure_session_accepts_runs(&session, now_seconds)?;

      // 从链上读取关卡 content hash，确保客户端提交的证据基于正确关卡版本。
      let level_content_hash = state_for_operation
        .chain_client
        .fetch_level_content_hash(&request.evidence.level_id, request.evidence.level_version)
        .await
        .map_err(ApiError::internal)?;
      // 证据结构、时序和哈希规则校验在 core 库统一完成。
      let validated = validate_evidence(&request.evidence, request.session_id, level_content_hash)
        .map_err(|error| ApiError::new(StatusCode::UNPROCESSABLE_ENTITY, error.to_string()))?;

      let received_at_ms = now_ms();
      let mut tx = state_for_operation.db.begin().await.map_err(ApiError::internal)?;
      // 事务内再次校验会话状态，避免并发窗口造成越界写入。
      let session_in_tx = load_session_row_tx(
        &mut tx,
        request.session_id,
        request.player,
        &state_for_operation.config.deployment_id,
      )
      .await
      .map_err(ApiError::internal)?
      .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "session not found"))?;

      ensure_session_accepts_runs(&session_in_tx, received_at_ms / 1_000)?;

      // 通过“先占坑再写 run”方式保证并发下不突破 max_runs。
      let reserved_run_slot = increment_accepted_run_count_tx(
        &mut tx,
        request.session_id,
        request.player,
        &state_for_operation.config.deployment_id,
        session_in_tx.permit.max_runs,
        received_at_ms,
      )
      .await
      .map_err(ApiError::internal)?;

      if !reserved_run_slot {
        // 占坑失败时再读一次最新状态，尽量返回更准确的冲突原因。
        let latest_session = load_session_row_tx(
          &mut tx,
          request.session_id,
          request.player,
          &state_for_operation.config.deployment_id,
        )
        .await
        .map_err(ApiError::internal)?
        .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "session not found"))?;
        ensure_session_accepts_runs(&latest_session, received_at_ms / 1_000)?;
        return Err(ApiError::new(
          StatusCode::CONFLICT,
          "session cannot accept more runs right now",
        ));
      }

      // run 入库使用唯一键约束，重复证据会映射为冲突错误。
      insert_validated_run_tx(
        &mut tx,
        request.session_id,
        request.player,
        &request.evidence,
        &validated,
        received_at_ms,
      )
      .await
      .map_err(|_| ApiError::new(StatusCode::CONFLICT, "duplicate run evidence"))?;

      tx.commit().await.map_err(ApiError::internal)?;

      info!(
        session_id = %format_b256(request.session_id),
        player = %format_address(request.player),
        run_id = %format_b256(validated.run_id),
        level_id = request.evidence.level_id,
        level_version = validated.level_version,
        "validated and stored run evidence"
      );

      Ok(UploadRunResponse {
        run: validated,
        status: "validated",
      })
    },
  )
  .await
}

#[cfg(test)]
mod tests {
  use std::sync::Arc;

  use alloy::{primitives::{Address, B256}, rpc::types::{Filter, Log}};
  use anyhow::{anyhow, Result};
  use angrybirds_core::{
    CheckpointEvidence, DestroyEvidence, LaunchEvidence, RunEvidenceV1, RunSummary,
  };
  use async_trait::async_trait;
  use axum::{
    body::{to_bytes, Body},
    extract::State,
    http::{HeaderMap, StatusCode},
    Json,
  };
  use serde_json::Value;
  use sqlx::query;

  use super::upload_run;
  use crate::{
    chain_client::{ChainClient, ChainReceipt},
    db::{
      runs::count_session_runs,
      sessions::{activate_game_session, insert_game_session, load_session_row},
    },
    models::{RelayDispatchOutcome, UploadRunRequest},
    test_support::{FakeChainClient, test_state, test_state_with_chain_client},
  };

  struct FailingChainClient;

  #[async_trait]
  impl ChainClient for FailingChainClient {
    async fn fetch_level_content_hash(&self, _level_id: &str, _level_version: u32) -> Result<B256> {
      Err(anyhow!("sensitive rpc detail should not leak"))
    }

    async fn fetch_level_order(&self, _level_id: &str, _level_version: u32) -> Result<u32> {
      Ok(0)
    }

    async fn submit_verified_batch(
      &self,
      _permit: &angrybirds_core::ActiveSessionPermit,
      _player_permit_sig: &str,
      _runs: &[angrybirds_core::VerifiedRunRecord],
      _batch_id: B256,
      _verifier_sig: &str,
    ) -> Result<RelayDispatchOutcome> {
      Ok(RelayDispatchOutcome::Confirmed(B256::ZERO))
    }

    async fn get_transaction_receipt(&self, _tx_hash: B256) -> Result<Option<ChainReceipt>> {
      Ok(None)
    }

    async fn get_latest_block_number(&self) -> Result<u64> {
      Ok(0)
    }

    async fn get_logs(&self, _filter: Filter) -> Result<Vec<Log>> {
      Ok(Vec::new())
    }

    async fn get_block_timestamp(&self, _block_number: u64) -> Result<u64> {
      Ok(0)
    }
  }

  fn headers_with_request_id(request_id: &str) -> HeaderMap {
    let mut headers = HeaderMap::new();
    headers.insert("x-request-id", request_id.parse().expect("request id header"));
    headers
  }

  fn build_permit(
    player: Address,
    session_id: B256,
    deployment_id: &str,
    max_runs: u16,
  ) -> angrybirds_core::ActiveSessionPermit {
    angrybirds_core::ActiveSessionPermit {
      player,
      delegate: Address::repeat_byte(0x55),
      session_id,
      deployment_id_hash: angrybirds_core::deployment_id_hash(deployment_id),
      issued_at: 1,
      deadline: u64::MAX,
      nonce: 1,
      max_runs,
    }
  }

  fn sample_evidence(session_id: B256, variant: u64) -> RunEvidenceV1 {
    let started_at_ms = 1_000 + variant * 10_000;
    let launch_at_ms = started_at_ms + 100;
    RunEvidenceV1 {
      session_id,
      level_id: "level-0".to_string(),
      level_version: 1,
      level_content_hash: B256::ZERO,
      client_build_hash: B256::from([0x77; 32]),
      started_at_ms,
      finished_at_ms: started_at_ms + 2_000,
      summary: RunSummary {
        birds_used: 1,
        destroyed_pigs: 1,
        duration_ms: 2_000,
        cleared: true,
      },
      launches: vec![LaunchEvidence {
        bird_index: 0,
        bird_type: "red".to_string(),
        launch_at_ms,
        drag_x: -120.0,
        drag_y: 80.0,
      }],
      abilities: vec![],
      destroys: vec![DestroyEvidence {
        entity_id: format!("pig-{variant}"),
        entity_type: "pig".to_string(),
        at_ms: started_at_ms + 1_500,
        cause: "impact".to_string(),
      }],
      checkpoints: vec![
        CheckpointEvidence {
          at_ms: launch_at_ms,
          bird_index: 0,
          x: 100.0,
          y: 200.0,
        },
        CheckpointEvidence {
          at_ms: launch_at_ms + 250,
          bird_index: 0,
          x: 160.0,
          y: 220.0,
        },
        CheckpointEvidence {
          at_ms: launch_at_ms + 500,
          bird_index: 0,
          x: 220.0,
          y: 240.0,
        },
      ],
    }
  }

  async fn response_parts(response: axum::http::Response<Body>) -> (StatusCode, Value) {
    let status = response.status();
    let bytes = to_bytes(response.into_body(), usize::MAX)
      .await
      .expect("read response body");
    let body = serde_json::from_slice::<Value>(&bytes).expect("parse json response");
    (status, body)
  }

  #[tokio::test]
  async fn upload_run_hides_internal_error_details() {
    let state = test_state_with_chain_client("upload-run-internal", Arc::new(FailingChainClient)).await;
    let player = Address::repeat_byte(0x11);
    let permit = build_permit(player, B256::from([0x22; 32]), &state.config.deployment_id, 2);
    insert_game_session(&state.db, &permit, &state.config.deployment_id, 1)
      .await
      .expect("insert session");
    activate_game_session(&state.db, permit.session_id, permit.player, "0xpermit", 2)
      .await
      .expect("activate session");

    let response = upload_run(
      State(state),
      headers_with_request_id("req-upload-internal"),
      Json(UploadRunRequest {
        player,
        session_id: permit.session_id,
        evidence: sample_evidence(permit.session_id, 1),
      }),
    )
    .await
    .expect("internal error response");
    let (status, body) = response_parts(response).await;

    assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
    assert_eq!(body["code"], "internal_error");
    assert_eq!(body["message"], "后端处理失败，请稍后重试。");
    assert!(body["message"]
      .as_str()
      .expect("error message")
      .contains("稍后重试"));
    assert!(!body["message"]
      .as_str()
      .expect("error message")
      .contains("sensitive rpc detail"));
  }

  #[tokio::test]
  async fn concurrent_uploads_do_not_exceed_max_runs() {
    let state = test_state("upload-run-concurrency").await;
    let player = Address::repeat_byte(0x11);
    let session_id = B256::from([0x33; 32]);
    let permit = build_permit(player, session_id, &state.config.deployment_id, 1);
    insert_game_session(&state.db, &permit, &state.config.deployment_id, 1)
      .await
      .expect("insert session");
    activate_game_session(&state.db, permit.session_id, permit.player, "0xpermit", 2)
      .await
      .expect("activate session");

    let left_state = state.clone();
    let right_state = state.clone();
    let left_request = UploadRunRequest {
      player,
      session_id,
      evidence: sample_evidence(session_id, 1),
    };
    let right_request = UploadRunRequest {
      player,
      session_id,
      evidence: sample_evidence(session_id, 2),
    };

    let (left, right) = tokio::join!(
      upload_run(
        State(left_state),
        headers_with_request_id("req-upload-left"),
        Json(left_request),
      ),
      upload_run(
        State(right_state),
        headers_with_request_id("req-upload-right"),
        Json(right_request),
      )
    );

    let (left_status, left_body) = response_parts(left.expect("left response")).await;
    let (right_status, right_body) = response_parts(right.expect("right response")).await;
    let success_count = [left_status, right_status]
      .into_iter()
      .filter(|status| *status == StatusCode::OK)
      .count();
    let conflict_count = [left_status, right_status]
      .into_iter()
      .filter(|status| *status == StatusCode::CONFLICT)
      .count();

    assert_eq!(
      success_count,
      1,
      "left_status={left_status:?} left_body={left_body} right_status={right_status:?} right_body={right_body}"
    );
    assert_eq!(
      conflict_count,
      1,
      "left_status={left_status:?} left_body={left_body} right_status={right_status:?} right_body={right_body}"
    );
    assert!(
      [&left_body, &right_body]
        .iter()
        .any(|body| body.get("status").and_then(Value::as_str) == Some("validated"))
    );
    assert!(
      [&left_body, &right_body]
        .iter()
        .any(|body| body.get("message").and_then(Value::as_str) == Some("session maxRuns exceeded"))
    );

    let session = load_session_row(&state.db, session_id, player, &state.config.deployment_id)
      .await
      .expect("load session")
      .expect("session row");
    let stored_runs = count_session_runs(&state.db, session_id)
      .await
      .expect("count session runs");

    assert_eq!(session.accepted_run_count, 1);
    assert_eq!(stored_runs, 1);
  }

  #[tokio::test]
  async fn upload_run_replays_same_request_id_for_identical_payload() {
    let state = test_state_with_chain_client("upload-run-replay", Arc::new(FakeChainClient::default())).await;
    let player = Address::repeat_byte(0x44);
    let session_id = B256::from([0x55; 32]);
    let permit = build_permit(player, session_id, &state.config.deployment_id, 2);
    insert_game_session(&state.db, &permit, &state.config.deployment_id, 1)
      .await
      .expect("insert session");
    activate_game_session(&state.db, permit.session_id, permit.player, "0xpermit", 2)
      .await
      .expect("activate session");

    let request = UploadRunRequest {
      player,
      session_id,
      evidence: sample_evidence(session_id, 1),
    };

    let first = upload_run(
      State(state.clone()),
      headers_with_request_id("req-upload-replay"),
      Json(UploadRunRequest {
        player: request.player,
        session_id: request.session_id,
        evidence: request.evidence.clone(),
      }),
    )
    .await
    .expect("first upload");
    let second = upload_run(
      State(state.clone()),
      headers_with_request_id("req-upload-replay"),
      Json(request),
    )
    .await
    .expect("replayed upload");

    let (first_status, first_body) = response_parts(first).await;
    let (second_status, second_body) = response_parts(second).await;
    assert_eq!(first_status, StatusCode::OK);
    assert_eq!(second_status, StatusCode::OK);
    assert_eq!(first_body, second_body);
    assert_eq!(
      count_session_runs(&state.db, session_id)
        .await
        .expect("count session runs"),
      1
    );
  }

  #[tokio::test]
  async fn upload_run_accepts_a_confirmed_session_when_finalize_is_cleared() {
    let state = test_state_with_chain_client("upload-run-confirmed-session", Arc::new(FakeChainClient::default())).await;
    let player = Address::repeat_byte(0x77);
    let session_id = B256::from([0x88; 32]);
    let permit = build_permit(player, session_id, &state.config.deployment_id, 2);
    insert_game_session(&state.db, &permit, &state.config.deployment_id, 1)
      .await
      .expect("insert session");
    activate_game_session(&state.db, permit.session_id, permit.player, "0xpermit", 2)
      .await
      .expect("activate session");
    query(
      r#"
        UPDATE game_sessions
        SET status = ?, finalize_requested_at_ms = NULL, accepted_run_count = 1
        WHERE session_id = ?
      "#,
    )
    .bind("confirmed")
    .bind(format!("{:#x}", session_id))
    .execute(&state.db)
    .await
    .expect("mark session confirmed");

    let response = upload_run(
      State(state.clone()),
      headers_with_request_id("req-upload-confirmed-session"),
      Json(UploadRunRequest {
        player,
        session_id,
        evidence: sample_evidence(session_id, 3),
      }),
    )
    .await
    .expect("confirmed session upload response");
    let (status, body) = response_parts(response).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["status"], "validated");

    let session = load_session_row(&state.db, session_id, player, &state.config.deployment_id)
      .await
      .expect("load session")
      .expect("session row");
    assert_eq!(session.accepted_run_count, 2);
    assert_eq!(session.status, "active");
  }
}
