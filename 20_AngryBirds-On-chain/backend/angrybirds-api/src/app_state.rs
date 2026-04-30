use std::sync::Arc;

use alloy::primitives::Address;
use anyhow::Result;
use sqlx::SqlitePool;

use crate::{
  chain_client::{AlloyChainClient, ChainClient},
  config::{parse_signer_env, AppConfig},
};

#[derive(Clone)]
pub struct AppState {
  pub config: AppConfig,
  pub db: SqlitePool,
  pub chain_client: Arc<dyn ChainClient>,
  pub verifier_signer: alloy::signers::local::PrivateKeySigner,
  pub relayer_address: Address,
}

pub fn build_app_state(config: AppConfig, db: SqlitePool) -> Result<Arc<AppState>> {
  let relayer_signer = parse_signer_env("ANGRY_BIRDS_RELAYER_PRIVATE_KEY")?;
  let verifier_signer = parse_signer_env("ANGRY_BIRDS_VERIFIER_PRIVATE_KEY")?;
  let relayer_address = relayer_signer.address();
  let chain_client: Arc<dyn ChainClient> = Arc::new(AlloyChainClient::new(&config, relayer_signer)?);

  Ok(Arc::new(AppState {
    config,
    db,
    chain_client,
    verifier_signer,
    relayer_address,
  }))
}
