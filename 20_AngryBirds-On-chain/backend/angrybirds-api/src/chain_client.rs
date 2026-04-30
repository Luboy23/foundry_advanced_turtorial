use alloy::{
  consensus::BlockHeader,
  network::EthereumWallet,
  primitives::{hex, Address, B256, Bytes},
  providers::{Provider, ProviderBuilder},
  rpc::types::{BlockTransactionsKind, Filter, Log},
  signers::local::PrivateKeySigner,
  sol,
};
use anyhow::{Context, Result};
use async_trait::async_trait;
use angrybirds_core::{parse_level_id, ActiveSessionPermit, VerifiedRunRecord};

use crate::{config::AppConfig, models::RelayDispatchOutcome};

sol! {
    #[sol(rpc)]
    contract AngryBirdsLevelCatalogRpc {
        struct LevelConfig {
            bytes32 levelId;
            uint32 version;
            bytes32 contentHash;
            uint32 order;
            bool enabled;
        }

        function getLevel(bytes32 levelId, uint32 version)
            external
            view
            returns (LevelConfig memory);
    }

    #[sol(rpc)]
    contract AngryBirdsScoreboardRpc {
        struct SessionPermit {
            address player;
            address delegate;
            bytes32 sessionId;
            bytes32 deploymentIdHash;
            uint64 issuedAt;
            uint64 deadline;
            uint32 nonce;
            uint16 maxRuns;
        }

        struct VerifiedRun {
            bytes32 runId;
            bytes32 levelId;
            uint32 levelVersion;
            uint8 birdsUsed;
            uint16 destroyedPigs;
            uint32 durationMs;
            bytes32 evidenceHash;
        }

        function submitVerifiedBatch(
            SessionPermit calldata permit,
            bytes calldata playerPermitSig,
            VerifiedRun[] calldata runs,
            bytes32 batchId,
            bytes calldata verifierSig
        ) external;
    }
}

#[derive(Clone)]
pub struct ChainReceipt {
  pub success: bool,
}

#[async_trait]
pub trait ChainClient: Send + Sync {
  async fn fetch_level_content_hash(&self, level_id: &str, level_version: u32) -> Result<B256>;
  async fn fetch_level_order(&self, level_id: &str, level_version: u32) -> Result<u32>;
  async fn submit_verified_batch(
    &self,
    permit: &ActiveSessionPermit,
    player_permit_sig: &str,
    runs: &[VerifiedRunRecord],
    batch_id: B256,
    verifier_sig: &str,
  ) -> Result<RelayDispatchOutcome>;
  async fn get_transaction_receipt(&self, tx_hash: B256) -> Result<Option<ChainReceipt>>;
  async fn get_latest_block_number(&self) -> Result<u64>;
  async fn get_logs(&self, filter: Filter) -> Result<Vec<Log>>;
  async fn get_block_timestamp(&self, block_number: u64) -> Result<u64>;
}

pub struct AlloyChainClient {
  rpc_url: String,
  scoreboard_address: Address,
  level_catalog_address: Address,
  relayer_signer: PrivateKeySigner,
}

impl AlloyChainClient {
  pub fn new(config: &AppConfig, relayer_signer: PrivateKeySigner) -> Result<Self> {
    Ok(Self {
      rpc_url: config.rpc_url.clone(),
      scoreboard_address: config.scoreboard_address,
      level_catalog_address: config.level_catalog_address,
      relayer_signer,
    })
  }

  async fn fetch_level_config(
    &self,
    level_id: &str,
    level_version: u32,
  ) -> Result<AngryBirdsLevelCatalogRpc::LevelConfig> {
    let provider = ProviderBuilder::new().on_http(self.rpc_url.parse()?);
    let contract = AngryBirdsLevelCatalogRpc::new(self.level_catalog_address, provider);
    let response = contract
      .getLevel(parse_level_id(level_id)?, level_version)
      .call()
      .await
      .with_context(|| format!("fetch level config for {level_id} v{level_version}"))?;
    Ok(response._0)
  }
}

