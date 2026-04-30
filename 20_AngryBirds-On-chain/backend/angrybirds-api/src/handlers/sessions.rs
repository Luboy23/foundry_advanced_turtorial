use std::sync::Arc;

use angrybirds_core::{
  ActiveSessionPermit, build_session_id, build_session_permit_typed_data, deployment_id_hash,
  session_permit_digest, verify_signature,
};
use axum::{
  body::Body,
  extract::{Path, State},
  http::{HeaderMap, Response, StatusCode},
  Json,
};
use tracing::info;

use crate::{
  app_state::AppState,
  db::{
    batches::{queue_session_for_finalize, session_tx_hashes},
    runs::{count_runs_by_status, count_session_runs},
    sessions::{
      activate_game_session, allocate_session_nonce, insert_game_session, load_session_permit,
      load_session_row_by_id, load_session_status,
    },
  },
  errors::{json_response, require_request_id, resolve_request_id, ApiError},
  format_address,
  format_b256,
  idempotency::{execute_idempotent_json, hash_request_bytes},
  models::{
    ActivateSessionRequest, ActivateSessionResponse, CreateSessionRequest, CreateSessionResponse,
    FinalizeSessionResponse, SessionStatusResponse, RUN_STATUS_CONFIRMED, RUN_STATUS_FAILED,
    RUN_STATUS_QUEUED, RUN_STATUS_SUBMITTED, RUN_STATUS_VALIDATED, SESSION_STATUS_QUEUED,
  },
  now_ms, parse_b256,
};

fn extract_session_signature(headers: &HeaderMap) -> Result<String, ApiError> {
  match headers
    .get("x-session-signature")
    .and_then(|value| value.to_str().ok())
    .map(str::trim)
  {
    Some(value) if !value.is_empty() => Ok(value.to_string()),
    _ => Err(ApiError::session_auth_failed("缺少会话签名，请返回首页重新授权。")),
  }
}

fn ensure_session_signature(
  stored_signature: Option<&str>,
  provided_signature: &str,
) -> Result<(), ApiError> {
  match stored_signature {
    Some(signature) if signature == provided_signature => Ok(()),
    _ => Err(ApiError::session_auth_failed("当前会话签名无效，请返回首页重新授权。")),
  }
}

pub async fn create_session(
  State(state): State<Arc<AppState>>,
  headers: HeaderMap,
  Json(request): Json<CreateSessionRequest>,
) -> Result<Response<Body>, ApiError> {
  let request_id = require_request_id(&headers)?;
  let request_hash =
    hash_request_bytes(&serde_json::to_vec(&request).map_err(ApiError::internal)?);
  let state_for_operation = state.clone();

  execute_idempotent_json(
    &state.db,
    "create_session",
    &request_id,
    &request_hash,
    move || async move {
      let created_at_ms = now_ms();
      let now_seconds = created_at_ms / 1_000;
      let nonce = allocate_session_nonce(&state_for_operation.db, request.player)
        .await
        .map_err(ApiError::internal)?;
      let permit = ActiveSessionPermit {
        player: request.player,
        delegate: state_for_operation.relayer_address,
        session_id: build_session_id(
          request.player,
          nonce,
          created_at_ms,
          &state_for_operation.config.deployment_id,
        ),
        deployment_id_hash: deployment_id_hash(&state_for_operation.config.deployment_id),
        issued_at: now_seconds,
        deadline: now_seconds + state_for_operation.config.session_ttl_seconds,
        nonce,
        max_runs: state_for_operation.config.session_max_runs,
      };
      let typed_data = build_session_permit_typed_data(
        &permit,
        state_for_operation.config.chain_id,
        state_for_operation.config.scoreboard_address,
      );

      insert_game_session(
        &state_for_operation.db,
        &permit,
        &state_for_operation.config.deployment_id,
        created_at_ms,
      )
      .await
      .map_err(ApiError::internal)?;

      info!(
        session_id = %format_b256(permit.session_id),
        player = %format_address(permit.player),
        permit_nonce = permit.nonce,
        max_runs = permit.max_runs,
        "created session permit"
      );

      Ok(CreateSessionResponse {
        session_id: permit.session_id,
        deadline: permit.deadline,
        max_runs: permit.max_runs,
        permit,
        typed_data,
      })
    },
  )
  .await
}

