use alloy::primitives::{Address, B256};
use angrybirds_core::{
  ActiveSessionPermit, RunEvidenceV1, SessionPermitTypedData, VerifiedRunRecord,
};
use serde::{Deserialize, Serialize};

pub const SESSION_STATUS_CREATED: &str = "created";
pub const SESSION_STATUS_ACTIVE: &str = "active";
pub const SESSION_STATUS_QUEUED: &str = "queued";
pub const SESSION_STATUS_SUBMITTED: &str = "submitted";
pub const SESSION_STATUS_CONFIRMED: &str = "confirmed";
pub const SESSION_STATUS_FAILED: &str = "failed";

pub const RUN_STATUS_VALIDATED: &str = "validated";
pub const RUN_STATUS_QUEUED: &str = "queued";
pub const RUN_STATUS_SUBMITTED: &str = "submitted";
pub const RUN_STATUS_CONFIRMED: &str = "confirmed";
pub const RUN_STATUS_FAILED: &str = "failed";

pub const BATCH_STATUS_QUEUED: &str = "queued";
pub const BATCH_STATUS_SUBMITTED: &str = "submitted";
pub const BATCH_STATUS_CONFIRMED: &str = "confirmed";
pub const BATCH_STATUS_FAILED: &str = "failed";

pub const RELAY_RETRY_BACKOFF_MS: u64 = 5_000;
pub const INDEXER_STATUS_IDLE: &str = "idle";
pub const INDEXER_STATUS_RUNNING: &str = "running";
pub const INDEXER_STATUS_ERROR: &str = "error";
pub const INDEXER_CURSOR_KEY: &str = "scoreboard-read-model";
pub const RUN_SUBMITTED_SIGNATURE: &str =
  "RunSubmitted(address,bytes32,uint32,uint8,uint16,uint32,bytes32)";
pub const GLOBAL_BEST_UPDATED_SIGNATURE: &str =
  "GlobalBestUpdated(address,bytes32,uint32,uint8,uint32,bytes32)";
pub const VERIFIED_BATCH_SUBMITTED_SIGNATURE: &str =
  "VerifiedBatchSubmitted(address,address,bytes32,bytes32,uint32,uint256)";

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSessionRequest {
  pub player: Address,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSessionResponse {
  pub session_id: B256,
  pub deadline: u64,
  pub max_runs: u16,
  pub permit: ActiveSessionPermit,
  pub typed_data: SessionPermitTypedData,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivateSessionRequest {
  pub player: Address,
  pub session_id: B256,
  pub signature: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivateSessionResponse {
  pub ok: bool,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadRunRequest {
  pub player: Address,
  pub session_id: B256,
  pub evidence: RunEvidenceV1,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadRunResponse {
  pub run: VerifiedRunRecord,
  pub status: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FinalizeSessionResponse {
  pub ok: bool,
  pub status: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionStatusResponse {
  pub session_id: B256,
  pub status: String,
  pub received_runs: i64,
  pub validated_runs: i64,
  pub queued_runs: i64,
  pub submitted_runs: i64,
  pub confirmed_runs: i64,
  pub failed_runs: i64,
  pub tx_hashes: Vec<String>,
  pub last_error: Option<String>,
}

#[derive(Deserialize, Default)]
pub struct PaginationQuery {
  pub limit: Option<u32>,
  pub offset: Option<u32>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ReadModelRunResult {
  pub level_id: String,
  pub level_version: u32,
  pub birds_used: u8,
  pub destroyed_pigs: u16,
  pub duration_ms: u32,
  pub evidence_hash: B256,
  pub submitted_at: u64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ReadModelLeaderboardEntry {
  pub player: Address,
  pub result: ReadModelRunResult,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ReadModelHistoryEntry {
  pub player: Address,
  pub result: ReadModelRunResult,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexerStatusResponse {
  pub ok: bool,
  pub status: String,
  pub last_processed_block: u64,
  pub last_processed_log_index: i64,
  pub last_error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthResponse {
  pub ok: bool,
}

#[derive(Clone)]
pub struct SessionRow {
  pub permit: ActiveSessionPermit,
  pub permit_signature: Option<String>,
  pub status: String,
  pub finalize_requested_at_ms: Option<i64>,
  pub accepted_run_count: i64,
}

#[derive(Clone)]
pub struct RelayBatchRow {
  pub batch_id: B256,
  pub session_id: B256,
  pub tx_hash: B256,
}

#[derive(Clone)]
pub struct IndexerCursorRow {
  pub status: String,
  pub last_processed_block: u64,
  pub last_processed_log_index: i64,
  pub last_error: Option<String>,
}

#[derive(Clone)]
pub struct IndexedPlayerRunProjection {
  pub player: Address,
  pub level_id: String,
  pub level_version: u32,
  pub birds_used: u8,
  pub destroyed_pigs: u16,
  pub duration_ms: u32,
  pub evidence_hash: B256,
  pub submitted_at_ms: u64,
  pub tx_hash: B256,
  pub block_number: u64,
  pub log_index: u64,
}

#[derive(Clone)]
pub struct IndexedGlobalBestProjection {
  pub player: Address,
  pub level_id: String,
  pub level_version: u32,
  pub level_order: u32,
  pub birds_used: u8,
  pub destroyed_pigs: u16,
  pub duration_ms: u32,
  pub evidence_hash: B256,
  pub submitted_at_ms: u64,
}

pub enum RelayDispatchOutcome {
  Confirmed(B256),
  Submitted(B256, String),
  Reverted(B256),
}
