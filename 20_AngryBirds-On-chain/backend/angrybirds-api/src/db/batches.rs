use alloy::primitives::B256;
use anyhow::Result;
use angrybirds_core::ActiveSessionPermit;
use sqlx::{query, Row, SqlitePool};

use crate::{
  format_address, format_b256, parse_b256,
  models::{
    RelayBatchRow, BATCH_STATUS_CONFIRMED, BATCH_STATUS_FAILED, BATCH_STATUS_QUEUED,
    BATCH_STATUS_SUBMITTED, RUN_STATUS_CONFIRMED, RUN_STATUS_FAILED, RUN_STATUS_QUEUED,
    RUN_STATUS_SUBMITTED, RUN_STATUS_VALIDATED, SESSION_STATUS_ACTIVE, SESSION_STATUS_CONFIRMED,
    SESSION_STATUS_FAILED, SESSION_STATUS_QUEUED, SESSION_STATUS_SUBMITTED,
  },
  now_ms,
};

pub async fn session_tx_hashes(pool: &SqlitePool, session_id: B256) -> Result<Vec<String>> {
  let rows = query(
    r#"
        SELECT tx_hash
        FROM relay_batches
        WHERE session_id = ? AND tx_hash IS NOT NULL
        ORDER BY created_at_ms ASC
        "#,
  )
  .bind(format_b256(session_id))
  .fetch_all(pool)
  .await?;

  rows
    .into_iter()
    .map(|row| row.try_get::<String, _>("tx_hash").map_err(Into::into))
    .collect()
}

pub async fn load_submitted_batches(pool: &SqlitePool) -> Result<Vec<RelayBatchRow>> {
  let rows = query(
    r#"
        SELECT batch_id, session_id, tx_hash
        FROM relay_batches
        WHERE status = ? AND tx_hash IS NOT NULL
        ORDER BY updated_at_ms ASC
        "#,
  )
  .bind(BATCH_STATUS_SUBMITTED)
  .fetch_all(pool)
  .await?;

  rows
    .into_iter()
    .map(|row| -> Result<RelayBatchRow> {
      Ok(RelayBatchRow {
        batch_id: parse_b256(&row.try_get::<String, _>("batch_id")?)?,
        session_id: parse_b256(&row.try_get::<String, _>("session_id")?)?,
        tx_hash: parse_b256(&row.try_get::<String, _>("tx_hash")?)?,
      })
    })
    .collect()
}

pub async fn queue_session_for_finalize(pool: &SqlitePool, session_id: B256, _reason: &str) -> Result<()> {
  query(
    r#"
        UPDATE game_sessions
        SET status = ?,
            finalize_requested_at_ms = COALESCE(finalize_requested_at_ms, ?),
            updated_at_ms = ?,
            last_error = NULL
        WHERE session_id = ?
        "#,
  )
  .bind(SESSION_STATUS_QUEUED)
  .bind(now_ms() as i64)
  .bind(now_ms() as i64)
  .bind(format_b256(session_id))
  .execute(pool)
  .await?;
  Ok(())
}

pub async fn upsert_relay_batch_queued(
  pool: &SqlitePool,
  permit: &ActiveSessionPermit,
  session_id: B256,
  batch_id: B256,
  run_ids_json: &str,
) -> Result<()> {
  query(
    r#"
        INSERT INTO relay_batches (
            batch_id,
            session_id,
            player,
            run_ids_json,
            tx_hash,
            status,
            fail_reason,
            submitted_at_ms,
            confirmed_at_ms,
            created_at_ms,
            updated_at_ms
        )
        VALUES (?, ?, ?, ?, NULL, ?, NULL, NULL, NULL, ?, ?)
        ON CONFLICT(batch_id) DO UPDATE
        SET run_ids_json = excluded.run_ids_json,
            status = excluded.status,
            fail_reason = NULL,
            updated_at_ms = excluded.updated_at_ms
        "#,
  )
  .bind(format_b256(batch_id))
  .bind(format_b256(session_id))
  .bind(format_address(permit.player))
  .bind(run_ids_json)
  .bind(BATCH_STATUS_QUEUED)
  .bind(now_ms() as i64)
  .bind(now_ms() as i64)
  .execute(pool)
  .await?;
  Ok(())
}

