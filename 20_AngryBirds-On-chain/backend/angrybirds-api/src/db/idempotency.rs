use std::time::Duration;

use anyhow::Result;
use sqlx::{query, Row, SqlitePool};

pub const IDEMPOTENCY_STATE_PENDING: &str = "pending";
pub const IDEMPOTENCY_STATE_COMPLETED: &str = "completed";

pub enum IdempotencyReservation {
  Execute,
  Replay { response_status: u16, response_body: String },
  InProgress,
  Conflict,
}

const SQLITE_BUSY_RETRY_ATTEMPTS: usize = 8;
const SQLITE_BUSY_RETRY_DELAY_MS: u64 = 25;

fn is_sqlite_busy(error: &sqlx::Error) -> bool {
  match error {
    sqlx::Error::Database(db_error) => {
      matches!(db_error.code().as_deref(), Some("5") | Some("6"))
        || db_error.message().contains("database is locked")
        || db_error.message().contains("database table is locked")
    }
    _ => false,
  }
}

fn is_unique_violation(error: &sqlx::Error) -> bool {
  matches!(error, sqlx::Error::Database(db_error) if db_error.is_unique_violation())
}

pub async fn reserve_idempotency_request(
  pool: &SqlitePool,
  request_id: &str,
  route_key: &str,
  request_hash: &str,
  now_ms: u64,
) -> Result<IdempotencyReservation> {
  let insert_result = run_with_busy_retry(|| async {
    query(
      r#"
        INSERT INTO idempotency_requests (
          request_id,
          route_key,
          request_hash,
          state,
          response_status,
          response_body,
          created_at_ms,
          updated_at_ms
        )
        VALUES (?, ?, ?, ?, NULL, NULL, ?, ?)
      "#,
    )
    .bind(request_id)
    .bind(route_key)
    .bind(request_hash)
    .bind(IDEMPOTENCY_STATE_PENDING)
    .bind(now_ms as i64)
    .bind(now_ms as i64)
    .execute(pool)
    .await
  })
  .await;

  if insert_result.is_ok() {
    return Ok(IdempotencyReservation::Execute);
  }

  let insert_error = insert_result.expect_err("idempotency insert should fail before duplicate resolution");
  if !is_unique_violation(&insert_error) {
    return Err(insert_error.into());
  }

  let row = run_with_busy_retry(|| async {
    query(
      r#"
        SELECT route_key, request_hash, state, response_status, response_body
        FROM idempotency_requests
        WHERE request_id = ?
      "#,
    )
    .bind(request_id)
    .fetch_one(pool)
    .await
  })
  .await?;

  let existing_route_key = row.try_get::<String, _>("route_key")?;
  let existing_request_hash = row.try_get::<String, _>("request_hash")?;
  if existing_route_key != route_key || existing_request_hash != request_hash {
    return Ok(IdempotencyReservation::Conflict);
  }

  let state = row.try_get::<String, _>("state")?;
  if state == IDEMPOTENCY_STATE_COMPLETED {
    let response_status = row.try_get::<i64, _>("response_status")? as u16;
    let response_body = row.try_get::<String, _>("response_body")?;
    return Ok(IdempotencyReservation::Replay {
      response_status,
      response_body,
    });
  }

  Ok(IdempotencyReservation::InProgress)
}

pub async fn complete_idempotency_request(
  pool: &SqlitePool,
  request_id: &str,
  response_status: u16,
  response_body: &str,
  now_ms: u64,
) -> Result<()> {
  run_with_busy_retry(|| async {
    query(
      r#"
        UPDATE idempotency_requests
        SET state = ?, response_status = ?, response_body = ?, updated_at_ms = ?
        WHERE request_id = ?
      "#,
    )
    .bind(IDEMPOTENCY_STATE_COMPLETED)
    .bind(i64::from(response_status))
    .bind(response_body)
    .bind(now_ms as i64)
    .bind(request_id)
    .execute(pool)
    .await
  })
  .await?;
  Ok(())
}

async fn run_with_busy_retry<T, F, Fut>(mut operation: F) -> Result<T, sqlx::Error>
where
  F: FnMut() -> Fut,
  Fut: std::future::Future<Output = Result<T, sqlx::Error>>,
{
  let mut attempt = 0;
  loop {
    match operation().await {
      Ok(value) => return Ok(value),
      Err(error) if is_sqlite_busy(&error) && attempt + 1 < SQLITE_BUSY_RETRY_ATTEMPTS => {
        attempt += 1;
        tokio::time::sleep(Duration::from_millis(SQLITE_BUSY_RETRY_DELAY_MS)).await;
      }
      Err(error) => return Err(error),
    }
  }
}
