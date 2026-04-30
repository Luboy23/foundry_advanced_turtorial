use std::{str::FromStr, sync::Arc};

use alloy::primitives::{Address, B256};
use anyhow::{Context, Result};
use axum::Router;
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions};
use tracing::info;

pub mod app_state;
pub mod chain_client;
pub mod config;
pub mod db;
pub mod errors;
pub mod handlers;
pub mod idempotency;
pub mod indexer;
pub mod models;
pub mod relay;
pub mod router;
#[cfg(test)]
pub mod test_support;

use app_state::{build_app_state, AppState};
use config::load_config;

pub async fn run() -> Result<()> {
  let config = load_config()?;
  let sqlite_options = SqliteConnectOptions::from_str(&config.database_url)
    .context("parse sqlite connection options")?
    .create_if_missing(true)
    .busy_timeout(std::time::Duration::from_secs(5))
    .journal_mode(SqliteJournalMode::Wal);
  let db = SqlitePoolOptions::new()
    .max_connections(5)
    .connect_with(sqlite_options)
    .await
    .context("connect sqlite")?;
  db::init_db(&db).await?;

  let state = build_app_state(config, db)?;
  relay::spawn_relay_worker(state.clone());
  indexer::spawn_indexer_worker(state.clone());

  let app = build_router(state.clone());
  info!(
    bind = %state.config.bind,
    deployment_id = %state.config.deployment_id,
    database_url = %state.config.database_url,
    scoreboard = %state.config.scoreboard_address,
    level_catalog = %state.config.level_catalog_address,
    "angrybirds-api listening"
  );
  let listener = tokio::net::TcpListener::bind(state.config.bind).await?;
  axum::serve(listener, app).await?;
  Ok(())
}

pub fn build_router(state: Arc<AppState>) -> Router {
  router::build_router(state)
}

pub(crate) fn now_ms() -> u64 {
  std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .expect("unix time")
    .as_millis() as u64
}

pub(crate) fn format_address(address: Address) -> String {
  format!("{address:#x}")
}

pub(crate) fn format_b256(value: B256) -> String {
  format!("{value:#x}")
}

pub(crate) fn parse_address(value: &str) -> Result<Address> {
  Address::from_str(value).with_context(|| format!("parse address {value}"))
}

pub(crate) fn parse_b256(value: &str) -> Result<B256> {
  B256::from_str(value).with_context(|| format!("parse bytes32 {value}"))
}
