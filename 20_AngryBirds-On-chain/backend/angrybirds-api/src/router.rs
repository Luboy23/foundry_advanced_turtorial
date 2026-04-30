use std::sync::Arc;

use axum::{
  http::{header, HeaderName, HeaderValue, Method},
  routing::{get, post},
  Router,
};
use tower_http::cors::{AllowOrigin, CorsLayer};

use crate::{
  app_state::AppState,
  handlers::{
    read_model::{health, indexer_status, read_history, read_leaderboard},
    runs::upload_run,
    sessions::{activate_session, create_session, finalize_session, session_status},
  },
};

fn is_allowed_dev_origin(origin: &HeaderValue) -> bool {
  let Ok(origin) = origin.to_str() else {
    return false;
  };

  origin.starts_with("http://127.0.0.1:")
    || origin.starts_with("http://localhost:")
    || origin.starts_with("http://[::1]:")
}

fn build_allowed_headers() -> [HeaderName; 4] {
  [
    header::CONTENT_TYPE,
    header::ACCEPT,
    HeaderName::from_static("x-request-id"),
    HeaderName::from_static("x-session-signature"),
  ]
}

fn build_exposed_headers() -> [HeaderName; 1] {
  [HeaderName::from_static("x-request-id")]
}

fn build_cors_layer() -> CorsLayer {
  CorsLayer::new()
    .allow_origin(AllowOrigin::predicate(|origin: &HeaderValue, _request_parts| {
      is_allowed_dev_origin(origin)
    }))
    .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
    .allow_headers(build_allowed_headers())
    .allow_credentials(false)
    .expose_headers(build_exposed_headers())
}

pub fn build_router(state: Arc<AppState>) -> Router {
  let cors = build_cors_layer();

  Router::new()
    .route("/api/health", get(health))
    .route("/api/sessions", post(create_session))
    .route("/api/sessions/activate", post(activate_session))
    .route("/api/runs", post(upload_run))
    .route("/api/sessions/:session_id/finalize", post(finalize_session))
    .route("/api/sessions/:session_id/status", get(session_status))
    .route("/api/leaderboard", get(read_leaderboard))
    .route("/api/history/:player", get(read_history))
    .route("/api/indexer/status", get(indexer_status))
    .layer(cors)
    .with_state(state)
}

#[cfg(test)]
mod tests {
  use super::{build_allowed_headers, is_allowed_dev_origin};
  use axum::http::{header, HeaderName, HeaderValue};

  #[test]
  fn allows_common_local_dev_origins() {
    assert!(is_allowed_dev_origin(&HeaderValue::from_static("http://127.0.0.1:5173")));
    assert!(is_allowed_dev_origin(&HeaderValue::from_static("http://localhost:4173")));
    assert!(is_allowed_dev_origin(&HeaderValue::from_static("http://[::1]:5174")));
  }

  #[test]
  fn rejects_non_local_origins() {
    assert!(!is_allowed_dev_origin(&HeaderValue::from_static("https://example.com")));
    assert!(!is_allowed_dev_origin(&HeaderValue::from_static("http://192.168.1.10:5173")));
  }

  #[test]
  fn allows_request_id_header_for_frontend_requests() {
    let headers = build_allowed_headers();
    assert!(headers.contains(&header::CONTENT_TYPE));
    assert!(headers.contains(&header::ACCEPT));
    assert!(headers.contains(&HeaderName::from_static("x-request-id")));
    assert!(headers.contains(&HeaderName::from_static("x-session-signature")));
  }
}
