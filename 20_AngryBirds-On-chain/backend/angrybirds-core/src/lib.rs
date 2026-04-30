mod protocol;

use std::{collections::BTreeMap, str::FromStr};

use alloy::{
    primitives::{keccak256, Address, B256, PrimitiveSignature, U256},
    signers::{local::PrivateKeySigner, Signer},
    sol,
    sol_types::SolValue,
};
use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};

const SESSION_PERMIT_NAME: &str = "AngryBirdsSessionPermit";
const VERIFIED_BATCH_NAME: &str = "AngryBirdsVerifiedBatch";
const SESSION_PERMIT_VERSION: &str = "1";
const VERIFIED_BATCH_VERSION: &str = "1";
use crate::protocol::protocol_spec;

sol! {
    struct SessionPermitSol {
        address player;
        address delegate;
        bytes32 sessionId;
        bytes32 deploymentIdHash;
        uint64 issuedAt;
        uint64 deadline;
        uint32 nonce;
        uint16 maxRuns;
    }

    struct VerifiedRunSol {
        bytes32 runId;
        bytes32 levelId;
        uint32 levelVersion;
        uint8 birdsUsed;
        uint16 destroyedPigs;
        uint32 durationMs;
        bytes32 evidenceHash;
    }

    struct VerifierBatchSol {
        address player;
        address delegate;
        bytes32 sessionId;
        uint32 nonce;
        bytes32 batchId;
        bytes32 runsHash;
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RunSummary {
    pub birds_used: u8,
    pub destroyed_pigs: u16,
    pub duration_ms: u32,
    pub cleared: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LaunchEvidence {
    pub bird_index: u8,
    pub bird_type: String,
    pub launch_at_ms: u64,
    pub drag_x: f64,
    pub drag_y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AbilityEvidence {
    pub bird_index: u8,
    pub used_at_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DestroyEvidence {
    pub entity_id: String,
    pub entity_type: String,
    pub at_ms: u64,
    pub cause: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CheckpointEvidence {
    pub at_ms: u64,
    pub bird_index: u8,
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RunEvidenceV1 {
    pub session_id: B256,
    pub level_id: String,
    pub level_version: u32,
    pub level_content_hash: B256,
    pub client_build_hash: B256,
    pub started_at_ms: u64,
    pub finished_at_ms: u64,
    pub summary: RunSummary,
    pub launches: Vec<LaunchEvidence>,
    pub abilities: Vec<AbilityEvidence>,
    pub destroys: Vec<DestroyEvidence>,
    pub checkpoints: Vec<CheckpointEvidence>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ActiveSessionPermit {
    pub player: Address,
    pub delegate: Address,
    pub session_id: B256,
    pub deployment_id_hash: B256,
    pub issued_at: u64,
    pub deadline: u64,
    pub nonce: u32,
    pub max_runs: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct VerifiedRunRecord {
    pub run_id: B256,
    pub level_id: B256,
    pub level_version: u32,
    pub birds_used: u8,
    pub destroyed_pigs: u16,
    pub duration_ms: u32,
    pub evidence_hash: B256,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TypedDataField {
    pub name: &'static str,
    #[serde(rename = "type")]
    pub type_name: &'static str,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TypedDataDomain {
    pub name: &'static str,
    pub version: &'static str,
    pub chain_id: u64,
    pub verifying_contract: Address,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionPermitTypedData {
    pub domain: TypedDataDomain,
    pub primary_type: &'static str,
    pub types: BTreeMap<&'static str, Vec<TypedDataField>>,
    pub message: ActiveSessionPermit,
}

pub fn deployment_id_hash(deployment_id: &str) -> B256 {
    keccak256(deployment_id.as_bytes())
}

pub fn build_session_id(
    player: Address,
    nonce: u32,
    issued_at_ms: u64,
    deployment_id: &str,
) -> B256 {
    keccak256((
        player,
        nonce,
        issued_at_ms,
        deployment_id_hash(deployment_id),
    )
        .abi_encode())
}

pub fn build_batch_id(
    session_id: B256,
    nonce: u32,
    first_run_id: B256,
    run_count: usize,
) -> B256 {
    keccak256((session_id, nonce, first_run_id, U256::from(run_count)).abi_encode())
}

pub fn build_run_id(
    session_id: B256,
    level_id: B256,
    level_version: u32,
    evidence_hash: B256,
) -> B256 {
    keccak256((session_id, level_id, level_version, evidence_hash).abi_encode())
}

pub fn parse_level_id(level_id: &str) -> Result<B256> {
    if level_id.is_empty() {
        bail!("levelId must not be empty");
    }
    let bytes = level_id.as_bytes();
    if bytes.len() > 32 {
        bail!("levelId must fit into bytes32");
    }

    let mut padded = [0u8; 32];
    padded[..bytes.len()].copy_from_slice(bytes);
    Ok(B256::from(padded))
}

pub fn build_session_permit_typed_data(
    permit: &ActiveSessionPermit,
    chain_id: u64,
    verifying_contract: Address,
) -> SessionPermitTypedData {
    let mut types = BTreeMap::new();
    types.insert(
        "SessionPermit",
        vec![
            TypedDataField {
                name: "player",
                type_name: "address",
            },
            TypedDataField {
                name: "delegate",
                type_name: "address",
            },
            TypedDataField {
                name: "sessionId",
                type_name: "bytes32",
            },
            TypedDataField {
                name: "deploymentIdHash",
                type_name: "bytes32",
            },
            TypedDataField {
                name: "issuedAt",
                type_name: "uint64",
            },
            TypedDataField {
                name: "deadline",
                type_name: "uint64",
            },
            TypedDataField {
                name: "nonce",
                type_name: "uint32",
            },
            TypedDataField {
                name: "maxRuns",
                type_name: "uint16",
            },
        ],
    );

    SessionPermitTypedData {
        domain: TypedDataDomain {
            name: SESSION_PERMIT_NAME,
            version: SESSION_PERMIT_VERSION,
            chain_id,
            verifying_contract,
        },
        primary_type: "SessionPermit",
        types,
        message: permit.clone(),
    }
}

pub fn build_evidence_hash(evidence: &RunEvidenceV1) -> Result<B256> {
    let bytes = serde_json::to_vec(evidence).context("serialize run evidence")?;
    Ok(keccak256(bytes))
}

pub fn validate_evidence(
    evidence: &RunEvidenceV1,
    expected_session_id: B256,
    expected_level_content_hash: B256,
) -> Result<VerifiedRunRecord> {
    let protocol = protocol_spec();
    if evidence.session_id != expected_session_id {
        bail!("sessionId does not match active session");
    }
    if evidence.level_version == 0 {
        bail!("levelVersion must be positive");
    }
    if evidence.level_content_hash != expected_level_content_hash {
        bail!("levelContentHash does not match chain catalog");
    }
    if evidence.client_build_hash == B256::ZERO {
        bail!("clientBuildHash must not be zero");
    }
    if !evidence.summary.cleared {
        bail!("only cleared runs can be synced");
    }
    if evidence.started_at_ms >= evidence.finished_at_ms {
        bail!("finishedAtMs must be greater than startedAtMs");
    }

    let measured_duration = evidence.finished_at_ms - evidence.started_at_ms;
    let reported_duration = u64::from(evidence.summary.duration_ms);
    let duration_delta = measured_duration.abs_diff(reported_duration);
    if duration_delta > protocol.duration_drift_slack_ms {
        bail!("summary duration differs from evidence timestamps");
    }

    if evidence.launches.is_empty() {
        bail!("launches must not be empty");
    }
    if evidence.launches.len() != usize::from(evidence.summary.birds_used) {
        bail!("launch count must match birdsUsed");
    }

    let mut expected_launch_index = 0u8;
    let mut last_launch_at = evidence.started_at_ms;
    for launch in &evidence.launches {
        if launch.bird_index != expected_launch_index {
            bail!("launch birdIndex must be sequential");
        }
        if launch.launch_at_ms < last_launch_at || launch.launch_at_ms > evidence.finished_at_ms {
            bail!("launch timestamps must be ordered and inside the run window");
        }
        if launch.bird_type.trim().is_empty() {
            bail!("launch birdType must not be empty");
        }
        expected_launch_index = expected_launch_index.saturating_add(1);
        last_launch_at = launch.launch_at_ms;
    }

    let mut seen_ability_birds = BTreeMap::new();
    let mut last_ability_at = evidence.started_at_ms;
    for ability in &evidence.abilities {
        if usize::from(ability.bird_index) >= evidence.launches.len() {
            bail!("ability birdIndex must reference an existing launch");
        }
        if ability.used_at_ms < last_ability_at || ability.used_at_ms > evidence.finished_at_ms {
            bail!("abilities must be ordered and inside the run window");
        }
        if seen_ability_birds.insert(ability.bird_index, true).is_some() {
            bail!("each bird can use at most one ability");
        }
        last_ability_at = ability.used_at_ms;
    }

    let mut seen_destroy_ids = BTreeMap::new();
    let mut destroyed_pig_count = 0u16;
    let mut last_destroy_at = evidence.started_at_ms;
    for destroy in &evidence.destroys {
        if destroy.entity_id.trim().is_empty() {
            bail!("destroy entityId must not be empty");
        }
        if destroy.at_ms < last_destroy_at || destroy.at_ms > evidence.finished_at_ms {
            bail!("destroys must be ordered and inside the run window");
        }
        if seen_destroy_ids
            .insert(destroy.entity_id.clone(), true)
            .is_some()
        {
            bail!("destroy entityId must be unique");
        }
        if destroy.entity_type == "pig" {
            destroyed_pig_count = destroyed_pig_count.saturating_add(1);
        }
        if destroy.cause.trim().is_empty() {
            bail!("destroy cause must not be empty");
        }
        last_destroy_at = destroy.at_ms;
    }

    if destroyed_pig_count != evidence.summary.destroyed_pigs {
        bail!("destroyed pig count must match summary");
    }

    if evidence.checkpoints.is_empty() {
        bail!("checkpoints must not be empty");
    }
    let mut last_checkpoint_at = evidence.started_at_ms;
    let mut checkpoint_anchor_by_bird = BTreeMap::new();
    for launch in &evidence.launches {
        checkpoint_anchor_by_bird.insert(launch.bird_index, launch.launch_at_ms);
    }
    for checkpoint in &evidence.checkpoints {
        let Some(anchor_at_ms) = checkpoint_anchor_by_bird.get(&checkpoint.bird_index).copied() else {
            bail!("checkpoint birdIndex must reference an existing launch");
        };
        if checkpoint.at_ms < last_checkpoint_at || checkpoint.at_ms > evidence.finished_at_ms {
            bail!("checkpoints must be ordered and inside the run window");
        }
        if checkpoint.at_ms < anchor_at_ms {
            bail!("checkpoint timestamp must not precede its bird launch");
        }
        if checkpoint.at_ms > anchor_at_ms
            && checkpoint.at_ms - anchor_at_ms
                > protocol.checkpoint_interval_ms + protocol.checkpoint_gap_slack_ms
        {
            bail!("checkpoint gap is larger than the allowed cadence");
        }
        checkpoint_anchor_by_bird.insert(checkpoint.bird_index, checkpoint.at_ms);
        last_checkpoint_at = checkpoint.at_ms;
    }

    let evidence_hash = build_evidence_hash(evidence)?;
    let level_id = parse_level_id(&evidence.level_id)?;

    Ok(VerifiedRunRecord {
        run_id: build_run_id(
            evidence.session_id,
            level_id,
            evidence.level_version,
            evidence_hash,
        ),
        level_id,
        level_version: evidence.level_version,
        birds_used: evidence.summary.birds_used,
        destroyed_pigs: evidence.summary.destroyed_pigs,
        duration_ms: evidence.summary.duration_ms,
        evidence_hash,
    })
}

pub fn session_permit_digest(
    permit: &ActiveSessionPermit,
    chain_id: u64,
    verifying_contract: Address,
) -> B256 {
    hash_typed_data(
        domain_separator(SESSION_PERMIT_NAME, SESSION_PERMIT_VERSION, chain_id, verifying_contract),
        hash_session_permit(permit),
    )
}

pub fn verifier_batch_digest(
    permit: &ActiveSessionPermit,
    batch_id: B256,
    runs: &[VerifiedRunRecord],
    chain_id: u64,
    verifying_contract: Address,
) -> B256 {
    let runs_hash = hash_verified_runs(runs);
    hash_typed_data(
        domain_separator(VERIFIED_BATCH_NAME, VERIFIED_BATCH_VERSION, chain_id, verifying_contract),
        hash_verifier_batch(permit, batch_id, runs_hash),
    )
}

pub fn hash_verified_runs(runs: &[VerifiedRunRecord]) -> B256 {
    let hashes = runs
        .iter()
        .map(hash_verified_run)
        .collect::<Vec<_>>();

    keccak256(hashes.abi_encode())
}

pub fn verify_signature(
    digest: B256,
    signature_hex: &str,
    expected_signer: Address,
) -> Result<()> {
    let normalized = signature_hex.trim_start_matches("0x");
    let signature = PrimitiveSignature::from_str(normalized)
        .context("parse signature hex")?;
    let recovered = signature
        .recover_address_from_prehash(&digest)
        .context("recover signature signer")?;
    if recovered != expected_signer {
        bail!("signature signer mismatch");
    }
    Ok(())
}

pub async fn sign_batch_digest(
    signer: &PrivateKeySigner,
    digest: B256,
) -> Result<String> {
    let signature = signer
        .sign_hash(&digest)
        .await
        .context("sign batch digest")?;
    Ok(format!("0x{signature}"))
}

fn hash_session_permit(permit: &ActiveSessionPermit) -> B256 {
    keccak256(
        (
            session_permit_typehash(),
            SessionPermitSol {
                player: permit.player,
                delegate: permit.delegate,
                sessionId: permit.session_id,
                deploymentIdHash: permit.deployment_id_hash,
                issuedAt: permit.issued_at,
                deadline: permit.deadline,
                nonce: permit.nonce,
                maxRuns: permit.max_runs,
            },
        )
        .abi_encode(),
    )
}

fn hash_verified_run(run: &VerifiedRunRecord) -> B256 {
    keccak256(
        (
            verified_run_typehash(),
            VerifiedRunSol {
                runId: run.run_id,
                levelId: run.level_id,
                levelVersion: run.level_version,
                birdsUsed: run.birds_used,
                destroyedPigs: run.destroyed_pigs,
                durationMs: run.duration_ms,
                evidenceHash: run.evidence_hash,
            },
        )
        .abi_encode(),
    )
}

fn hash_verifier_batch(
    permit: &ActiveSessionPermit,
    batch_id: B256,
    runs_hash: B256,
) -> B256 {
    keccak256(
        (
            verified_batch_typehash(),
            VerifierBatchSol {
                player: permit.player,
                delegate: permit.delegate,
                sessionId: permit.session_id,
                nonce: permit.nonce,
                batchId: batch_id,
                runsHash: runs_hash,
            },
        )
        .abi_encode(),
    )
}

fn hash_typed_data(domain_separator: B256, struct_hash: B256) -> B256 {
    let mut bytes = Vec::with_capacity(2 + 32 + 32);
    bytes.extend_from_slice(&[0x19, 0x01]);
    bytes.extend_from_slice(domain_separator.as_slice());
    bytes.extend_from_slice(struct_hash.as_slice());
    keccak256(bytes)
}

fn domain_separator(
    name: &str,
    version: &str,
    chain_id: u64,
    verifying_contract: Address,
) -> B256 {
    keccak256(
        (
            eip712_domain_typehash(),
            keccak256(name.as_bytes()),
            keccak256(version.as_bytes()),
            U256::from(chain_id),
            verifying_contract,
        )
            .abi_encode(),
    )
}

fn eip712_domain_typehash() -> B256 {
    keccak256(
        b"EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)",
    )
}

fn session_permit_typehash() -> B256 {
    keccak256(
        b"SessionPermit(address player,address delegate,bytes32 sessionId,bytes32 deploymentIdHash,uint64 issuedAt,uint64 deadline,uint32 nonce,uint16 maxRuns)",
    )
}

fn verified_run_typehash() -> B256 {
    keccak256(
        b"VerifiedRun(bytes32 runId,bytes32 levelId,uint32 levelVersion,uint8 birdsUsed,uint16 destroyedPigs,uint32 durationMs,bytes32 evidenceHash)",
    )
}

fn verified_batch_typehash() -> B256 {
    keccak256(
        b"VerifierBatch(address player,address delegate,bytes32 sessionId,uint32 nonce,bytes32 batchId,bytes32 runsHash)",
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::read_fixture_text;
    use serde::Deserialize;

    fn sample_permit() -> ActiveSessionPermit {
        ActiveSessionPermit {
            player: Address::repeat_byte(0x11),
            delegate: Address::repeat_byte(0x22),
            session_id: deployment_id_hash("session"),
            deployment_id_hash: deployment_id_hash("local-dev"),
            issued_at: 1_000,
            deadline: 2_000,
            nonce: 7,
            max_runs: 3,
        }
    }

    fn sample_evidence() -> RunEvidenceV1 {
        RunEvidenceV1 {
            session_id: deployment_id_hash("session"),
            level_id: "level-0".to_string(),
            level_version: 1,
            level_content_hash: deployment_id_hash("level-content"),
            client_build_hash: deployment_id_hash("client-build"),
            started_at_ms: 1_000,
            finished_at_ms: 3_000,
            summary: RunSummary {
                birds_used: 1,
                destroyed_pigs: 1,
                duration_ms: 2_000,
                cleared: true,
            },
            launches: vec![LaunchEvidence {
                bird_index: 0,
                bird_type: "red".to_string(),
                launch_at_ms: 1_100,
                drag_x: -120.0,
                drag_y: 80.0,
            }],
            abilities: vec![],
            destroys: vec![DestroyEvidence {
                entity_id: "pig-0".to_string(),
                entity_type: "pig".to_string(),
                at_ms: 2_500,
                cause: "impact".to_string(),
            }],
            checkpoints: vec![
                CheckpointEvidence {
                    at_ms: 1_100,
                    bird_index: 0,
                    x: 100.0,
                    y: 200.0,
                },
                CheckpointEvidence {
                    at_ms: 1_350,
                    bird_index: 0,
                    x: 160.0,
                    y: 220.0,
                },
                CheckpointEvidence {
                    at_ms: 1_600,
                    bird_index: 0,
                    x: 220.0,
                    y: 240.0,
                },
            ],
        }
    }

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct FixtureMeta {
        evidence_hash: B256,
        run_id: B256,
    }

    #[test]
    fn evidence_hash_is_stable() {
        let evidence = sample_evidence();
        assert_eq!(
            build_evidence_hash(&evidence).unwrap(),
            build_evidence_hash(&evidence).unwrap()
        );
    }

    #[test]
    fn shared_fixture_matches_expected_evidence_hash_and_run_id() {
        let evidence: RunEvidenceV1 =
            serde_json::from_str(&read_fixture_text("valid-run-evidence.json").unwrap()).unwrap();
        let meta: FixtureMeta =
            serde_json::from_str(&read_fixture_text("valid-run-evidence.meta.json").unwrap()).unwrap();

        let evidence_hash = build_evidence_hash(&evidence).unwrap();
        let run_id = build_run_id(
            evidence.session_id,
            parse_level_id(&evidence.level_id).unwrap(),
            evidence.level_version,
            evidence_hash,
        );

        assert_eq!(evidence_hash, meta.evidence_hash);
        assert_eq!(run_id, meta.run_id);
    }

    #[test]
    fn validate_evidence_builds_verified_run() {
        let evidence = sample_evidence();
        let run = validate_evidence(
            &evidence,
            evidence.session_id,
            evidence.level_content_hash,
        )
        .unwrap();

        assert_eq!(run.birds_used, 1);
        assert_eq!(run.destroyed_pigs, 1);
        assert_eq!(
            run.run_id,
            build_run_id(
                evidence.session_id,
                parse_level_id(&evidence.level_id).unwrap(),
                evidence.level_version,
                run.evidence_hash,
            )
        );
    }

    #[test]
    fn validate_evidence_rejects_bad_checkpoint_gap() {
        let mut evidence = sample_evidence();
        evidence.checkpoints[1].at_ms = 1_900;
        let error = validate_evidence(
            &evidence,
            evidence.session_id,
            evidence.level_content_hash,
        )
        .unwrap_err();
        assert!(error.to_string().contains("checkpoint gap"));
    }

    #[test]
    fn shared_invalid_checkpoint_fixture_is_rejected() {
        let evidence: RunEvidenceV1 = serde_json::from_str(
            &read_fixture_text("invalid-checkpoint-gap-run-evidence.json").unwrap(),
        )
        .unwrap();
        let error = validate_evidence(
            &evidence,
            evidence.session_id,
            evidence.level_content_hash,
        )
        .unwrap_err();

        assert!(error.to_string().contains("checkpoint gap"));
    }

    #[test]
    fn validate_evidence_accepts_delayed_first_launch_checkpoints() {
        let mut evidence = sample_evidence();
        evidence.launches[0].launch_at_ms = 1_800;
        evidence.checkpoints = vec![
            CheckpointEvidence {
                at_ms: 1_830,
                bird_index: 0,
                x: 100.0,
                y: 200.0,
            },
            CheckpointEvidence {
                at_ms: 2_080,
                bird_index: 0,
                x: 160.0,
                y: 220.0,
            },
            CheckpointEvidence {
                at_ms: 2_330,
                bird_index: 0,
                x: 220.0,
                y: 240.0,
            },
        ];

        let run = validate_evidence(
            &evidence,
            evidence.session_id,
            evidence.level_content_hash,
        )
        .unwrap();

        assert_eq!(run.birds_used, 1);
    }

    #[test]
    fn validate_evidence_accepts_checkpoint_gaps_between_birds() {
        let mut evidence = sample_evidence();
        evidence.finished_at_ms = 4_000;
        evidence.summary.duration_ms = 3_000;
        evidence.summary.birds_used = 2;
        evidence.launches.push(LaunchEvidence {
            bird_index: 1,
            bird_type: "red".to_string(),
            launch_at_ms: 2_700,
            drag_x: -100.0,
            drag_y: 64.0,
        });
        evidence.destroys[0].at_ms = 3_500;
        evidence.checkpoints = vec![
            CheckpointEvidence {
                at_ms: 1_100,
                bird_index: 0,
                x: 100.0,
                y: 200.0,
            },
            CheckpointEvidence {
                at_ms: 1_350,
                bird_index: 0,
                x: 160.0,
                y: 220.0,
            },
            CheckpointEvidence {
                at_ms: 2_720,
                bird_index: 1,
                x: 210.0,
                y: 180.0,
            },
            CheckpointEvidence {
                at_ms: 2_970,
                bird_index: 1,
                x: 260.0,
                y: 205.0,
            },
        ];

        let run = validate_evidence(
            &evidence,
            evidence.session_id,
            evidence.level_content_hash,
        )
        .unwrap();

        assert_eq!(run.birds_used, 2);
    }

    #[tokio::test]
    async fn signer_roundtrip_matches_expected_address() {
        let signer = PrivateKeySigner::from_str(
            "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        )
        .unwrap();
        let permit = sample_permit();
        let digest = session_permit_digest(
            &permit,
            31337,
            Address::repeat_byte(0x33),
        );
        let signature = signer.sign_hash(&digest).await.unwrap();
        verify_signature(
            digest,
            &format!("0x{signature}"),
            signer.address(),
        )
        .unwrap();
    }
}
