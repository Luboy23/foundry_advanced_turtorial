use alloy::primitives::Address;
use anyhow::Result;
use sqlx::{query, Row, SqlitePool};

use crate::{
  format_address, format_b256, models::{
    IndexedGlobalBestProjection, IndexedPlayerRunProjection, IndexerCursorRow, IndexerStatusResponse,
    ReadModelHistoryEntry, ReadModelLeaderboardEntry, ReadModelRunResult, INDEXER_CURSOR_KEY,
    INDEXER_STATUS_IDLE,
  }, now_ms, parse_address, parse_b256,
};

pub async fn load_indexer_cursor(pool: &SqlitePool) -> Result<Option<IndexerCursorRow>> {
  let row = query(
    r#"
        SELECT status, last_processed_block, last_processed_log_index, last_error
        FROM indexer_cursors
        WHERE cursor_key = ?
        "#,
  )
  .bind(INDEXER_CURSOR_KEY)
  .fetch_optional(pool)
  .await?;

  row
    .map(|row| {
      Ok(IndexerCursorRow {
        status: row.try_get("status")?,
        last_processed_block: row.try_get::<i64, _>("last_processed_block")? as u64,
        last_processed_log_index: row.try_get("last_processed_log_index")?,
        last_error: row.try_get("last_error")?,
      })
    })
    .transpose()
}

pub async fn update_indexer_status(
  pool: &SqlitePool,
  status: &str,
  last_processed_block: Option<u64>,
  last_processed_log_index: Option<i64>,
  last_error: Option<&str>,
) -> Result<()> {
  query(
    r#"
        INSERT INTO indexer_cursors (
            cursor_key,
            status,
            last_processed_block,
            last_processed_log_index,
            last_error,
            updated_at_ms
        )
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(cursor_key) DO UPDATE
        SET status = excluded.status,
            last_processed_block = COALESCE(excluded.last_processed_block, indexer_cursors.last_processed_block),
            last_processed_log_index = COALESCE(excluded.last_processed_log_index, indexer_cursors.last_processed_log_index),
            last_error = excluded.last_error,
            updated_at_ms = excluded.updated_at_ms
        "#,
  )
  .bind(INDEXER_CURSOR_KEY)
  .bind(status)
  .bind(last_processed_block.map(|value| value as i64))
  .bind(last_processed_log_index)
  .bind(last_error)
  .bind(now_ms() as i64)
  .execute(pool)
  .await?;
  Ok(())
}

pub async fn insert_player_run_projection(
  pool: &SqlitePool,
  projection: &IndexedPlayerRunProjection,
) -> Result<()> {
  query(
    r#"
      INSERT INTO indexed_player_runs (
          player,
          level_id,
          level_version,
          birds_used,
          destroyed_pigs,
          duration_ms,
          evidence_hash,
          submitted_at_ms,
          tx_hash,
          block_number,
          log_index,
          created_at_ms,
          updated_at_ms
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tx_hash, log_index) DO NOTHING
      "#,
  )
  .bind(format_address(projection.player))
  .bind(&projection.level_id)
  .bind(i64::from(projection.level_version))
  .bind(i64::from(projection.birds_used))
  .bind(i64::from(projection.destroyed_pigs))
  .bind(i64::from(projection.duration_ms))
  .bind(format_b256(projection.evidence_hash))
  .bind(projection.submitted_at_ms as i64)
  .bind(format_b256(projection.tx_hash))
  .bind(projection.block_number as i64)
  .bind(projection.log_index as i64)
  .bind(now_ms() as i64)
  .bind(now_ms() as i64)
  .execute(pool)
  .await?;
  Ok(())
}