pub async fn activate_session(
  State(state): State<Arc<AppState>>,
  headers: HeaderMap,
  Json(request): Json<ActivateSessionRequest>,
) -> Result<Response<Body>, ApiError> {
  let request_id = require_request_id(&headers)?;
  let request_hash =
    hash_request_bytes(&serde_json::to_vec(&request).map_err(ApiError::internal)?);
  let state_for_operation = state.clone();

  execute_idempotent_json(
    &state.db,
    "activate_session",
    &request_id,
    &request_hash,
    move || async move {
      let permit = load_session_permit(
        &state_for_operation.db,
        request.session_id,
        request.player,
        &state_for_operation.config.deployment_id,
      )
      .await
      .map_err(ApiError::internal)?
      .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "session not found"))?;

      let digest = session_permit_digest(
        &permit,
        state_for_operation.config.chain_id,
        state_for_operation.config.scoreboard_address,
      );
      verify_signature(digest, &request.signature, request.player)
        .map_err(|error| ApiError::new(StatusCode::BAD_REQUEST, error.to_string()))?;

      activate_game_session(
        &state_for_operation.db,
        request.session_id,
        request.player,
        &request.signature,
        now_ms(),
      )
      .await
      .map_err(ApiError::internal)?;

      info!(
        session_id = %format_b256(request.session_id),
        player = %format_address(request.player),
        "activated session permit"
      );

      Ok(ActivateSessionResponse { ok: true })
    },
  )
  .await
}

pub async fn finalize_session(
  State(state): State<Arc<AppState>>,
  headers: HeaderMap,
  Path(session_id): Path<String>,
) -> Result<Response<Body>, ApiError> {
  let request_id = require_request_id(&headers)?;
  let session_signature = extract_session_signature(&headers)?;
  let request_hash = hash_request_bytes(format!("{session_id}:{session_signature}").as_bytes());
  let state_for_operation = state.clone();

  execute_idempotent_json(
    &state.db,
    "finalize_session",
    &request_id,
    &request_hash,
    move || async move {
      let session_id = parse_b256(&session_id)
        .map_err(|error| ApiError::new(StatusCode::BAD_REQUEST, error.to_string()))?;
      let session = load_session_row_by_id(
        &state_for_operation.db,
        session_id,
        &state_for_operation.config.deployment_id,
      )
      .await
      .map_err(ApiError::internal)?
      .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "session not found"))?;

      ensure_session_signature(session.permit_signature.as_deref(), &session_signature)?;

      queue_session_for_finalize(
        &state_for_operation.db,
        session_id,
        "explicit finalize request",
      )
      .await
      .map_err(ApiError::internal)?;

      info!(
        session_id = %format_b256(session_id),
        player = %format_address(session.permit.player),
        "queued session for relay finalization"
      );

      Ok(FinalizeSessionResponse {
        ok: true,
        status: SESSION_STATUS_QUEUED.to_string(),
      })
    },
  )
  .await
}

pub async fn session_status(
  State(state): State<Arc<AppState>>,
  headers: HeaderMap,
  Path(session_id): Path<String>,
) -> Result<Response<Body>, ApiError> {
  let request_id = resolve_request_id(&headers);
  let session_signature = extract_session_signature(&headers)
    .map_err(|error| error.with_request_id(request_id.clone()))?;
  let session_id = parse_b256(&session_id)
    .map_err(|error| ApiError::new(StatusCode::BAD_REQUEST, error.to_string()).with_request_id(request_id.clone()))?;
  let session = load_session_row_by_id(&state.db, session_id, &state.config.deployment_id)
    .await
    .map_err(|error| ApiError::internal(error).with_request_id(request_id.clone()))?
    .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "session not found").with_request_id(request_id.clone()))?;

  ensure_session_signature(session.permit_signature.as_deref(), &session_signature)
    .map_err(|error| error.with_request_id(request_id.clone()))?;

  let (status, last_error) = load_session_status(&state.db, session_id, &state.config.deployment_id)
    .await
    .map_err(|error| ApiError::internal(error).with_request_id(request_id.clone()))?
    .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "session not found").with_request_id(request_id.clone()))?;

  let received_runs = count_session_runs(&state.db, session_id)
    .await
    .map_err(|error| ApiError::internal(error).with_request_id(request_id.clone()))?;
  let validated_runs = count_runs_by_status(&state.db, session_id, &[RUN_STATUS_VALIDATED])
    .await
    .map_err(|error| ApiError::internal(error).with_request_id(request_id.clone()))?;
  let queued_runs = count_runs_by_status(&state.db, session_id, &[RUN_STATUS_QUEUED])
    .await
    .map_err(|error| ApiError::internal(error).with_request_id(request_id.clone()))?;
  let submitted_runs = count_runs_by_status(&state.db, session_id, &[RUN_STATUS_SUBMITTED])
    .await
    .map_err(|error| ApiError::internal(error).with_request_id(request_id.clone()))?;
  let confirmed_runs = count_runs_by_status(&state.db, session_id, &[RUN_STATUS_CONFIRMED])
    .await
    .map_err(|error| ApiError::internal(error).with_request_id(request_id.clone()))?;
  let failed_runs = count_runs_by_status(&state.db, session_id, &[RUN_STATUS_FAILED])
    .await
    .map_err(|error| ApiError::internal(error).with_request_id(request_id.clone()))?;
  let tx_hashes = session_tx_hashes(&state.db, session_id)
    .await
    .map_err(|error| ApiError::internal(error).with_request_id(request_id.clone()))?;

  json_response(
    StatusCode::OK,
    &SessionStatusResponse {
      session_id,
      status,
      received_runs,
      validated_runs,
      queued_runs,
      submitted_runs,
      confirmed_runs,
      failed_runs,
      tx_hashes,
      last_error,
    },
    &request_id,
  )
}