#[async_trait]
impl ChainClient for AlloyChainClient {
  async fn fetch_level_content_hash(&self, level_id: &str, level_version: u32) -> Result<B256> {
    Ok(self.fetch_level_config(level_id, level_version).await?.contentHash)
  }

  async fn fetch_level_order(&self, level_id: &str, level_version: u32) -> Result<u32> {
    Ok(self.fetch_level_config(level_id, level_version).await?.order)
  }

  async fn submit_verified_batch(
    &self,
    permit: &ActiveSessionPermit,
    player_permit_sig: &str,
    runs: &[VerifiedRunRecord],
    batch_id: B256,
    verifier_sig: &str,
  ) -> Result<RelayDispatchOutcome> {
    let provider = ProviderBuilder::new()
      .wallet(EthereumWallet::from(self.relayer_signer.clone()))
      .on_http(self.rpc_url.parse()?);
    let contract = AngryBirdsScoreboardRpc::new(self.scoreboard_address, provider);

    let permit_arg = AngryBirdsScoreboardRpc::SessionPermit {
      player: permit.player,
      delegate: permit.delegate,
      sessionId: permit.session_id,
      deploymentIdHash: permit.deployment_id_hash,
      issuedAt: permit.issued_at,
      deadline: permit.deadline,
      nonce: permit.nonce,
      maxRuns: permit.max_runs,
    };
    let runs_arg = runs
      .iter()
      .map(|run| AngryBirdsScoreboardRpc::VerifiedRun {
        runId: run.run_id,
        levelId: run.level_id,
        levelVersion: run.level_version,
        birdsUsed: run.birds_used,
        destroyedPigs: run.destroyed_pigs,
        durationMs: run.duration_ms,
        evidenceHash: run.evidence_hash,
      })
      .collect::<Vec<_>>();

    let pending = contract
      .submitVerifiedBatch(
        permit_arg,
        signature_bytes(player_permit_sig)?,
        runs_arg,
        batch_id,
        signature_bytes(verifier_sig)?,
      )
      .send()
      .await
      .context("send submitVerifiedBatch transaction")?;
    let tx_hash = *pending.tx_hash();

    let receipt = match pending.get_receipt().await {
      Ok(receipt) => receipt,
      Err(error) => {
        return Ok(RelayDispatchOutcome::Submitted(
          tx_hash,
          format!("waiting for relay receipt: {error}"),
        ))
      }
    };

    if receipt.status() {
      return Ok(RelayDispatchOutcome::Confirmed(tx_hash));
    }

    Ok(RelayDispatchOutcome::Reverted(tx_hash))
  }

  async fn get_transaction_receipt(&self, tx_hash: B256) -> Result<Option<ChainReceipt>> {
    let provider = ProviderBuilder::new().on_http(self.rpc_url.parse()?);
    let receipt = provider
      .get_transaction_receipt(tx_hash)
      .await
      .with_context(|| format!("fetch receipt for {tx_hash:#x}"))?;

    Ok(receipt.map(|value| ChainReceipt {
      success: value.status(),
    }))
  }

  async fn get_latest_block_number(&self) -> Result<u64> {
    let provider = ProviderBuilder::new().on_http(self.rpc_url.parse()?);
    provider.get_block_number().await.context("fetch latest block number")
  }

  async fn get_logs(&self, filter: Filter) -> Result<Vec<Log>> {
    let provider = ProviderBuilder::new().on_http(self.rpc_url.parse()?);
    provider.get_logs(&filter).await.context("fetch indexer logs")
  }

  async fn get_block_timestamp(&self, block_number: u64) -> Result<u64> {
    let provider = ProviderBuilder::new().on_http(self.rpc_url.parse()?);
    let block = provider
      .get_block_by_number(block_number.into(), BlockTransactionsKind::Hashes)
      .await
      .with_context(|| format!("fetch block {block_number} for timestamp"))?
      .ok_or_else(|| anyhow::anyhow!("block {block_number} not found"))?;
    Ok(block.header.timestamp())
  }
}

fn signature_bytes(signature_hex: &str) -> Result<Bytes> {
  Ok(Bytes::from(hex::decode(signature_hex.trim_start_matches("0x"))?))
}