pub async fn upsert_global_best_projection(
  pool: &SqlitePool,
  projection: &IndexedGlobalBestProjection,
) -> Result<()> {
  query(
    r#"
      INSERT INTO indexed_global_bests (
        player,
        level_id,
        level_version,
        level_order,
        birds_used,
        destroyed_pigs,
        duration_ms,
        evidence_hash,
        submitted_at_ms,
        updated_at_ms
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(player) DO UPDATE
      SET level_id = excluded.level_id,
          level_version = excluded.level_version,
          level_order = excluded.level_order,
          birds_used = excluded.birds_used,
          destroyed_pigs = excluded.destroyed_pigs,
          duration_ms = excluded.duration_ms,
          evidence_hash = excluded.evidence_hash,
          submitted_at_ms = excluded.submitted_at_ms,
          updated_at_ms = excluded.updated_at_ms
      "#,
  )
  .bind(format_address(projection.player))
  .bind(&projection.level_id)
  .bind(i64::from(projection.level_version))
  .bind(i64::from(projection.level_order))
  .bind(i64::from(projection.birds_used))
  .bind(i64::from(projection.destroyed_pigs))
  .bind(i64::from(projection.duration_ms))
  .bind(format_b256(projection.evidence_hash))
  .bind(projection.submitted_at_ms as i64)
  .bind(now_ms() as i64)
  .execute(pool)
  .await?;
  Ok(())
}

pub async fn query_leaderboard(pool: &SqlitePool, limit: u32) -> Result<Vec<ReadModelLeaderboardEntry>> {
  let rows = query(
    r#"
        SELECT
            player,
            level_id,
            level_version,
            birds_used,
            destroyed_pigs,
            duration_ms,
            evidence_hash,
            submitted_at_ms
        FROM indexed_global_bests
        ORDER BY level_order DESC, birds_used ASC, duration_ms ASC, submitted_at_ms ASC
        LIMIT ?
        "#,
  )
  .bind(limit as i64)
  .fetch_all(pool)
  .await?;

  rows
    .into_iter()
    .map(|row| -> Result<ReadModelLeaderboardEntry> {
      Ok(ReadModelLeaderboardEntry {
        player: parse_address(&row.try_get::<String, _>("player")?)?,
        result: map_run_result(&row)?,
      })
    })
    .collect()
}

pub async fn query_history(
  pool: &SqlitePool,
  player: Address,
  limit: u32,
  offset: u32,
) -> Result<Vec<ReadModelHistoryEntry>> {
  let rows = query(
    r#"
        SELECT
            player,
            level_id,
            level_version,
            birds_used,
            destroyed_pigs,
            duration_ms,
            evidence_hash,
            submitted_at_ms
        FROM indexed_player_runs
        WHERE player = ?
        ORDER BY submitted_at_ms DESC, block_number DESC, log_index DESC
        LIMIT ? OFFSET ?
        "#,
  )
  .bind(format_address(player))
  .bind(limit as i64)
  .bind(offset as i64)
  .fetch_all(pool)
  .await?;

  rows
    .into_iter()
    .map(|row| -> Result<ReadModelHistoryEntry> {
      Ok(ReadModelHistoryEntry {
        player: parse_address(&row.try_get::<String, _>("player")?)?,
        result: map_run_result(&row)?,
      })
    })
    .collect()
}

pub async fn query_indexer_status(pool: &SqlitePool) -> Result<IndexerStatusResponse> {
  let row = query(
    r#"
        SELECT status, last_processed_block, last_processed_log_index, last_error
        FROM indexer_cursors
        WHERE cursor_key = ?
        "#,
  )
  .bind(INDEXER_CURSOR_KEY)
  .fetch_optional(pool)
  .await?;

  Ok(if let Some(row) = row {
    IndexerStatusResponse {
      ok: true,
      status: row.try_get("status")?,
      last_processed_block: row.try_get::<i64, _>("last_processed_block")? as u64,
      last_processed_log_index: row.try_get("last_processed_log_index")?,
      last_error: row.try_get("last_error")?,
    }
  } else {
    IndexerStatusResponse {
      ok: true,
      status: INDEXER_STATUS_IDLE.to_string(),
      last_processed_block: 0,
      last_processed_log_index: -1,
      last_error: None,
    }
  })
}

fn map_run_result(row: &sqlx::sqlite::SqliteRow) -> Result<ReadModelRunResult> {
  Ok(ReadModelRunResult {
    level_id: row.try_get("level_id")?,
    level_version: row.try_get::<i64, _>("level_version")? as u32,
    birds_used: row.try_get::<i64, _>("birds_used")? as u8,
    destroyed_pigs: row.try_get::<i64, _>("destroyed_pigs")? as u16,
    duration_ms: row.try_get::<i64, _>("duration_ms")? as u32,
    evidence_hash: parse_b256(&row.try_get::<String, _>("evidence_hash")?)?,
    submitted_at: row.try_get::<i64, _>("submitted_at_ms")? as u64,
  })
}

#[cfg(test)]
mod tests {
  use alloy::primitives::Address;

  use super::{insert_player_run_projection, query_history, query_leaderboard, upsert_global_best_projection};
  use crate::{
    models::{IndexedGlobalBestProjection, IndexedPlayerRunProjection},
    test_support::test_pool,
  };

  #[tokio::test]
  async fn indexer_projections_fill_read_models() {
    let pool = test_pool("indexer-projections").await;
    let player = Address::repeat_byte(0x11);
    let evidence_hash = alloy::primitives::keccak256("evidence-1".as_bytes());
    let tx_hash = alloy::primitives::keccak256("tx-1".as_bytes());

    insert_player_run_projection(
      &pool,
      &IndexedPlayerRunProjection {
        player,
        level_id: "level-1".to_string(),
        level_version: 1,
        birds_used: 2,
        destroyed_pigs: 4,
        duration_ms: 12_000,
        evidence_hash,
        submitted_at_ms: 1_717_171_717,
        tx_hash,
        block_number: 10,
        log_index: 0,
      },
    )
    .await
    .expect("project run");

    upsert_global_best_projection(
      &pool,
      &IndexedGlobalBestProjection {
        player,
        level_id: "level-1".to_string(),
        level_version: 1,
        level_order: 2,
        birds_used: 2,
        destroyed_pigs: 4,
        duration_ms: 12_000,
        evidence_hash,
        submitted_at_ms: 1_717_171_717,
      },
    )
    .await
    .expect("project best");

    let history = query_history(&pool, player, 20, 0).await.expect("history");
    let leaderboard = query_leaderboard(&pool, 20).await.expect("leaderboard");

    assert_eq!(history.len(), 1);
    assert_eq!(leaderboard.len(), 1);
    assert_eq!(leaderboard[0].result.birds_used, 2);
    assert_eq!(history[0].result.destroyed_pigs, 4);
  }

  #[tokio::test]
  async fn leaderboard_prefers_higher_level_order_before_efficiency() {
    let pool = test_pool("indexer-leaderboard-order").await;
    let higher_level_player = Address::repeat_byte(0x21);
    let lower_level_player = Address::repeat_byte(0x22);

    upsert_global_best_projection(
      &pool,
      &IndexedGlobalBestProjection {
        player: lower_level_player,
        level_id: "level-1".to_string(),
        level_version: 1,
        level_order: 2,
        birds_used: 1,
        destroyed_pigs: 4,
        duration_ms: 9_000,
        evidence_hash: alloy::primitives::keccak256("lower-level".as_bytes()),
        submitted_at_ms: 1_717_171_717,
      },
    )
    .await
    .expect("project lower level best");

    upsert_global_best_projection(
      &pool,
      &IndexedGlobalBestProjection {
        player: higher_level_player,
        level_id: "level-4".to_string(),
        level_version: 1,
        level_order: 5,
        birds_used: 3,
        destroyed_pigs: 4,
        duration_ms: 20_000,
        evidence_hash: alloy::primitives::keccak256("higher-level".as_bytes()),
        submitted_at_ms: 1_717_171_718,
      },
    )
    .await
    .expect("project higher level best");

    let leaderboard = query_leaderboard(&pool, 20).await.expect("leaderboard");

    assert_eq!(leaderboard.len(), 2);
    assert_eq!(leaderboard[0].player, higher_level_player);
    assert_eq!(leaderboard[0].result.level_id, "level-4");
    assert_eq!(leaderboard[1].player, lower_level_player);
  }
}