pub async fn mark_runs_queued(
  pool: &SqlitePool,
  session_id: B256,
  batch_id: B256,
  run_ids_json: &str,
) -> Result<()> {
  query(
    r#"
        UPDATE session_runs
        SET status = ?,
            batch_id = ?,
            validation_error = NULL,
            updated_at_ms = ?
        WHERE session_id = ?
          AND run_id IN (SELECT value FROM json_each(?))
        "#,
  )
  .bind(RUN_STATUS_QUEUED)
  .bind(format_b256(batch_id))
  .bind(now_ms() as i64)
  .bind(format_b256(session_id))
  .bind(run_ids_json)
  .execute(pool)
  .await?;
  Ok(())
}

pub async fn mark_batch_submitted(
  pool: &SqlitePool,
  session_id: B256,
  batch_id: B256,
  tx_hash_hex: &str,
  fail_reason: Option<&str>,
) -> Result<()> {
  query(
    r#"
        UPDATE relay_batches
        SET tx_hash = ?,
            status = ?,
            fail_reason = ?,
            submitted_at_ms = COALESCE(submitted_at_ms, ?),
            updated_at_ms = ?
        WHERE batch_id = ?
        "#,
  )
  .bind(tx_hash_hex)
  .bind(BATCH_STATUS_SUBMITTED)
  .bind(fail_reason)
  .bind(now_ms() as i64)
  .bind(now_ms() as i64)
  .bind(format_b256(batch_id))
  .execute(pool)
  .await?;

  query(
    r#"
        UPDATE session_runs
        SET status = ?, tx_hash = ?, updated_at_ms = ?, validation_error = NULL
        WHERE session_id = ? AND batch_id = ?
        "#,
  )
  .bind(RUN_STATUS_SUBMITTED)
  .bind(tx_hash_hex)
  .bind(now_ms() as i64)
  .bind(format_b256(session_id))
  .bind(format_b256(batch_id))
  .execute(pool)
  .await?;

  query(
    r#"
        UPDATE game_sessions
        SET status = ?, updated_at_ms = ?, last_error = NULL
        WHERE session_id = ?
        "#,
  )
  .bind(SESSION_STATUS_SUBMITTED)
  .bind(now_ms() as i64)
  .bind(format_b256(session_id))
  .execute(pool)
  .await?;

  Ok(())
}

pub async fn mark_batch_confirmed(
  pool: &SqlitePool,
  session_id: B256,
  batch_id: B256,
  tx_hash_hex: &str,
) -> Result<()> {
  query(
    r#"
        UPDATE relay_batches
        SET tx_hash = ?,
            status = ?,
            fail_reason = NULL,
            confirmed_at_ms = ?,
            updated_at_ms = ?
        WHERE batch_id = ?
        "#,
  )
  .bind(tx_hash_hex)
  .bind(BATCH_STATUS_CONFIRMED)
  .bind(now_ms() as i64)
  .bind(now_ms() as i64)
  .bind(format_b256(batch_id))
  .execute(pool)
  .await?;

  query(
    r#"
        UPDATE session_runs
        SET status = ?, tx_hash = ?, validation_error = NULL, updated_at_ms = ?
        WHERE session_id = ? AND batch_id = ?
        "#,
  )
  .bind(RUN_STATUS_CONFIRMED)
  .bind(tx_hash_hex)
  .bind(now_ms() as i64)
  .bind(format_b256(session_id))
  .bind(format_b256(batch_id))
  .execute(pool)
  .await?;

  query(
    r#"
        UPDATE game_sessions
        SET finalize_requested_at_ms = NULL, updated_at_ms = ?, last_error = NULL
        WHERE session_id = ?
        "#,
  )
  .bind(now_ms() as i64)
  .bind(format_b256(session_id))
  .execute(pool)
  .await?;

  Ok(())
}

