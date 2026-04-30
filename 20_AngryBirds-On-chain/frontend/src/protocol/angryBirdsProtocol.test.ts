import { describe, expect, it } from 'vitest'
import validFixture from '../../../shared/angrybirds-protocol/fixtures/valid-run-evidence.json'
import validFixtureMeta from '../../../shared/angrybirds-protocol/fixtures/valid-run-evidence.meta.json'
import invalidCheckpointFixture from '../../../shared/angrybirds-protocol/fixtures/invalid-checkpoint-gap-run-evidence.json'
import { buildEvidenceHash, buildRunId, canonicalizeRunEvidenceJson } from './angryBirdsProtocol'
import { ANGRY_BIRDS_PROTOCOL } from '../game/replayHash'
import type { RunEvidenceV1 } from '../game/types'

describe('angryBirdsProtocol', () => {
  it('matches the shared fixture evidenceHash and runId', () => {
    const evidence = validFixture as RunEvidenceV1

    expect(buildEvidenceHash(evidence)).toBe(validFixtureMeta.evidenceHash)
    expect(
      buildRunId(
        evidence.sessionId,
        evidence.levelId,
        evidence.levelVersion,
        validFixtureMeta.evidenceHash as `0x${string}`,
      ),
    ).toBe(
      validFixtureMeta.runId,
    )
  })

  it('serializes evidence with the shared canonical field order', () => {
    const evidence = validFixture as RunEvidenceV1
    expect(canonicalizeRunEvidenceJson(evidence)).toContain('"sessionId"')
    expect(canonicalizeRunEvidenceJson(evidence).indexOf('"summary"')).toBeLessThan(
      canonicalizeRunEvidenceJson(evidence).indexOf('"launches"'),
    )
  })

  it('exposes the shared cadence constants', () => {
    expect(ANGRY_BIRDS_PROTOCOL.checkpointIntervalMs).toBe(250)
    expect(ANGRY_BIRDS_PROTOCOL.checkpointGapSlackMs).toBe(120)
    expect(ANGRY_BIRDS_PROTOCOL.durationDriftSlackMs).toBe(300)
  })

  it('keeps the invalid checkpoint fixture hashable for cross-language regression coverage', () => {
    const evidence = invalidCheckpointFixture as RunEvidenceV1
    expect(buildEvidenceHash(evidence)).toMatch(/^0x[0-9a-f]{64}$/)
  })
})
