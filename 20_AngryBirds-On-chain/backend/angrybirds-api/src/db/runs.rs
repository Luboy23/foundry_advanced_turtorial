use alloy::primitives::{Address, B256};
use anyhow::Result;
use angrybirds_core::{RunEvidenceV1, VerifiedRunRecord};
use sqlx::{query, Row, SqlitePool, Sqlite, Transaction};

use crate::{
  format_address, format_b256, parse_b256,
  models::RUN_STATUS_VALIDATED,
};

pub async fn insert_validated_run(
  pool: &SqlitePool,
  session_id: B256,
  player: Address,
  evidence: &RunEvidenceV1,
  validated: &VerifiedRunRecord,
  received_at_ms: u64,
) -> Result<()> {
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
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?)
        "#,
  )
  .bind(format_b256(validated.run_id))
  .bind(format_b256(session_id))
  .bind(format_address(player))
  .bind(evidence.level_id.clone())
  .bind(i64::from(validated.level_version))
  .bind(i64::from(validated.birds_used))
  .bind(i64::from(validated.destroyed_pigs))
  .bind(i64::from(validated.duration_ms))
  .bind(format_b256(validated.evidence_hash))
  .bind(serde_json::to_string(evidence)?)
  .bind(RUN_STATUS_VALIDATED)
  .bind(received_at_ms as i64)
  .bind(received_at_ms as i64)
  .execute(pool)
  .await?;
  Ok(())
}

pub async fn insert_validated_run_tx(
  tx: &mut Transaction<'_, Sqlite>,
  session_id: B256,
  player: Address,
  evidence: &RunEvidenceV1,
  validated: &VerifiedRunRecord,
  received_at_ms: u64,
) -> Result<()> {
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
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?)
        "#,
  )
  .bind(format_b256(validated.run_id))
  .bind(format_b256(session_id))
  .bind(format_address(player))
  .bind(evidence.level_id.clone())
  .bind(i64::from(validated.level_version))
  .bind(i64::from(validated.birds_used))
  .bind(i64::from(validated.destroyed_pigs))
  .bind(i64::from(validated.duration_ms))
  .bind(format_b256(validated.evidence_hash))
  .bind(serde_json::to_string(evidence)?)
  .bind(RUN_STATUS_VALIDATED)
  .bind(received_at_ms as i64)
  .bind(received_at_ms as i64)
  .execute(&mut **tx)
  .await?;
  Ok(())
}

pub async fn count_session_runs(pool: &SqlitePool, session_id: B256) -> Result<i64> {
  let row = query("SELECT COUNT(*) AS count FROM session_runs WHERE session_id = ?")
    .bind(format_b256(session_id))
    .fetch_one(pool)
    .await?;
  Ok(row.try_get("count")?)
}

pub async fn count_runs_by_status(
  pool: &SqlitePool,
  session_id: B256,
  statuses: &[&str],
) -> Result<i64> {
  let in_clause = statuses.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
  let sql =
    format!("SELECT COUNT(*) AS count FROM session_runs WHERE session_id = ? AND status IN ({in_clause})");
  let mut db_query = query(&sql).bind(format_b256(session_id));
  for status in statuses {
    db_query = db_query.bind(status);
  }
  let row = db_query.fetch_one(pool).await?;
  Ok(row.try_get("count")?)
}

pub async fn load_runs_for_batch(
  pool: &SqlitePool,
  session_id: B256,
  max_batch_runs: usize,
  statuses: &[&str],
) -> Result<Vec<VerifiedRunRecord>> {
  let status_in = statuses.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
  let sql = format!(
    r#"
      SELECT run_id, level_id, level_version, birds_used, destroyed_pigs, duration_ms, evidence_hash
      FROM session_runs
      WHERE session_id = ? AND status IN ({status_in})
      ORDER BY received_at_ms ASC
      LIMIT ?
      "#
  );
  let mut db_query = query(&sql).bind(format_b256(session_id));
  for status in statuses {
    db_query = db_query.bind(status);
  }
  let rows = db_query.bind(max_batch_runs as i64).fetch_all(pool).await?;

  rows
    .iter()
    .map(|row| -> Result<VerifiedRunRecord> {
      Ok(VerifiedRunRecord {
        run_id: parse_b256(&row.try_get::<String, _>("run_id")?)?,
        level_id: angrybirds_core::parse_level_id(&row.try_get::<String, _>("level_id")?)?,
        level_version: row.try_get::<i64, _>("level_version")? as u32,
        birds_used: row.try_get::<i64, _>("birds_used")? as u8,
        destroyed_pigs: row.try_get::<i64, _>("destroyed_pigs")? as u16,
        duration_ms: row.try_get::<i64, _>("duration_ms")? as u32,
        evidence_hash: parse_b256(&row.try_get::<String, _>("evidence_hash")?)?,
      })
    })
    .collect()
}
