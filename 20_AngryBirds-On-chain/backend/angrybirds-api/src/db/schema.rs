use anyhow::Result;
use sqlx::{query, Row, SqlitePool};

pub async fn init_db(pool: &SqlitePool) -> Result<()> {
  query(
    r#"
        CREATE TABLE IF NOT EXISTS player_session_counters (
            player TEXT PRIMARY KEY,
            next_nonce INTEGER NOT NULL,
            updated_at_ms INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS game_sessions (
            session_id TEXT PRIMARY KEY,
            player TEXT NOT NULL,
            delegate TEXT NOT NULL,
            permit_nonce INTEGER NOT NULL,
            permit_json TEXT NOT NULL,
            permit_signature TEXT,
            status TEXT NOT NULL,
            deployment_id TEXT NOT NULL,
            last_error TEXT,
            created_at_ms INTEGER NOT NULL,
            updated_at_ms INTEGER NOT NULL,
            last_activity_ms INTEGER NOT NULL,
            finalize_requested_at_ms INTEGER
        );

        CREATE TABLE IF NOT EXISTS session_runs (
            run_id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            player TEXT NOT NULL,
            level_id TEXT NOT NULL,
            level_version INTEGER NOT NULL,
            birds_used INTEGER NOT NULL,
            destroyed_pigs INTEGER NOT NULL,
            duration_ms INTEGER NOT NULL,
            evidence_hash TEXT NOT NULL,
            evidence_json TEXT NOT NULL,
            status TEXT NOT NULL,
            batch_id TEXT,
            tx_hash TEXT,
            validation_error TEXT,
            received_at_ms INTEGER NOT NULL,
            updated_at_ms INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS relay_batches (
            batch_id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            player TEXT NOT NULL,
            run_ids_json TEXT NOT NULL,
            tx_hash TEXT,
            status TEXT NOT NULL,
            fail_reason TEXT,
            submitted_at_ms INTEGER,
            confirmed_at_ms INTEGER,
            created_at_ms INTEGER NOT NULL,
            updated_at_ms INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS idempotency_requests (
            request_id TEXT PRIMARY KEY,
            route_key TEXT NOT NULL,
            request_hash TEXT NOT NULL,
            state TEXT NOT NULL,
            response_status INTEGER,
            response_body TEXT,
            created_at_ms INTEGER NOT NULL,
            updated_at_ms INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS indexer_cursors (
            cursor_key TEXT PRIMARY KEY,
            status TEXT NOT NULL,
            last_processed_block INTEGER NOT NULL DEFAULT 0,
            last_processed_log_index INTEGER NOT NULL DEFAULT -1,
            last_error TEXT,
            updated_at_ms INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS indexed_player_runs (
            player TEXT NOT NULL,
            level_id TEXT NOT NULL,
            level_version INTEGER NOT NULL,
            birds_used INTEGER NOT NULL,
            destroyed_pigs INTEGER NOT NULL,
            duration_ms INTEGER NOT NULL,
            evidence_hash TEXT NOT NULL,
            submitted_at_ms INTEGER NOT NULL,
            tx_hash TEXT NOT NULL,
            block_number INTEGER NOT NULL,
            log_index INTEGER NOT NULL,
            created_at_ms INTEGER NOT NULL,
            updated_at_ms INTEGER NOT NULL,
            PRIMARY KEY (tx_hash, log_index)
        );

        CREATE TABLE IF NOT EXISTS indexed_global_bests (
            player TEXT PRIMARY KEY,
            level_id TEXT NOT NULL,
            level_version INTEGER NOT NULL,
            level_order INTEGER NOT NULL DEFAULT 0,
            birds_used INTEGER NOT NULL,
            destroyed_pigs INTEGER NOT NULL,
            duration_ms INTEGER NOT NULL,
            evidence_hash TEXT NOT NULL,
            submitted_at_ms INTEGER NOT NULL,
            updated_at_ms INTEGER NOT NULL
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_game_sessions_player_nonce
            ON game_sessions(player, permit_nonce);
        CREATE INDEX IF NOT EXISTS idx_game_sessions_status
            ON game_sessions(status, updated_at_ms);
        CREATE INDEX IF NOT EXISTS idx_game_sessions_deployment_status
            ON game_sessions(deployment_id, status, updated_at_ms);
        CREATE INDEX IF NOT EXISTS idx_session_runs_session_status_received
            ON session_runs(session_id, status, received_at_ms);
        CREATE INDEX IF NOT EXISTS idx_session_runs_batch
            ON session_runs(batch_id);
        CREATE INDEX IF NOT EXISTS idx_relay_batches_status_updated
            ON relay_batches(status, updated_at_ms);
        CREATE INDEX IF NOT EXISTS idx_relay_batches_session_created
            ON relay_batches(session_id, created_at_ms);
        CREATE INDEX IF NOT EXISTS idx_idempotency_route_state
            ON idempotency_requests(route_key, state, updated_at_ms);
        CREATE INDEX IF NOT EXISTS idx_indexed_player_runs_player_submitted
            ON indexed_player_runs(player, submitted_at_ms DESC, block_number DESC, log_index DESC);
        "#,
  )
  .execute(pool)
  .await?;

  ensure_game_sessions_columns(pool).await?;
  ensure_indexed_global_bests_columns(pool).await?;

  query("DROP INDEX IF EXISTS idx_indexed_global_bests_ordering")
    .execute(pool)
    .await?;
  query(
    r#"
      CREATE INDEX IF NOT EXISTS idx_indexed_global_bests_ordering
          ON indexed_global_bests(level_order DESC, birds_used ASC, duration_ms ASC, submitted_at_ms ASC)
    "#,
  )
  .execute(pool)
  .await?;

  Ok(())
}

async fn ensure_game_sessions_columns(pool: &SqlitePool) -> Result<()> {
  let columns = query("PRAGMA table_info(game_sessions)")
    .fetch_all(pool)
    .await?;
  let has_accepted_run_count = columns
    .iter()
    .any(|row| row.try_get::<String, _>("name").ok().as_deref() == Some("accepted_run_count"));

  if !has_accepted_run_count {
    query(
      "ALTER TABLE game_sessions ADD COLUMN accepted_run_count INTEGER NOT NULL DEFAULT 0",
    )
    .execute(pool)
    .await?;
  }

  query(
    r#"
      UPDATE game_sessions
      SET accepted_run_count = (
        SELECT COUNT(*)
        FROM session_runs
        WHERE session_runs.session_id = game_sessions.session_id
      )
      WHERE accepted_run_count IS NULL OR accepted_run_count = 0
    "#,
  )
  .execute(pool)
  .await?;

  Ok(())
}

async fn ensure_indexed_global_bests_columns(pool: &SqlitePool) -> Result<()> {
  let columns = query("PRAGMA table_info(indexed_global_bests)")
    .fetch_all(pool)
    .await?;
  let has_level_order = columns
    .iter()
    .any(|row| row.try_get::<String, _>("name").ok().as_deref() == Some("level_order"));

  if !has_level_order {
    query(
      "ALTER TABLE indexed_global_bests ADD COLUMN level_order INTEGER NOT NULL DEFAULT 0",
    )
    .execute(pool)
    .await?;
  }

  query(
    r#"
      UPDATE indexed_global_bests
      SET level_order = CASE
        WHEN level_id LIKE 'level-%' THEN CAST(SUBSTR(level_id, 7) AS INTEGER) + 1
        ELSE level_order
      END
      WHERE level_order = 0
    "#,
  )
  .execute(pool)
  .await?;

  Ok(())
}
