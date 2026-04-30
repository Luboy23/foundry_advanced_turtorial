use alloy::primitives::{Address, B256};
use anyhow::Result;
use angrybirds_core::ActiveSessionPermit;
use sqlx::{query, Row, Sqlite, SqlitePool, Transaction};

use crate::{
  format_address, format_b256,
  models::{
    SessionRow, RUN_STATUS_FAILED, RUN_STATUS_VALIDATED, SESSION_STATUS_ACTIVE, SESSION_STATUS_CONFIRMED,
    SESSION_STATUS_CREATED, SESSION_STATUS_FAILED, SESSION_STATUS_QUEUED,
  },
  now_ms, parse_b256,
};

pub async fn allocate_session_nonce(pool: &SqlitePool, player: Address) -> Result<u32> {
  let row = query(
    r#"
        INSERT INTO player_session_counters (player, next_nonce, updated_at_ms)
        VALUES (?, 2, ?)
        ON CONFLICT(player) DO UPDATE
        SET next_nonce = player_session_counters.next_nonce + 1,
            updated_at_ms = excluded.updated_at_ms
        RETURNING next_nonce - 1 AS allocated_nonce
        "#,
  )
  .bind(format_address(player))
  .bind(now_ms() as i64)
  .fetch_one(pool)
  .await?;
  Ok(row.try_get::<i64, _>("allocated_nonce")? as u32)
}

pub async fn insert_game_session(
  pool: &SqlitePool,
  permit: &ActiveSessionPermit,
  deployment_id: &str,
  created_at_ms: u64,
) -> Result<()> {
  query(
    r#"
        INSERT INTO game_sessions (
            session_id,
            player,
            delegate,
            permit_nonce,
            permit_json,
            permit_signature,
            status,
            deployment_id,
            last_error,
            created_at_ms,
            updated_at_ms,
            last_activity_ms,
            finalize_requested_at_ms,
            accepted_run_count
        )
        VALUES (?, ?, ?, ?, ?, NULL, ?, ?, NULL, ?, ?, ?, NULL, 0)
        "#,
  )
  .bind(format_b256(permit.session_id))
  .bind(format_address(permit.player))
  .bind(format_address(permit.delegate))
  .bind(i64::from(permit.nonce))
  .bind(serde_json::to_string(permit)?)
  .bind(SESSION_STATUS_CREATED)
  .bind(deployment_id)
  .bind(created_at_ms as i64)
  .bind(created_at_ms as i64)
  .bind(created_at_ms as i64)
  .execute(pool)
  .await?;
  Ok(())
}

pub async fn load_session_permit(
  pool: &SqlitePool,
  session_id: B256,
  player: Address,
  deployment_id: &str,
) -> Result<Option<ActiveSessionPermit>> {
  let row = query(
    "SELECT permit_json FROM game_sessions WHERE session_id = ? AND player = ? AND deployment_id = ?",
  )
    .bind(format_b256(session_id))
    .bind(format_address(player))
    .bind(deployment_id)
    .fetch_optional(pool)
    .await?;

  row.map(|row| -> Result<_> { Ok(serde_json::from_str(&row.try_get::<String, _>("permit_json")?)?) })
    .transpose()
}

pub async fn activate_game_session(
  pool: &SqlitePool,
  session_id: B256,
  player: Address,
  signature: &str,
  touched_at_ms: u64,
) -> Result<()> {
  query(
    r#"
        UPDATE game_sessions
        SET permit_signature = ?, status = ?, updated_at_ms = ?, last_activity_ms = ?, last_error = NULL
        WHERE session_id = ? AND player = ?
        "#,
  )
  .bind(signature)
  .bind(SESSION_STATUS_ACTIVE)
  .bind(touched_at_ms as i64)
  .bind(touched_at_ms as i64)
  .bind(format_b256(session_id))
  .bind(format_address(player))
  .execute(pool)
  .await?;
  Ok(())
}

