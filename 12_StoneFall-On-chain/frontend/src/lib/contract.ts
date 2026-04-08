/**
 * 模块职责：提供合约地址、ABI 与链上成绩结构的前端适配逻辑。
 * 说明：本文件注释以“业务意图 + 关键约束”为主，便于后续维护与教学阅读。
 */

import { isAddress } from 'viem'
import stonefallAbi from './stonefall.abi.json'
import { getResolvedRuntimeConfig } from './runtime-config'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const runtimeConfig = getResolvedRuntimeConfig()

/**
 * 从 runtime config 读取合约地址。
 * 若 runtime 文件缺失则自动回退 env/default；零地址视为未部署。
 */
export const STONEFALL_ADDRESS =
  runtimeConfig.stoneFallScoreboardAddress ?? undefined

/**
 * 地址格式校验结果（viem `isAddress`）。
 */
export const STONEFALL_ADDRESS_VALID =
  !!STONEFALL_ADDRESS &&
  STONEFALL_ADDRESS !== ZERO_ADDRESS &&
  isAddress(STONEFALL_ADDRESS)

// ABI 由 scripts/sync-contract.js 从 Foundry 编译产物自动同步。
export const STONEFALL_ABI = stonefallAbi

/**
 * 前端展示用的链上成绩结构（number 化后更便于排序和渲染）。
 */
export type ChainScoreEntry = {
  player: `0x${string}`
  score: number
  survivalMs: number
  totalDodged: number
  finishedAt: number
}

/**
 * 将合约返回的 bigint/number 混合结构规范化为前端统一结构。
 */
export const toChainScoreEntry = (entry: {
  player: `0x${string}`
  score: number | bigint
  survivalMs: number | bigint
  totalDodged: number | bigint
  finishedAt: number | bigint
}): ChainScoreEntry => ({
  player: entry.player,
  score: Number(entry.score),
  survivalMs: Number(entry.survivalMs),
  totalDodged: Number(entry.totalDodged),
  finishedAt: Number(entry.finishedAt),
})

/**
 * 排行榜比较规则：
 * 1) 分数降序
 * 2) 生存时长降序
 * 3) 完成时间升序（更早完成排前）
 */
export const compareChainEntries = (a: ChainScoreEntry, b: ChainScoreEntry) => {
  if (b.score !== a.score) return b.score - a.score
  if (b.survivalMs !== a.survivalMs) return b.survivalMs - a.survivalMs
  return a.finishedAt - b.finishedAt
}
