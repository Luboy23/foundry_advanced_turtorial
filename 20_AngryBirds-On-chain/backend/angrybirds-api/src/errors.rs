use std::sync::atomic::{AtomicU64, Ordering};

use anyhow::anyhow;
use axum::{
  body::Body,
  http::{header, HeaderMap, HeaderName, HeaderValue, Response, StatusCode},
  response::IntoResponse,
};
use serde::Serialize;
use tracing::error;

static REQUEST_COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Clone)]
pub struct ApiError {
  pub status: StatusCode,
  pub code: &'static str,
  pub message: String,
  pub request_id: Option<String>,
  internal_detail: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ApiErrorBody<'a> {
  code: &'a str,
  message: &'a str,
  request_id: &'a str,
}

impl ApiError {
  pub fn new(status: StatusCode, message: impl Into<String>) -> Self {
    Self {
      status,
      code: default_code_for_status(status),
      message: message.into(),
      request_id: None,
      internal_detail: None,
    }
  }

  pub fn internal(error: impl Into<anyhow::Error>) -> Self {
    Self {
      status: StatusCode::INTERNAL_SERVER_ERROR,
      code: "internal_error",
      message: "后端处理失败，请稍后重试。".to_string(),
      request_id: None,
      internal_detail: Some(anyhow!(error).to_string()),
    }
  }

  pub fn with_request_id(mut self, request_id: impl Into<String>) -> Self {
    self.request_id = Some(request_id.into());
    self
  }

  pub fn with_code(mut self, code: &'static str) -> Self {
    self.code = code;
    self
  }

  pub fn session_auth_failed(message: impl Into<String>) -> Self {
    Self::new(StatusCode::FORBIDDEN, message).with_code("session_auth_failed")
  }

  pub fn request_in_progress() -> Self {
    Self::new(StatusCode::CONFLICT, "相同请求仍在处理中，请稍后重试。").with_code("request_in_progress")
  }

  pub fn request_id_conflict() -> Self {
    Self::new(StatusCode::CONFLICT, "相同 request id 对应了不同请求内容。").with_code("request_id_conflict")
  }

  pub fn response_parts(&self, fallback_request_id: &str) -> Result<(StatusCode, String), ApiError> {
    let request_id = self.request_id.as_deref().unwrap_or(fallback_request_id);
    if let Some(detail) = &self.internal_detail {
      error!(
        request_id = %request_id,
        status = self.status.as_u16(),
        code = self.code,
        detail = %detail,
        "request failed"
      );
    }

    let body = serde_json::to_string(&ApiErrorBody {
      code: self.code,
      message: &self.message,
      request_id,
    })
    .map_err(ApiError::internal)?;

    Ok((self.status, body))
  }

  pub fn into_response_with_request_id(self, fallback_request_id: &str) -> Result<Response<Body>, ApiError> {
    let request_id = self.request_id.clone().unwrap_or_else(|| fallback_request_id.to_string());
    let (status, body) = self.response_parts(&request_id)?;
    raw_json_response(status, body, &request_id)
  }
}

impl IntoResponse for ApiError {
  fn into_response(self) -> Response<Body> {
    let request_id = self.request_id.clone().unwrap_or_else(generate_request_id);
    match self.into_response_with_request_id(&request_id) {
      Ok(response) => response,
      Err(_error) => {
        let fallback = serde_json::json!({
          "code": "internal_error",
          "message": "后端处理失败，请稍后重试。",
          "requestId": request_id,
        })
        .to_string();
        raw_json_response(StatusCode::INTERNAL_SERVER_ERROR, fallback, &request_id)
          .expect("fallback error response")
          .into_response()
      }
    }
  }
}

pub fn generate_request_id() -> String {
  format!(
    "srv-{}-{}",
    std::time::SystemTime::now()
      .duration_since(std::time::UNIX_EPOCH)
      .expect("unix time")
      .as_millis(),
    REQUEST_COUNTER.fetch_add(1, Ordering::Relaxed),
  )
}

pub fn resolve_request_id(headers: &HeaderMap) -> String {
  match headers.get("x-request-id").and_then(|value| value.to_str().ok()) {
    Some(value) if !value.trim().is_empty() => value.trim().to_string(),
    _ => generate_request_id(),
  }
}

pub fn require_request_id(headers: &HeaderMap) -> Result<String, ApiError> {
  match headers.get("x-request-id").and_then(|value| value.to_str().ok()) {
    Some(value) if !value.trim().is_empty() => Ok(value.trim().to_string()),
    _ => Err(ApiError::new(StatusCode::BAD_REQUEST, "缺少 x-request-id 请求头。")),
  }
}

pub fn json_response<T: Serialize>(
  status: StatusCode,
  payload: &T,
  request_id: &str,
) -> Result<Response<Body>, ApiError> {
  let body = serde_json::to_string(payload).map_err(ApiError::internal)?;
  raw_json_response(status, body, request_id)
}

pub fn raw_json_response(
  status: StatusCode,
  body: String,
  request_id: &str,
) -> Result<Response<Body>, ApiError> {
  let mut response = Response::new(Body::from(body));
  *response.status_mut() = status;
  response.headers_mut().insert(
    header::CONTENT_TYPE,
    HeaderValue::from_static("application/json"),
  );
  response.headers_mut().insert(
    HeaderName::from_static("x-request-id"),
    HeaderValue::from_str(request_id).map_err(ApiError::internal)?,
  );
  Ok(response)
}

fn default_code_for_status(status: StatusCode) -> &'static str {
  match status {
    StatusCode::BAD_REQUEST => "bad_request",
    StatusCode::NOT_FOUND => "session_not_found",
    StatusCode::FORBIDDEN => "session_auth_failed",
    StatusCode::GONE => "session_expired",
    StatusCode::UNPROCESSABLE_ENTITY => "validation_failed",
    StatusCode::CONFLICT => "conflict",
    StatusCode::INTERNAL_SERVER_ERROR => "internal_error",
    _ => "api_error",
  }
}
