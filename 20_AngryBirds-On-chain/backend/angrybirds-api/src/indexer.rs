use std::sync::Arc;

use alloy::primitives::{Address, B256};
use alloy::rpc::types::{Filter, Log};
use anyhow::{anyhow, Result};
use tracing::{error, info};

use crate::{
  app_state::AppState,
  db::indexer::{
    insert_player_run_projection, load_indexer_cursor, update_indexer_status,
    upsert_global_best_projection,
  },
  format_address, format_b256,
  models::{
    IndexedGlobalBestProjection, IndexedPlayerRunProjection, GLOBAL_BEST_UPDATED_SIGNATURE,
    INDEXER_STATUS_ERROR, INDEXER_STATUS_RUNNING, RUN_SUBMITTED_SIGNATURE,
    VERIFIED_BATCH_SUBMITTED_SIGNATURE,
  },
};

pub fn spawn_indexer_worker(state: Arc<AppState>) {
  // 后台常驻轮询 worker：按配置间隔抓取链上日志并写入读模型。
  tokio::spawn(async move {
    loop {
      if let Err(error) = process_indexer_worker_tick(state.clone()).await {
        let _ = update_indexer_status(
          &state.db,
          INDEXER_STATUS_ERROR,
          None,
          None,
          Some(&error.to_string()),
        )
        .await;
        error!("indexer worker tick failed: {error:#}");
      }
      tokio::time::sleep(std::time::Duration::from_millis(
        state.config.indexer_poll_interval_ms,
      ))
      .await;
    }
  });
}

// 单次轮询：读取游标 -> 拉日志 -> 逐条处理 -> 推进游标。
async fn process_indexer_worker_tick(state: Arc<AppState>) -> Result<()> {
  let cursor = load_indexer_cursor(&state.db).await?;
  let from_block = cursor
    .as_ref()
    .map(|cursor| cursor.last_processed_block)
    .unwrap_or(0);
  let latest_block = state.chain_client.get_latest_block_number().await?;
  let confirmed_latest = latest_block.saturating_sub(state.config.indexer_confirmations);

  if confirmed_latest < from_block {
    // 没有可确认的新块时，仅更新运行状态，避免空转报错。
    update_indexer_status(
      &state.db,
      INDEXER_STATUS_RUNNING,
      cursor.as_ref().map(|value| value.last_processed_block),
      cursor.as_ref().map(|value| value.last_processed_log_index),
      None,
    )
    .await?;
    return Ok(());
  }

  let filter = Filter::new()
    .address(state.config.scoreboard_address)
    .from_block(from_block)
    .to_block(confirmed_latest);
  let mut logs = state.chain_client.get_logs(filter).await?;
  logs.sort_by_key(|log| (log.block_number.unwrap_or_default(), log.log_index.unwrap_or_default()));

  let mut last_processed_block = cursor.as_ref().map(|value| value.last_processed_block).unwrap_or(0);
  let mut last_processed_log_index = cursor
    .as_ref()
    .map(|value| value.last_processed_log_index)
    .unwrap_or(-1);

  for log in logs {
    let block_number = log.block_number.unwrap_or_default();
    let log_index = log.log_index.unwrap_or_default() as i64;
    if block_number == last_processed_block && log_index <= last_processed_log_index {
      continue;
    }

    process_indexer_log(state.clone(), &log).await?;
    last_processed_block = block_number;
    last_processed_log_index = log_index;
    // 每处理完一条日志就持久化游标，降低重启后的重复处理窗口。
    update_indexer_status(
      &state.db,
      INDEXER_STATUS_RUNNING,
      Some(last_processed_block),
      Some(last_processed_log_index),
      None,
    )
    .await?;
  }

  update_indexer_status(
    &state.db,
    INDEXER_STATUS_RUNNING,
    Some(last_processed_block.max(confirmed_latest)),
    Some(last_processed_log_index),
    None,
  )
  .await?;

  Ok(())
}

