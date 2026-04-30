use alloy::primitives::keccak256;
use axum::{
  body::Body,
  http::StatusCode,
};
use serde::Serialize;
use sqlx::SqlitePool;

use crate::{
  db::idempotency::{
    complete_idempotency_request, reserve_idempotency_request, IdempotencyReservation,
  },
  errors::{json_response, raw_json_response, ApiError},
  now_ms,
};

pub fn hash_request_bytes(bytes: &[u8]) -> String {
  format!("{:#x}", keccak256(bytes))
}

pub async fn execute_idempotent_json<T, F, Fut>(
  pool: &SqlitePool,
  route_key: &str,
  request_id: &str,
  request_hash: &str,
  operation: F,
) -> Result<axum::http::Response<Body>, ApiError>
where
  T: Serialize,
  F: FnOnce() -> Fut,
  Fut: std::future::Future<Output = Result<T, ApiError>>,
{
  match reserve_idempotency_request(pool, request_id, route_key, request_hash, now_ms())
    .await
    .map_err(ApiError::internal)?
  {
    IdempotencyReservation::Execute => {}
    IdempotencyReservation::Replay {
      response_status,
      response_body,
    } => {
      return raw_json_response(
        StatusCode::from_u16(response_status).unwrap_or(StatusCode::OK),
        response_body,
        request_id,
      )
    }
    IdempotencyReservation::InProgress => {
      return Err(ApiError::request_in_progress().with_request_id(request_id))
    }
    IdempotencyReservation::Conflict => {
      return Err(ApiError::request_id_conflict().with_request_id(request_id))
    }
  }

  match operation().await {
    Ok(payload) => {
      let response_body = serde_json::to_string(&payload).map_err(ApiError::internal)?;
      complete_idempotency_request(pool, request_id, StatusCode::OK.as_u16(), &response_body, now_ms())
        .await
        .map_err(ApiError::internal)?;
      json_response(StatusCode::OK, &payload, request_id)
    }
    Err(error) => {
      let error = error.with_request_id(request_id);
      let (status, response_body) = error.response_parts(request_id)?;
      complete_idempotency_request(pool, request_id, status.as_u16(), &response_body, now_ms())
        .await
        .map_err(ApiError::internal)?;
      raw_json_response(status, response_body, request_id)
    }
  }
}