pub async fn mark_batch_failed(
  pool: &SqlitePool,
  session_id: B256,
  batch_id: B256,
  tx_hash_hex: Option<&str>,
  fail_reason: &str,
) -> Result<()> {
  query(
    r#"
        UPDATE relay_batches
        SET tx_hash = COALESCE(?, tx_hash),
            status = ?,
            fail_reason = ?,
            updated_at_ms = ?
        WHERE batch_id = ?
        "#,
  )
  .bind(tx_hash_hex)
  .bind(BATCH_STATUS_FAILED)
  .bind(fail_reason)
  .bind(now_ms() as i64)
  .bind(format_b256(batch_id))
  .execute(pool)
  .await?;

  query(
    r#"
        UPDATE session_runs
        SET status = ?, tx_hash = COALESCE(?, tx_hash), validation_error = ?, updated_at_ms = ?
        WHERE session_id = ? AND batch_id = ?
        "#,
  )
  .bind(RUN_STATUS_FAILED)
  .bind(tx_hash_hex)
  .bind(fail_reason)
  .bind(now_ms() as i64)
  .bind(format_b256(session_id))
  .bind(format_b256(batch_id))
  .execute(pool)
  .await?;

  query(
    r#"
        UPDATE game_sessions
        SET status = ?, updated_at_ms = ?, last_error = ?
        WHERE session_id = ?
        "#,
  )
  .bind(SESSION_STATUS_FAILED)
  .bind(now_ms() as i64)
  .bind(fail_reason)
  .bind(format_b256(session_id))
  .execute(pool)
  .await?;

  Ok(())
}

pub async fn refresh_session_status(pool: &SqlitePool, session_id: B256) -> Result<()> {
  let confirmed_runs = query(
    "SELECT COUNT(*) AS count FROM session_runs WHERE session_id = ? AND status = ?",
  )
  .bind(format_b256(session_id))
  .bind(RUN_STATUS_CONFIRMED)
  .fetch_one(pool)
  .await?
  .try_get::<i64, _>("count")?;
  let pending_runs = query(
    "SELECT COUNT(*) AS count FROM session_runs WHERE session_id = ? AND status IN (?, ?, ?)",
  )
  .bind(format_b256(session_id))
  .bind(RUN_STATUS_VALIDATED)
  .bind(RUN_STATUS_QUEUED)
  .bind(RUN_STATUS_SUBMITTED)
  .fetch_one(pool)
  .await?
  .try_get::<i64, _>("count")?;
  let failed_runs = query(
    "SELECT COUNT(*) AS count FROM session_runs WHERE session_id = ? AND status = ?",
  )
  .bind(format_b256(session_id))
  .bind(RUN_STATUS_FAILED)
  .fetch_one(pool)
  .await?
  .try_get::<i64, _>("count")?;

  let next_status = if pending_runs > 0 {
    SESSION_STATUS_SUBMITTED
  } else if failed_runs > 0 {
    SESSION_STATUS_FAILED
  } else if confirmed_runs > 0 {
    SESSION_STATUS_CONFIRMED
  } else {
    SESSION_STATUS_ACTIVE
  };

  query(
    r#"
        UPDATE game_sessions
        SET status = ?, updated_at_ms = ?, last_error = CASE WHEN ? = ? THEN last_error ELSE NULL END
        WHERE session_id = ?
        "#,
  )
  .bind(next_status)
  .bind(now_ms() as i64)
  .bind(next_status)
  .bind(SESSION_STATUS_FAILED)
  .bind(format_b256(session_id))
  .execute(pool)
  .await?;

  Ok(())
}

#[cfg(test)]
mod tests {
  use alloy::primitives::{Address, B256};
  use angrybirds_core::{deployment_id_hash, ActiveSessionPermit};
  use sqlx::{query, Row};

  use super::{mark_batch_confirmed, refresh_session_status};
  use crate::{
    db::sessions::{activate_game_session, insert_game_session},
    format_address, format_b256,
    models::{
      BATCH_STATUS_SUBMITTED, RUN_STATUS_SUBMITTED, SESSION_STATUS_CONFIRMED,
      SESSION_STATUS_QUEUED,
    },
    test_support::test_pool,
  };