#[cfg(test)]
mod tests {
  use std::str::FromStr;

  use alloy::{hex, primitives::{Address, B256}, signers::Signer};
  use angrybirds_core::{ActiveSessionPermit, deployment_id_hash, session_permit_digest};
  use axum::{
    body::{to_bytes, Body},
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
  };
  use serde_json::Value;

  use super::{activate_session, create_session, finalize_session, session_status};
  use crate::{
    db::sessions::{activate_game_session, insert_game_session},
    models::{ActivateSessionRequest, CreateSessionRequest},
    test_support::test_state,
  };

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
  ) -> ActiveSessionPermit {
    ActiveSessionPermit {
      player,
      delegate: Address::repeat_byte(0x55),
      session_id,
      deployment_id_hash: deployment_id_hash(deployment_id),
      issued_at: 1,
      deadline: u64::MAX,
      nonce: 1,
      max_runs,
    }
  }

  async fn response_json(response: axum::http::Response<Body>) -> Value {
    let status = response.status();
    let bytes = to_bytes(response.into_body(), usize::MAX)
      .await
      .expect("read response body");
    let body = serde_json::from_slice::<Value>(&bytes).expect("parse json response");
    assert!(
      status.is_success() || body.get("code").is_some(),
      "expected success payload or stable error body"
    );
    body
  }

  #[tokio::test]
  async fn session_status_requires_matching_session_signature() {
    let state = test_state("session-status-auth").await;
    let permit = build_permit(
      Address::repeat_byte(0x11),
      B256::from([0x22; 32]),
      &state.config.deployment_id,
      3,
    );
    insert_game_session(&state.db, &permit, &state.config.deployment_id, 1)
      .await
      .expect("insert session");
    activate_game_session(&state.db, permit.session_id, permit.player, "0xpermit-a", 2)
      .await
      .expect("activate session");

    let missing_signature = session_status(
      State(state.clone()),
      headers_with_request_id("req-status-missing"),
      Path(format!("{:#x}", permit.session_id)),
    )
    .await
    .unwrap_err();
    assert_eq!(missing_signature.status, StatusCode::FORBIDDEN);
    assert_eq!(missing_signature.code, "session_auth_failed");

    let mut wrong_headers = headers_with_request_id("req-status-wrong");
    wrong_headers.insert("x-session-signature", "0xwrong".parse().expect("signature header"));
    let wrong_signature = session_status(
      State(state.clone()),
      wrong_headers,
      Path(format!("{:#x}", permit.session_id)),
    )
    .await
    .unwrap_err();
    assert_eq!(wrong_signature.status, StatusCode::FORBIDDEN);
    assert_eq!(wrong_signature.code, "session_auth_failed");

    let second_permit = build_permit(
      Address::repeat_byte(0x33),
      B256::from([0x44; 32]),
      &state.config.deployment_id,
      3,
    );
    insert_game_session(&state.db, &second_permit, &state.config.deployment_id, 3)
      .await
      .expect("insert second session");
    activate_game_session(&state.db, second_permit.session_id, second_permit.player, "0xpermit-b", 4)
      .await
      .expect("activate second session");

    let mut cross_headers = headers_with_request_id("req-status-cross");
    cross_headers.insert(
      "x-session-signature",
      "0xpermit-b".parse().expect("cross signature header"),
    );
    let cross_signature = session_status(
      State(state.clone()),
      cross_headers,
      Path(format!("{:#x}", permit.session_id)),
    )
    .await
    .unwrap_err();
    assert_eq!(cross_signature.status, StatusCode::FORBIDDEN);
    assert_eq!(cross_signature.code, "session_auth_failed");

    let mut valid_headers = headers_with_request_id("req-status-valid");
    valid_headers.insert(
      "x-session-signature",
      "0xpermit-a".parse().expect("valid signature header"),
    );
    let response = session_status(
      State(state),
      valid_headers,
      Path(format!("{:#x}", permit.session_id)),
    )
    .await
    .expect("session status succeeds");
    let body = response_json(response).await;
    assert_eq!(body["status"], "active");
    assert_eq!(body["receivedRuns"], 0);
  }

  #[tokio::test]
  async fn finalize_session_requires_matching_session_signature() {
    let state = test_state("finalize-auth").await;
    let permit = build_permit(
      Address::repeat_byte(0x11),
      B256::from([0x66; 32]),
      &state.config.deployment_id,
      3,
    );
    insert_game_session(&state.db, &permit, &state.config.deployment_id, 1)
      .await
      .expect("insert session");
    activate_game_session(&state.db, permit.session_id, permit.player, "0xpermit-finalize", 2)
      .await
      .expect("activate session");

    let mut invalid_headers = headers_with_request_id("req-finalize-invalid");
    invalid_headers.insert(
      "x-session-signature",
      "0xwrong".parse().expect("invalid signature header"),
    );
    let invalid = finalize_session(
      State(state.clone()),
      invalid_headers,
      Path(format!("{:#x}", permit.session_id)),
    )
    .await
    .expect("finalize auth failure response");
    let invalid_body = response_json(invalid).await;
    assert_eq!(invalid_body["code"], "session_auth_failed");

    let mut valid_headers = headers_with_request_id("req-finalize-valid");
    valid_headers.insert(
      "x-session-signature",
      "0xpermit-finalize".parse().expect("valid signature header"),
    );
    let response = finalize_session(
      State(state),
      valid_headers,
      Path(format!("{:#x}", permit.session_id)),
    )
    .await
    .expect("finalize succeeds");
    let body = response_json(response).await;
    assert_eq!(body["ok"], true);
    assert_eq!(body["status"], "queued");
  }

  #[tokio::test]
  async fn create_session_replays_same_request_id_and_rejects_conflicting_reuse() {
    let state = test_state("create-session-idempotency").await;
    let player_a = Address::repeat_byte(0x11);
    let player_b = Address::repeat_byte(0x22);

    let headers = headers_with_request_id("req-create-session");
    let first_response = create_session(
      State(state.clone()),
      headers.clone(),
      Json(CreateSessionRequest { player: player_a }),
    )
    .await
    .expect("first create session");
    let first_body = response_json(first_response).await;

    let second_response = create_session(
      State(state.clone()),
      headers,
      Json(CreateSessionRequest { player: player_a }),
    )
    .await
    .expect("second create session replay");
    let second_body = response_json(second_response).await;

    assert_eq!(first_body["sessionId"], second_body["sessionId"]);
    assert_eq!(first_body["permit"]["sessionId"], second_body["permit"]["sessionId"]);

    let conflict = create_session(
      State(state),
      headers_with_request_id("req-create-session"),
      Json(CreateSessionRequest { player: player_b }),
    )
    .await
    .unwrap_err()
    .into_response();
    let conflict_body = response_json(conflict).await;
    assert_eq!(conflict_body["code"], "request_id_conflict");
  }

  #[tokio::test]
  async fn activate_session_replays_same_request_id() {
    let state = test_state("activate-session-idempotency").await;
    let player_signer = alloy::signers::local::PrivateKeySigner::from_str(
      "0x8b3a350cf5c34c9194ca3a9d8b35fbbd8f73c51a10efc18d5a58b0d4f38ebb2d",
    )
    .expect("player signer");
    let player = player_signer.address();
    let create_response = create_session(
      State(state.clone()),
      headers_with_request_id("req-activate-create"),
      Json(CreateSessionRequest { player }),
    )
    .await
    .expect("create session");
    let create_body = response_json(create_response).await;
    let session_id = create_body["sessionId"]
      .as_str()
      .expect("session id")
      .parse::<B256>()
      .expect("parse session id");
    let permit: ActiveSessionPermit = serde_json::from_value(create_body["permit"].clone())
      .expect("permit json");
    let digest = session_permit_digest(
      &permit,
      state.config.chain_id,
      state.config.scoreboard_address,
    );
    let signature = format!(
      "0x{}",
      hex::encode(
        player_signer
          .sign_hash(&digest)
          .await
          .expect("sign permit digest")
          .as_bytes()
      )
    );

    let headers = headers_with_request_id("req-activate-session");
    let first_response = activate_session(
      State(state.clone()),
      headers.clone(),
      Json(ActivateSessionRequest {
        player,
        session_id,
        signature: signature.clone(),
      }),
    )
    .await
    .expect("activate session");
    let first_body = response_json(first_response).await;
    let second_response = activate_session(
      State(state),
      headers,
      Json(ActivateSessionRequest {
        player,
        session_id,
        signature,
      }),
    )
    .await
    .expect("replay activate session");
    let second_body = response_json(second_response).await;

    assert_eq!(first_body, second_body);
    assert_eq!(first_body["ok"], true);
  }
}