pub async fn load_session_row(
  pool: &SqlitePool,
  session_id: B256,
  player: Address,
  deployment_id: &str,
) -> Result<Option<SessionRow>> {
  let row = query(
    "SELECT permit_json, permit_signature, status, finalize_requested_at_ms, accepted_run_count FROM game_sessions WHERE session_id = ? AND player = ? AND deployment_id = ?",
  )
  .bind(format_b256(session_id))
  .bind(format_address(player))
  .bind(deployment_id)
  .fetch_optional(pool)
  .await?;

  row.map(map_session_row).transpose()
}

pub async fn load_session_row_by_id(
  pool: &SqlitePool,
  session_id: B256,
  deployment_id: &str,
) -> Result<Option<SessionRow>> {
  let row = query(
    "SELECT permit_json, permit_signature, status, finalize_requested_at_ms, accepted_run_count FROM game_sessions WHERE session_id = ? AND deployment_id = ?",
  )
  .bind(format_b256(session_id))
  .bind(deployment_id)
  .fetch_optional(pool)
  .await?;

  row.map(map_session_row).transpose()
}

pub async fn load_session_row_tx(
  tx: &mut Transaction<'_, Sqlite>,
  session_id: B256,
  player: Address,
  deployment_id: &str,
) -> Result<Option<SessionRow>> {
  let row = query(
    "SELECT permit_json, permit_signature, status, finalize_requested_at_ms, accepted_run_count FROM game_sessions WHERE session_id = ? AND player = ? AND deployment_id = ?",
  )
  .bind(format_b256(session_id))
  .bind(format_address(player))
  .bind(deployment_id)
  .fetch_optional(&mut **tx)
  .await?;

  row.map(map_session_row).transpose()
}

pub async fn load_session_status(
  pool: &SqlitePool,
  session_id: B256,
  deployment_id: &str,
) -> Result<Option<(String, Option<String>)>> {
  let row = query(
    r#"
        SELECT status, last_error
        FROM game_sessions
        WHERE session_id = ? AND deployment_id = ?
        "#,
  )
  .bind(format_b256(session_id))
  .bind(deployment_id)
  .fetch_optional(pool)
  .await?;

  row.map(|row| Ok((row.try_get("status")?, row.try_get("last_error")?)))
    .transpose()
}

pub async fn touch_session_after_run(pool: &SqlitePool, session_id: B256, touched_at_ms: u64) -> Result<()> {
  query(
    r#"
        UPDATE game_sessions
        SET updated_at_ms = ?, last_activity_ms = ?, status = ?, last_error = NULL
        WHERE session_id = ?
        "#,
  )
  .bind(touched_at_ms as i64)
  .bind(touched_at_ms as i64)
  .bind(SESSION_STATUS_ACTIVE)
  .bind(format_b256(session_id))
  .execute(pool)
  .await?;
  Ok(())
}

pub async fn increment_accepted_run_count_tx(
  tx: &mut Transaction<'_, Sqlite>,
  session_id: B256,
  player: Address,
  deployment_id: &str,
  max_runs: u16,
  touched_at_ms: u64,
) -> Result<bool> {
  let result = query(
    r#"
        UPDATE game_sessions
        SET accepted_run_count = accepted_run_count + 1,
            updated_at_ms = ?,
            last_activity_ms = ?,
            status = ?,
            last_error = NULL
        WHERE session_id = ?
          AND player = ?
          AND deployment_id = ?
          AND permit_signature IS NOT NULL
          AND (status = ? OR status = ?)
          AND finalize_requested_at_ms IS NULL
          AND accepted_run_count < ?
        "#,
  )
  .bind(touched_at_ms as i64)
  .bind(touched_at_ms as i64)
  .bind(SESSION_STATUS_ACTIVE)
  .bind(format_b256(session_id))
  .bind(format_address(player))
  .bind(deployment_id)
  .bind(SESSION_STATUS_ACTIVE)
  .bind(SESSION_STATUS_CONFIRMED)
  .bind(i64::from(max_runs))
  .execute(&mut **tx)
  .await?;

  Ok(result.rows_affected() == 1)
}

