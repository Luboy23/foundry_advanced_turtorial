use std::sync::Arc;

use axum::{
  extract::{Path, Query, State},
  http::StatusCode,
  Json,
};

use crate::{
  app_state::AppState,
  db::indexer::{query_history, query_indexer_status, query_leaderboard},
  errors::ApiError,
  models::{HealthResponse, PaginationQuery},
  parse_address,
};

pub async fn health() -> Json<HealthResponse> {
  Json(HealthResponse { ok: true })
}

pub async fn read_leaderboard(
  State(state): State<Arc<AppState>>,
  Query(query): Query<PaginationQuery>,
) -> Result<Json<Vec<crate::models::ReadModelLeaderboardEntry>>, ApiError> {
  let limit = query.limit.unwrap_or(20).clamp(1, 100);
  query_leaderboard(&state.db, limit)
    .await
    .map(Json)
    .map_err(ApiError::internal)
}

pub async fn read_history(
  State(state): State<Arc<AppState>>,
  Path(player): Path<String>,
  Query(query): Query<PaginationQuery>,
) -> Result<Json<Vec<crate::models::ReadModelHistoryEntry>>, ApiError> {
  let player =
    parse_address(&player).map_err(|error| ApiError::new(StatusCode::BAD_REQUEST, error.to_string()))?;
  let limit = query.limit.unwrap_or(20).clamp(1, 100);
  let offset = query.offset.unwrap_or(0);

  query_history(&state.db, player, limit, offset)
    .await
    .map(Json)
    .map_err(ApiError::internal)
}

pub async fn indexer_status(
  State(state): State<Arc<AppState>>,
) -> Result<Json<crate::models::IndexerStatusResponse>, ApiError> {
  query_indexer_status(&state.db)
    .await
    .map(Json)
    .map_err(ApiError::internal)
}
