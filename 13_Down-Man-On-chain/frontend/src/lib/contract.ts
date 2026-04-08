/**
 * 合约接线工具。
 * 负责读取环境变量、暴露 ABI，并把链上原始结构转成前端统一的成绩对象。
 */
import { isAddress } from 'viem'
import downmanAbi from './downman.abi.json'
import { getResolvedRuntimeConfig } from './runtime-config'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const runtimeConfig = getResolvedRuntimeConfig()

export const DOWNMAN_ADDRESS =
  runtimeConfig.downManScoreboardAddress ?? undefined

// 读取地址后立即做基础校验，供 UI 判断“未部署”与“已部署但读取失败”。
export const DOWNMAN_ADDRESS_VALID =
  !!DOWNMAN_ADDRESS &&
  DOWNMAN_ADDRESS !== ZERO_ADDRESS &&
  isAddress(DOWNMAN_ADDRESS)

// ABI 由 scripts/sync-contract.js 从 Foundry 编译产物自动同步。
export const DOWNMAN_ABI = downmanAbi

export type ChainScoreEntry = {
  player: `0x${string}`
  score: number
  survivalMs: number
  totalDodged: number
  finishedAt: number
}

// 合约读取得到的 tuple / struct 可能带 bigint，这里统一做一次归一化。
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

// 排行榜排序与合约规则保持一致：先比得分，再比存活时长，最后比更早达成时间。
export const compareChainEntries = (a: ChainScoreEntry, b: ChainScoreEntry) => {
  if (b.score !== a.score) return b.score - a.score
  if (b.survivalMs !== a.survivalMs) return b.survivalMs - a.survivalMs
  return a.finishedAt - b.finishedAt
}