pub async fn find_idle_session_ids(
  pool: &SqlitePool,
  idle_cutoff: u64,
  deployment_id: &str,
) -> Result<Vec<B256>> {
  let rows = query(
    r#"
        SELECT session_id
        FROM game_sessions
        WHERE permit_signature IS NOT NULL
          AND deployment_id = ?
          AND status = ?
          AND finalize_requested_at_ms IS NULL
          AND last_activity_ms <= ?
          AND EXISTS (
              SELECT 1
              FROM session_runs
              WHERE session_runs.session_id = game_sessions.session_id
                AND session_runs.status IN (?, ?)
          )
        "#,
  )
  .bind(deployment_id)
  .bind(SESSION_STATUS_ACTIVE)
  .bind(idle_cutoff as i64)
  .bind(RUN_STATUS_VALIDATED)
  .bind(RUN_STATUS_FAILED)
  .fetch_all(pool)
  .await?;

  rows
    .into_iter()
    .map(|row| parse_b256(&row.try_get::<String, _>("session_id")?))
    .collect()
}

pub async fn find_ready_session_ids(
  pool: &SqlitePool,
  retry_cutoff: u64,
  deployment_id: &str,
) -> Result<Vec<B256>> {
  let rows = query(
    r#"
        SELECT session_id
        FROM game_sessions
        WHERE permit_signature IS NOT NULL
          AND deployment_id = ?
          AND (
              status = ?
              OR (status = ? AND finalize_requested_at_ms IS NOT NULL AND updated_at_ms <= ?)
          )
        ORDER BY updated_at_ms ASC
        "#,
  )
  .bind(deployment_id)
  .bind(SESSION_STATUS_QUEUED)
  .bind(SESSION_STATUS_FAILED)
  .bind(retry_cutoff as i64)
  .fetch_all(pool)
  .await?;

  rows
    .into_iter()
    .map(|row| parse_b256(&row.try_get::<String, _>("session_id")?))
    .collect()
}

fn map_session_row(row: sqlx::sqlite::SqliteRow) -> Result<SessionRow> {
  Ok(SessionRow {
    permit: serde_json::from_str(&row.try_get::<String, _>("permit_json")?)?,
    permit_signature: row.try_get("permit_signature")?,
    status: row.try_get("status")?,
    finalize_requested_at_ms: row.try_get("finalize_requested_at_ms")?,
    accepted_run_count: row.try_get("accepted_run_count")?,
  })
}

#[cfg(test)]
mod tests {
  use alloy::primitives::{Address, B256};
  use angrybirds_core::ActiveSessionPermit;

  use super::{allocate_session_nonce, insert_game_session, load_session_status};
  use crate::test_support::test_pool;

  #[tokio::test]
  async fn allocate_session_nonce_is_unique_under_parallel_calls() {
    let pool = test_pool("nonce-parallel").await;
    let player = Address::from_slice(&[0x11; 20]);

    let (left, right) = tokio::join!(
      allocate_session_nonce(&pool, player),
      allocate_session_nonce(&pool, player)
    );

    let mut nonces = vec![left.expect("left nonce"), right.expect("right nonce")];
    nonces.sort_unstable();
    assert_eq!(nonces, vec![1, 2]);
  }

  #[tokio::test]
  async fn load_session_status_is_scoped_to_deployment() {
    let pool = test_pool("session-status-scope").await;
    let permit = ActiveSessionPermit {
      player: Address::from_slice(&[0x11; 20]),
      delegate: Address::from_slice(&[0x22; 20]),
      session_id: B256::from([0x33; 32]),
      deployment_id_hash: B256::from([0x44; 32]),
      issued_at: 1,
      deadline: 2,
      nonce: 1,
      max_runs: 10,
    };

    insert_game_session(&pool, &permit, "deployment-a", 1)
      .await
      .expect("insert session");

    let scoped = load_session_status(&pool, permit.session_id, "deployment-a")
      .await
      .expect("load scoped status");
    let other_scope = load_session_status(&pool, permit.session_id, "deployment-b")
      .await
      .expect("load other scope status");

    assert!(scoped.is_some());
    assert!(other_scope.is_none());
  }
}
