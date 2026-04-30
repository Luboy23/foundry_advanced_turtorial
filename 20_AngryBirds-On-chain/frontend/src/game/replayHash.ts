import { keccak256, stringToHex } from 'viem'
import { getResolvedRuntimeConfig } from '../lib/runtime-config'
export {
  ANGRY_BIRDS_PROTOCOL,
  buildEvidenceHash,
  buildRunId,
  canonicalizeRunEvidence,
  canonicalizeRunEvidenceJson,
  parseLevelIdToBytes32,
} from '../protocol/angryBirdsProtocol'

export const buildClientBuildHash = () =>
  keccak256(stringToHex(JSON.stringify({ deploymentId: getResolvedRuntimeConfig().deploymentId }))) as `0x${string}`
