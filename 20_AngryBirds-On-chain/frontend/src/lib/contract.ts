import {
  hexToString,
  isAddress,
  parseAbi,
  stringToHex,
} from 'viem'
import { getResolvedRuntimeConfig } from './runtime-config'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const runtimeConfig = getResolvedRuntimeConfig()
// 前端只声明实际会读到的函数/事件签名，减少 ABI 体积。
const ANGRY_BIRDS_LEVEL_CATALOG_SIGNATURES = [
  'function getCatalog() view returns ((bytes32 levelId,uint32 version,bytes32 contentHash,uint32 order,bool enabled)[])',
  'function getLevel(bytes32 levelId, uint32 version) view returns ((bytes32 levelId,uint32 version,bytes32 contentHash,uint32 order,bool enabled))',
  'function isLevelEnabled(bytes32 levelId, uint32 version) view returns (bool)',
  'function levelExists(bytes32 levelId, uint32 version) view returns (bool)',
  'function upsertLevel((bytes32 levelId,uint32 version,bytes32 contentHash,uint32 order,bool enabled) config)',
  'function setLevelEnabled(bytes32 levelId, uint32 version, bool enabled)',
] as const
const ANGRY_BIRDS_SCOREBOARD_SIGNATURES = [
  'function getLeaderboard(bytes32 levelId, uint32 version) view returns ((address player,(bytes32 levelId,uint32 levelVersion,uint8 birdsUsed,uint16 destroyedPigs,uint32 durationMs,bytes32 evidenceHash,uint64 submittedAt) result)[])',
  'function getGlobalLeaderboard() view returns ((address player,(bytes32 levelId,uint32 levelVersion,uint8 birdsUsed,uint16 destroyedPigs,uint32 durationMs,bytes32 evidenceHash,uint64 submittedAt) result)[])',
  'function getUserHistory(address player, uint256 offset, uint256 limit) view returns ((bytes32 levelId,uint32 levelVersion,uint8 birdsUsed,uint16 destroyedPigs,uint32 durationMs,bytes32 evidenceHash,uint64 submittedAt)[])',
  'function getUserHistoryCount(address player) view returns (uint256)',
  'event GlobalBestUpdated(address indexed player, bytes32 indexed levelId, uint32 indexed levelVersion, uint8 birdsUsed, uint32 durationMs, bytes32 evidenceHash)',
] as const

export const ANGRY_BIRDS_LEVEL_CATALOG_ABI = parseAbi(ANGRY_BIRDS_LEVEL_CATALOG_SIGNATURES)

export const ANGRY_BIRDS_SCOREBOARD_ABI = parseAbi(ANGRY_BIRDS_SCOREBOARD_SIGNATURES)

export const ANGRY_BIRDS_LEVEL_CATALOG_ADDRESS = runtimeConfig.angryBirdsLevelCatalogAddress
export const ANGRY_BIRDS_SCOREBOARD_ADDRESS = runtimeConfig.angryBirdsScoreboardAddress

export const ANGRY_BIRDS_LEVEL_CATALOG_ADDRESS_VALID =
  !!ANGRY_BIRDS_LEVEL_CATALOG_ADDRESS &&
  ANGRY_BIRDS_LEVEL_CATALOG_ADDRESS !== ZERO_ADDRESS &&
  isAddress(ANGRY_BIRDS_LEVEL_CATALOG_ADDRESS)

export const ANGRY_BIRDS_SCOREBOARD_ADDRESS_VALID =
  !!ANGRY_BIRDS_SCOREBOARD_ADDRESS &&
  ANGRY_BIRDS_SCOREBOARD_ADDRESS !== ZERO_ADDRESS &&
  isAddress(ANGRY_BIRDS_SCOREBOARD_ADDRESS)

export type ChainLevelConfig = {
  levelId: string
  version: number
  contentHash: `0x${string}`
  order: number
  enabled: boolean
}

export type ChainRunResult = {
  levelId: string
  levelVersion: number
  birdsUsed: number
  destroyedPigs: number
  durationMs: number
  evidenceHash: `0x${string}`
  submittedAt: number
}

export type ChainLeaderboardEntry = {
  player: `0x${string}`
  result: ChainRunResult
}

const toNumber = (value: unknown) => Number(value ?? 0)
const asObject = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}

// 关卡 ID 与 bytes32 的双向转换，保证链上/前端键一致。
export const levelIdToBytes32 = (levelId: string) => stringToHex(levelId, { size: 32 })

export const bytes32ToLevelId = (value: `0x${string}`) =>
  hexToString(value, { size: 32 }).replace(/\0/g, '')

// 归一化链上关卡配置结构，统一为前端使用的基础类型。
export const normalizeLevelConfig = (value: unknown): ChainLevelConfig => {
  const raw = asObject(value)
  return {
    levelId: bytes32ToLevelId((raw.levelId ?? stringToHex('', { size: 32 })) as `0x${string}`),
    version: toNumber(raw.version),
    contentHash: (raw.contentHash ?? stringToHex('', { size: 32 })) as `0x${string}`,
    order: toNumber(raw.order),
    enabled: Boolean(raw.enabled),
  }
}

// 归一化链上 run 结构，消除 bigint/tuple 差异。
export const normalizeRunResult = (value: unknown): ChainRunResult => {
  const raw = asObject(value)
  return {
    levelId: bytes32ToLevelId((raw.levelId ?? stringToHex('', { size: 32 })) as `0x${string}`),
    levelVersion: toNumber(raw.levelVersion),
    birdsUsed: toNumber(raw.birdsUsed),
    destroyedPigs: toNumber(raw.destroyedPigs),
    durationMs: toNumber(raw.durationMs),
    evidenceHash: (raw.evidenceHash ?? stringToHex('', { size: 32 })) as `0x${string}`,
    submittedAt: toNumber(raw.submittedAt),
  }
}

// 归一化排行榜条目，组合 player 与 result。
export const normalizeLeaderboardEntry = (value: unknown): ChainLeaderboardEntry => {
  const raw = asObject(value)
  return {
    player: (raw.player ?? ZERO_ADDRESS) as `0x${string}`,
    result: normalizeRunResult(raw.result),
  }
}

// 成绩排序规则：先比用鸟数，再比用时，最后比提交时间。
export const compareRunResults = (left: ChainRunResult, right: ChainRunResult) => {
  if (left.birdsUsed !== right.birdsUsed) return left.birdsUsed - right.birdsUsed
  if (left.durationMs !== right.durationMs) return left.durationMs - right.durationMs
  return left.submittedAt - right.submittedAt
}

// 地址缩略展示。
export const shortAddress = (address?: `0x${string}`) => {
  if (!address) {
    return 'guest'
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
