use std::{str::FromStr, sync::Arc};

use alloy::{primitives::Address, rpc::types::Log, signers::local::PrivateKeySigner};
use anyhow::Result;
use async_trait::async_trait;
use sqlx::{sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions}, SqlitePool};

use crate::{
  app_state::AppState,
  chain_client::{ChainClient, ChainReceipt},
  config::AppConfig,
  db::init_db,
  models::RelayDispatchOutcome,
};

pub async fn test_pool(name: &str) -> SqlitePool {
  let unique = format!(
    "{}-{}-{}",
    name,
    std::process::id(),
    std::time::SystemTime::now()
      .duration_since(std::time::UNIX_EPOCH)
      .expect("unix time")
      .as_nanos()
  );
  let database_url = format!("sqlite://{}/{}.sqlite", std::env::temp_dir().display(), unique);
  let options = SqliteConnectOptions::from_str(&database_url)
    .expect("sqlite connect options")
    .create_if_missing(true)
    .busy_timeout(std::time::Duration::from_secs(5))
    .journal_mode(SqliteJournalMode::Wal);
  let pool = SqlitePoolOptions::new()
    .max_connections(5)
    .connect_with(options)
    .await
    .expect("connect sqlite");
  init_db(&pool).await.expect("init db");
  pool
}

#[derive(Default)]
pub struct FakeChainClient {
  pub latest_block_number: u64,
  pub logs: Vec<Log>,
  pub block_timestamp: u64,
  pub receipt_success: Option<bool>,
}

#[async_trait]
impl ChainClient for FakeChainClient {
  async fn fetch_level_content_hash(&self, _level_id: &str, _level_version: u32) -> Result<alloy::primitives::B256> {
    Ok(alloy::primitives::B256::ZERO)
  }

  async fn fetch_level_order(&self, _level_id: &str, _level_version: u32) -> Result<u32> {
    Ok(0)
  }

  async fn submit_verified_batch(
    &self,
    _permit: &angrybirds_core::ActiveSessionPermit,
    _player_permit_sig: &str,
    _runs: &[angrybirds_core::VerifiedRunRecord],
    _batch_id: alloy::primitives::B256,
    _verifier_sig: &str,
  ) -> Result<RelayDispatchOutcome> {
    Ok(RelayDispatchOutcome::Confirmed(alloy::primitives::B256::ZERO))
  }

  async fn get_transaction_receipt(
    &self,
    _tx_hash: alloy::primitives::B256,
  ) -> Result<Option<ChainReceipt>> {
    Ok(self.receipt_success.map(|success| ChainReceipt { success }))
  }

  async fn get_latest_block_number(&self) -> Result<u64> {
    Ok(self.latest_block_number)
  }

  async fn get_logs(&self, _filter: alloy::rpc::types::Filter) -> Result<Vec<Log>> {
    Ok(self.logs.clone())
  }

  async fn get_block_timestamp(&self, _block_number: u64) -> Result<u64> {
    Ok(self.block_timestamp)
  }
}

pub async fn test_state(name: &str) -> Arc<AppState> {
  test_state_with_chain_client(name, Arc::new(FakeChainClient::default())).await
}

pub async fn test_state_with_chain_client(
  name: &str,
  chain_client: Arc<dyn ChainClient>,
) -> Arc<AppState> {
  let db = test_pool(name).await;
  let verifier_signer = PrivateKeySigner::from_str(
    "0x59c6995e998f97a5a0044966f0945384d5f8f1e7e52d3be6f6047f2d6a8f9c56",
  )
  .expect("parse verifier signer");

  Arc::new(AppState {
    config: AppConfig {
      bind: "127.0.0.1:8788".parse().expect("bind"),
      database_url: format!("sqlite://{name}.sqlite"),
      rpc_url: "http://127.0.0.1:8545".to_string(),
      chain_id: 31337,
      deployment_id: format!("test-{name}"),
      scoreboard_address: Address::from_slice(&[0x11; 20]),
      level_catalog_address: Address::from_slice(&[0x22; 20]),
      session_ttl_seconds: 7_200,
      session_max_runs: 10,
      max_batch_runs: 8,
      auto_finalize_idle_seconds: 45,
      indexer_poll_interval_ms: 3_000,
      indexer_confirmations: 0,
    },
    db,
    chain_client,
    relayer_address: verifier_signer.address(),
    verifier_signer,
  })
}