  fn build_permit(player: Address, session_id: B256, deployment_id: &str) -> ActiveSessionPermit {
    ActiveSessionPermit {
      player,
      delegate: Address::repeat_byte(0x55),
      session_id,
      deployment_id_hash: deployment_id_hash(deployment_id),
      issued_at: 1,
      deadline: u64::MAX,
      nonce: 1,
      max_runs: 10,
    }
  }

  #[tokio::test]
  async fn mark_batch_confirmed_clears_finalize_marker_and_leaves_session_reusable() {
    let pool = test_pool("mark-batch-confirmed-reopens-session").await;
    let deployment_id = "local-dev";
    let player = Address::repeat_byte(0x11);
    let session_id = B256::from([0x22; 32]);
    let batch_id = B256::from([0x33; 32]);
    let tx_hash = format_b256(B256::from([0x44; 32]));
    let permit = build_permit(player, session_id, deployment_id);

    insert_game_session(&pool, &permit, deployment_id, 1)
      .await
      .expect("insert session");
    activate_game_session(&pool, session_id, player, "0xpermit", 2)
      .await
      .expect("activate session");

    query(
      r#"
        UPDATE game_sessions
        SET status = ?, finalize_requested_at_ms = ?
        WHERE session_id = ?
      "#,
    )
    .bind(SESSION_STATUS_QUEUED)
    .bind(3_i64)
    .bind(format_b256(session_id))
    .execute(&pool)
    .await
    .expect("queue session");

    query(
      r#"
        INSERT INTO relay_batches (
          batch_id,
          session_id,
          player,
          run_ids_json,
          tx_hash,
          status,
          fail_reason,
          submitted_at_ms,
          confirmed_at_ms,
          created_at_ms,
          updated_at_ms
        )
        VALUES (?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?, ?)
      "#,
    )
    .bind(format_b256(batch_id))
    .bind(format_b256(session_id))
    .bind(format_address(player))
    .bind(format!("[\"{}\"]", format_b256(B256::from([0x55; 32]))))
    .bind(&tx_hash)
    .bind(BATCH_STATUS_SUBMITTED)
    .bind(4_i64)
    .bind(4_i64)
    .bind(4_i64)
    .execute(&pool)
    .await
    .expect("insert relay batch");

    query(
      r#"
        INSERT INTO session_runs (
          run_id,
          session_id,
          player,
          level_id,
          level_version,
          birds_used,
          destroyed_pigs,
          duration_ms,
          evidence_hash,
          evidence_json,
          status,
          batch_id,
          tx_hash,
          validation_error,
          received_at_ms,
          updated_at_ms
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
      "#,
    )
    .bind(format_b256(B256::from([0x55; 32])))
    .bind(format_b256(session_id))
    .bind(format_address(player))
    .bind("level-0")
    .bind(1_i64)
    .bind(1_i64)
    .bind(1_i64)
    .bind(1_000_i64)
    .bind(format_b256(B256::from([0x66; 32])))
    .bind("{}")
    .bind(RUN_STATUS_SUBMITTED)
    .bind(format_b256(batch_id))
    .bind(&tx_hash)
    .bind(5_i64)
    .bind(5_i64)
    .execute(&pool)
    .await
    .expect("insert session run");

    mark_batch_confirmed(&pool, session_id, batch_id, &tx_hash)
      .await
      .expect("mark batch confirmed");
    refresh_session_status(&pool, session_id)
      .await
      .expect("refresh session status");

    let row = query(
      "SELECT finalize_requested_at_ms, status FROM game_sessions WHERE session_id = ?",
    )
    .bind(format_b256(session_id))
    .fetch_one(&pool)
    .await
    .expect("load session row");

    assert_eq!(row.try_get::<Option<i64>, _>("finalize_requested_at_ms").expect("finalize marker"), None);
    assert_eq!(row.try_get::<String, _>("status").expect("status"), SESSION_STATUS_CONFIRMED);
  }
}
