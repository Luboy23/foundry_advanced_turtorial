use std::sync::OnceLock;

use serde::Deserialize;

#[cfg(test)]
use anyhow::{Context, Result};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProtocolSpec {
    #[allow(dead_code)]
    pub version: u32,
    pub checkpoint_interval_ms: u64,
    pub checkpoint_gap_slack_ms: u64,
    pub duration_drift_slack_ms: u64,
}

static PROTOCOL_SPEC: OnceLock<ProtocolSpec> = OnceLock::new();

pub fn protocol_spec() -> &'static ProtocolSpec {
    PROTOCOL_SPEC.get_or_init(|| {
        serde_json::from_str(include_str!(
            "../../../shared/angrybirds-protocol/spec.json"
        ))
        .expect("parse shared angrybirds protocol spec")
    })
}

#[cfg(test)]
pub fn read_fixture_text(name: &str) -> Result<String> {
    let path = format!(
        "{}/../../shared/angrybirds-protocol/fixtures/{name}",
        env!("CARGO_MANIFEST_DIR")
    );
    std::fs::read_to_string(&path).with_context(|| format!("read protocol fixture {path}"))
}
