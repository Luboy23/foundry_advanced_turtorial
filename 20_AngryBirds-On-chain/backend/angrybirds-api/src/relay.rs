use std::sync::Arc;

use anyhow::{anyhow, Context, Result};
use tracing::{error, info};

use crate::{
  app_state::AppState,
  db::{
    batches::{
      load_submitted_batches, mark_batch_confirmed, mark_batch_failed, mark_batch_submitted,
      mark_runs_queued, queue_session_for_finalize, refresh_session_status, upsert_relay_batch_queued,
    },
    runs::load_runs_for_batch,
    sessions::{find_idle_session_ids, find_ready_session_ids, load_session_row_by_id},
  },
  format_b256,
  models::{
    RelayDispatchOutcome, RELAY_RETRY_BACKOFF_MS, RUN_STATUS_FAILED, RUN_STATUS_QUEUED,
    RUN_STATUS_VALIDATED,
  },
  now_ms,
};

pub fn spawn_relay_worker(state: Arc<AppState>) {
  tokio::spawn(async move {
    loop {
      if let Err(error) = process_relay_worker_tick(state.clone()).await {
        error!("relay worker tick failed: {error:#}");
      }
      tokio::time::sleep(std::time::Duration::from_millis(750)).await;
    }
  });
}

async fn process_relay_worker_tick(state: Arc<AppState>) -> Result<()> {
  reconcile_submitted_batches(state.clone()).await?;
  queue_idle_sessions(state.clone()).await?;
  process_ready_sessions(state).await
}

async fn queue_idle_sessions(state: Arc<AppState>) -> Result<()> {
  let idle_cutoff = now_ms().saturating_sub(state.config.auto_finalize_idle_seconds * 1_000);
  let session_ids = find_idle_session_ids(&state.db, idle_cutoff, &state.config.deployment_id).await?;
  for session_id in session_ids {
    queue_session_for_finalize(&state.db, session_id, "queued idle session for auto-finalize").await?;
  }
  Ok(())
}

async fn process_ready_sessions(state: Arc<AppState>) -> Result<()> {
  let retry_cutoff = now_ms().saturating_sub(RELAY_RETRY_BACKOFF_MS);
  let session_ids =
    find_ready_session_ids(&state.db, retry_cutoff, &state.config.deployment_id).await?;
  for session_id in session_ids {
    if let Err(error) = process_session_batches(state.clone(), session_id).await {
      error!(
        session_id = %format_b256(session_id),
        "relay session processing failed: {error:#}"
      );
    }
  }
  Ok(())
}

async fn reconcile_submitted_batches(state: Arc<AppState>) -> Result<()> {
  let rows = load_submitted_batches(&state.db).await?;
  for row in rows {
    let receipt = state
      .chain_client
      .get_transaction_receipt(row.tx_hash)
      .await
      .with_context(|| format!("fetch receipt for relay batch {}", format_b256(row.batch_id)))?;
    let Some(receipt) = receipt else {
      continue;
    };

    let tx_hash_hex = format_b256(row.tx_hash);
    if receipt.success {
      mark_batch_confirmed(&state.db, row.session_id, row.batch_id, &tx_hash_hex).await?;
      refresh_session_status(&state.db, row.session_id).await?;
      info!(
        session_id = %format_b256(row.session_id),
        batch_id = %format_b256(row.batch_id),
        tx_hash = %tx_hash_hex,
        "confirmed previously submitted relay batch"
      );
      continue;
    }

    mark_batch_failed(
      &state.db,
      row.session_id,
      row.batch_id,
      Some(&tx_hash_hex),
      "relay transaction reverted",
    )
    .await?;
    error!(
      session_id = %format_b256(row.session_id),
      batch_id = %format_b256(row.batch_id),
      tx_hash = %tx_hash_hex,
      "relay batch reverted on-chain"
    );
  }
  Ok(())
}

async fn process_session_batches(state: Arc<AppState>, session_id: alloy::primitives::B256) -> Result<()> {
  let session = load_session_row_by_id(&state.db, session_id, &state.config.deployment_id)
    .await?
    .ok_or_else(|| anyhow!("session not found"))?;
  let permit_signature = session
    .permit_signature
    .clone()
    .ok_or_else(|| anyhow!("session is not activated"))?;

  loop {
    let runs = load_runs_for_batch(
      &state.db,
      session_id,
      state.config.max_batch_runs,
      &[RUN_STATUS_VALIDATED, RUN_STATUS_FAILED, RUN_STATUS_QUEUED],
    )
    .await?;
    if runs.is_empty() {
      refresh_session_status(&state.db, session_id).await?;
      return Ok(());
    }

    let batch_id = angrybirds_core::build_batch_id(
      session.permit.session_id,
      session.permit.nonce,
      runs[0].run_id,
      runs.len(),
    );
    let verifier_signature = angrybirds_core::sign_batch_digest(
      &state.verifier_signer,
      angrybirds_core::verifier_batch_digest(
        &session.permit,
        batch_id,
        &runs,
        state.config.chain_id,
        state.config.scoreboard_address,
      ),
    )
    .await?;
    let run_ids = runs
      .iter()
      .map(|run| format_b256(run.run_id))
      .collect::<Vec<_>>();
    let run_ids_json = serde_json::to_string(&run_ids)?;

    upsert_relay_batch_queued(&state.db, &session.permit, session_id, batch_id, &run_ids_json).await?;
    mark_runs_queued(&state.db, session_id, batch_id, &run_ids_json).await?;

    match state
      .chain_client
      .submit_verified_batch(
        &session.permit,
        &permit_signature,
        &runs,
        batch_id,
        &verifier_signature,
      )
      .await
    {
      Ok(RelayDispatchOutcome::Confirmed(tx_hash)) => {
        let tx_hash_hex = format_b256(tx_hash);
        mark_batch_submitted(&state.db, session_id, batch_id, &tx_hash_hex, None).await?;
        mark_batch_confirmed(&state.db, session_id, batch_id, &tx_hash_hex).await?;
        info!(
          session_id = %format_b256(session_id),
          batch_id = %format_b256(batch_id),
          tx_hash = %tx_hash_hex,
          run_count = runs.len(),
          "confirmed relay batch"
        );
      }
      Ok(RelayDispatchOutcome::Submitted(tx_hash, message)) => {
        let tx_hash_hex = format_b256(tx_hash);
        mark_batch_submitted(&state.db, session_id, batch_id, &tx_hash_hex, Some(&message)).await?;
        info!(
          session_id = %format_b256(session_id),
          batch_id = %format_b256(batch_id),
          tx_hash = %tx_hash_hex,
          "submitted relay batch and waiting for receipt"
        );
        return Ok(());
      }
      Ok(RelayDispatchOutcome::Reverted(tx_hash)) => {
        let tx_hash_hex = format_b256(tx_hash);
        mark_batch_submitted(&state.db, session_id, batch_id, &tx_hash_hex, None).await?;
        mark_batch_failed(
          &state.db,
          session_id,
          batch_id,
          Some(&tx_hash_hex),
          "relay transaction reverted",
        )
        .await?;
        return Err(anyhow!("relay batch reverted"));
      }
      Err(error) => {
        let fail_reason = error.to_string();
        mark_batch_failed(&state.db, session_id, batch_id, None, &fail_reason).await?;
        return Err(error.context("dispatch relay batch"));
      }
    }
  }
}