// 按事件签名分发日志解码逻辑，并写入对应 projection 表。
async fn process_indexer_log(state: Arc<AppState>, log: &Log) -> Result<()> {
  let submitted_at = resolve_log_timestamp(state.clone(), log).await?;
  let topic0 = log
    .topics()
    .first()
    .copied()
    .ok_or_else(|| anyhow!("log missing topic0"))?;

  if topic0 == event_signature_hash(RUN_SUBMITTED_SIGNATURE) {
    let topics = log.topics();
    if topics.len() < 4 {
      return Ok(());
    }
    let data = log.data().data.as_ref();
    // 解码 RunSubmitted 事件，写入玩家 run 明细投影。
    let projection = IndexedPlayerRunProjection {
      player: decode_address_topic(&topics[1]),
      level_id: bytes32_level_id(topics[2]),
      level_version: decode_u32_topic(&topics[3]),
      birds_used: decode_u8_word(data, 0)?,
      destroyed_pigs: decode_u16_word(data, 32)?,
      duration_ms: decode_u32_word(data, 64)?,
      evidence_hash: decode_b256_word(data, 96)?,
      submitted_at_ms: submitted_at,
      tx_hash: log.transaction_hash.ok_or_else(|| anyhow!("missing transaction hash"))?,
      block_number: log.block_number.unwrap_or_default(),
      log_index: log.log_index.unwrap_or_default(),
    };
    insert_player_run_projection(&state.db, &projection).await?;
    return Ok(());
  }

  if topic0 == event_signature_hash(GLOBAL_BEST_UPDATED_SIGNATURE) {
    let topics = log.topics();
    if topics.len() < 4 {
      return Ok(());
    }
    let data = log.data().data.as_ref();
    let level_id = bytes32_level_id(topics[2]);
    let level_version = decode_u32_topic(&topics[3]);
    let level_order = state
      .chain_client
      .fetch_level_order(&level_id, level_version)
      .await?;
    // 全局榜事件需要补齐关卡顺序，以便读模型直接按规则排序展示。
    let projection = IndexedGlobalBestProjection {
      player: decode_address_topic(&topics[1]),
      level_id,
      level_version,
      level_order,
      birds_used: decode_u8_word(data, 0)?,
      destroyed_pigs: 0,
      duration_ms: decode_u32_word(data, 32)?,
      evidence_hash: decode_b256_word(data, 64)?,
      submitted_at_ms: submitted_at,
    };
    upsert_global_best_projection(&state.db, &projection).await?;
    return Ok(());
  }

  if topic0 == event_signature_hash(VERIFIED_BATCH_SUBMITTED_SIGNATURE) {
    let topics = log.topics();
    if topics.len() >= 4 {
      info!(
        player = %format_address(decode_address_topic(&topics[1])),
        batch_id = %format_b256(topics[3]),
        "indexed verified batch submission"
      );
    }
  }

  Ok(())
}

// 优先使用日志自带时间戳，缺失时再回源查询区块时间。
async fn resolve_log_timestamp(state: Arc<AppState>, log: &Log) -> Result<u64> {
  if let Some(timestamp) = log.block_timestamp {
    return Ok(timestamp);
  }
  let block_number = log.block_number.ok_or_else(|| anyhow!("log missing block number"))?;
  state.chain_client.get_block_timestamp(block_number).await
}

// 计算事件签名哈希（topic0）。
fn event_signature_hash(signature: &str) -> B256 {
  alloy::primitives::keccak256(signature.as_bytes())
}

// 从 indexed topic 中解码地址（取末 20 字节）。
fn decode_address_topic(topic: &B256) -> Address {
  Address::from_slice(&topic.as_slice()[12..32])
}

// bytes32 levelId 转可读字符串（遇到 0 字节截断）。
fn bytes32_level_id(value: B256) -> String {
  let bytes = value.as_slice();
  let end = bytes.iter().position(|byte| *byte == 0).unwrap_or(bytes.len());
  String::from_utf8_lossy(&bytes[..end]).to_string()
}

// ABI word 里解码 u8（低位对齐）。
fn decode_u8_word(data: &[u8], offset: usize) -> Result<u8> {
  let slice = data
    .get(offset + 31)
    .ok_or_else(|| anyhow!("decode u8 word at offset {offset}"))?;
  Ok(*slice)
}

// ABI word 里解码 u16（低位对齐）。
fn decode_u16_word(data: &[u8], offset: usize) -> Result<u16> {
  let slice = data
    .get(offset + 30..offset + 32)
    .ok_or_else(|| anyhow!("decode u16 word at offset {offset}"))?;
  Ok(u16::from_be_bytes([slice[0], slice[1]]))
}

// ABI word 里解码 u32（低位对齐）。
fn decode_u32_word(data: &[u8], offset: usize) -> Result<u32> {
  let slice = data
    .get(offset + 28..offset + 32)
    .ok_or_else(|| anyhow!("decode u32 word at offset {offset}"))?;
  Ok(u32::from_be_bytes([slice[0], slice[1], slice[2], slice[3]]))
}

// 从 topic 里解码 u32。
fn decode_u32_topic(topic: &B256) -> u32 {
  let bytes = topic.as_slice();
  u32::from_be_bytes([bytes[28], bytes[29], bytes[30], bytes[31]])
}

// ABI word 里解码 bytes32。
fn decode_b256_word(data: &[u8], offset: usize) -> Result<B256> {
  let slice = data
    .get(offset..offset + 32)
    .ok_or_else(|| anyhow!("decode bytes32 word at offset {offset}"))?;
  Ok(B256::from_slice(slice))
}
