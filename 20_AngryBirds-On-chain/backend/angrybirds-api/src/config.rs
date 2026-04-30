use std::{env, net::SocketAddr, str::FromStr};

use alloy::{primitives::Address, signers::local::PrivateKeySigner};
use anyhow::{Context, Result};

#[derive(Clone)]
pub struct AppConfig {
  pub bind: SocketAddr,
  pub database_url: String,
  pub rpc_url: String,
  pub chain_id: u64,
  pub deployment_id: String,
  pub scoreboard_address: Address,
  pub level_catalog_address: Address,
  pub session_ttl_seconds: u64,
  pub session_max_runs: u16,
  pub max_batch_runs: usize,
  pub auto_finalize_idle_seconds: u64,
  pub indexer_poll_interval_ms: u64,
  pub indexer_confirmations: u64,
}

pub fn load_config() -> Result<AppConfig> {
  Ok(AppConfig {
    bind: env::var("ANGRY_BIRDS_API_BIND")
      .unwrap_or_else(|_| "127.0.0.1:8788".to_string())
      .parse()
      .context("parse ANGRY_BIRDS_API_BIND")?,
    database_url: env::var("ANGRY_BIRDS_DATABASE_URL")
      .unwrap_or_else(|_| "sqlite://./angrybirds.sqlite".to_string()),
    rpc_url: env::var("ANGRY_BIRDS_RPC_URL")
      .unwrap_or_else(|_| "http://127.0.0.1:8545".to_string()),
    chain_id: env::var("ANGRY_BIRDS_CHAIN_ID")
      .unwrap_or_else(|_| "31337".to_string())
      .parse()
      .context("parse ANGRY_BIRDS_CHAIN_ID")?,
    deployment_id: env::var("ANGRY_BIRDS_DEPLOYMENT_ID")
      .unwrap_or_else(|_| "local-dev".to_string()),
    scoreboard_address: parse_address_env("ANGRY_BIRDS_SCOREBOARD_ADDRESS")?,
    level_catalog_address: parse_address_env("ANGRY_BIRDS_LEVEL_CATALOG_ADDRESS")?,
    session_ttl_seconds: env::var("ANGRY_BIRDS_SESSION_TTL_SECONDS")
      .unwrap_or_else(|_| "7200".to_string())
      .parse()
      .context("parse ANGRY_BIRDS_SESSION_TTL_SECONDS")?,
    session_max_runs: env::var("ANGRY_BIRDS_SESSION_MAX_RUNS")
      .unwrap_or_else(|_| "10".to_string())
      .parse()
      .context("parse ANGRY_BIRDS_SESSION_MAX_RUNS")?,
    max_batch_runs: env::var("ANGRY_BIRDS_MAX_BATCH_RUNS")
      .unwrap_or_else(|_| "8".to_string())
      .parse()
      .context("parse ANGRY_BIRDS_MAX_BATCH_RUNS")?,
    auto_finalize_idle_seconds: env::var("ANGRY_BIRDS_AUTO_FINALIZE_IDLE_SECONDS")
      .unwrap_or_else(|_| "45".to_string())
      .parse()
      .context("parse ANGRY_BIRDS_AUTO_FINALIZE_IDLE_SECONDS")?,
    indexer_poll_interval_ms: env::var("ANGRY_BIRDS_INDEXER_POLL_INTERVAL_MS")
      .unwrap_or_else(|_| "3000".to_string())
      .parse()
      .context("parse ANGRY_BIRDS_INDEXER_POLL_INTERVAL_MS")?,
    indexer_confirmations: env::var("ANGRY_BIRDS_INDEXER_CONFIRMATIONS")
      .unwrap_or_else(|_| "0".to_string())
      .parse()
      .context("parse ANGRY_BIRDS_INDEXER_CONFIRMATIONS")?,
  })
}

pub fn parse_address_env(name: &str) -> Result<Address> {
  let value = env::var(name).with_context(|| format!("missing {name}"))?;
  Address::from_str(&value).with_context(|| format!("parse {name}"))
}

pub fn parse_signer_env(name: &str) -> Result<PrivateKeySigner> {
  let value = env::var(name).with_context(|| format!("missing {name}"))?;
  PrivateKeySigner::from_str(&value).with_context(|| format!("parse {name}"))
}
