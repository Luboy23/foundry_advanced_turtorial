import { encodeAbiParameters, keccak256, stringToHex } from 'viem'
import type { RunEvidenceV1 } from '../game/types'
import protocolSpec from '../../../shared/angrybirds-protocol/spec.json'

type OrderedKey = keyof RunEvidenceV1['summary']

type ProtocolSpec = {
  version: number
  checkpointIntervalMs: number
  checkpointGapSlackMs: number
  durationDriftSlackMs: number
  runEvidenceV1FieldOrder: Array<keyof RunEvidenceV1>
  runSummaryFieldOrder: OrderedKey[]
  launchFieldOrder: Array<keyof RunEvidenceV1['launches'][number]>
  abilityFieldOrder: Array<keyof RunEvidenceV1['abilities'][number]>
  destroyFieldOrder: Array<keyof RunEvidenceV1['destroys'][number]>
  checkpointFieldOrder: Array<keyof RunEvidenceV1['checkpoints'][number]>
}

const SPEC = protocolSpec as ProtocolSpec

const pickOrdered = <T extends Record<string, unknown>, K extends keyof T>(
  source: T,
  keys: readonly K[],
): Pick<T, K> => {
  const ordered = {} as Pick<T, K>
  for (const key of keys) {
    ordered[key] = source[key]
  }
  return ordered
}

export const ANGRY_BIRDS_PROTOCOL = Object.freeze({
  version: SPEC.version,
  checkpointIntervalMs: SPEC.checkpointIntervalMs,
  checkpointGapSlackMs: SPEC.checkpointGapSlackMs,
  durationDriftSlackMs: SPEC.durationDriftSlackMs,
})

export const canonicalizeRunEvidence = (payload: RunEvidenceV1) =>
  pickOrdered(
    {
      sessionId: payload.sessionId,
      levelId: payload.levelId,
      levelVersion: payload.levelVersion,
      levelContentHash: payload.levelContentHash,
      clientBuildHash: payload.clientBuildHash,
      startedAtMs: payload.startedAtMs,
      finishedAtMs: payload.finishedAtMs,
      summary: pickOrdered(payload.summary, SPEC.runSummaryFieldOrder),
      launches: payload.launches.map((entry) => pickOrdered(entry, SPEC.launchFieldOrder)),
      abilities: payload.abilities.map((entry) => pickOrdered(entry, SPEC.abilityFieldOrder)),
      destroys: payload.destroys.map((entry) => pickOrdered(entry, SPEC.destroyFieldOrder)),
      checkpoints: payload.checkpoints.map((entry) => pickOrdered(entry, SPEC.checkpointFieldOrder)),
    },
    SPEC.runEvidenceV1FieldOrder,
  )

const serializeString = (value: string) => JSON.stringify(value)

const serializeInteger = (value: number) => `${value}`

const serializeFloat = (value: number) => (Number.isInteger(value) ? `${value.toFixed(1)}` : `${value}`)

const serializeSummary = (summary: RunEvidenceV1['summary']) =>
  `{"birdsUsed":${serializeInteger(summary.birdsUsed)},"destroyedPigs":${serializeInteger(summary.destroyedPigs)},"durationMs":${serializeInteger(summary.durationMs)},"cleared":${summary.cleared ? 'true' : 'false'}}`

const serializeLaunch = (launch: RunEvidenceV1['launches'][number]) =>
  `{"birdIndex":${serializeInteger(launch.birdIndex)},"birdType":${serializeString(launch.birdType)},"launchAtMs":${serializeInteger(launch.launchAtMs)},"dragX":${serializeFloat(launch.dragX)},"dragY":${serializeFloat(launch.dragY)}}`

const serializeAbility = (ability: RunEvidenceV1['abilities'][number]) =>
  `{"birdIndex":${serializeInteger(ability.birdIndex)},"usedAtMs":${serializeInteger(ability.usedAtMs)}}`

const serializeDestroy = (destroy: RunEvidenceV1['destroys'][number]) =>
  `{"entityId":${serializeString(destroy.entityId)},"entityType":${serializeString(destroy.entityType)},"atMs":${serializeInteger(destroy.atMs)},"cause":${serializeString(destroy.cause)}}`

const serializeCheckpoint = (checkpoint: RunEvidenceV1['checkpoints'][number]) =>
  `{"atMs":${serializeInteger(checkpoint.atMs)},"birdIndex":${serializeInteger(checkpoint.birdIndex)},"x":${serializeFloat(checkpoint.x)},"y":${serializeFloat(checkpoint.y)}}`

export const canonicalizeRunEvidenceJson = (payload: RunEvidenceV1) =>
  `{"sessionId":${serializeString(payload.sessionId)},"levelId":${serializeString(payload.levelId)},"levelVersion":${serializeInteger(payload.levelVersion)},"levelContentHash":${serializeString(payload.levelContentHash)},"clientBuildHash":${serializeString(payload.clientBuildHash)},"startedAtMs":${serializeInteger(payload.startedAtMs)},"finishedAtMs":${serializeInteger(payload.finishedAtMs)},"summary":${serializeSummary(payload.summary)},"launches":[${payload.launches.map(serializeLaunch).join(',')}],"abilities":[${payload.abilities.map(serializeAbility).join(',')}],"destroys":[${payload.destroys.map(serializeDestroy).join(',')}],"checkpoints":[${payload.checkpoints.map(serializeCheckpoint).join(',')}]}`

export const buildEvidenceHash = (payload: RunEvidenceV1) =>
  keccak256(stringToHex(canonicalizeRunEvidenceJson(payload))) as `0x${string}`

export const parseLevelIdToBytes32 = (levelId: string) => {
  if (levelId.trim().length === 0) {
    throw new Error('levelId must not be empty')
  }
  if (new TextEncoder().encode(levelId).length > 32) {
    throw new Error('levelId must fit into bytes32')
  }
  return stringToHex(levelId, { size: 32 }) as `0x${string}`
}

export const buildRunId = (
  sessionId: `0x${string}`,
  levelId: string,
  levelVersion: number,
  evidenceHash: `0x${string}`,
) =>
  keccak256(
    encodeAbiParameters(
      [
        { type: 'bytes32' },
        { type: 'bytes32' },
        { type: 'uint32' },
        { type: 'bytes32' },
      ],
      [sessionId, parseLevelIdToBytes32(levelId), levelVersion, evidenceHash],
    ),
  ) as `0x${string}`
