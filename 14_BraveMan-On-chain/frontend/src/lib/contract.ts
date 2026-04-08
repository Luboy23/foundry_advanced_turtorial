import { isAddress } from 'viem'
import bravemanAbi from './braveman.abi.json'
import { getResolvedRuntimeConfig } from './runtime-config'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const runtimeConfig = getResolvedRuntimeConfig()

/** ERC1155: GOLD 的固定 tokenId。 */
export const GOLD_TOKEN_ID = 1n
/** ERC1155: 弓永久解锁凭证的 tokenId。 */
export const BOW_UNLOCK_TOKEN_ID = 2n
/** 霜翎逐月固定价格（单位：GOLD）。 */
export const BOW_PRICE = 10n

/** 从环境变量读取合约地址；未配置时返回 `undefined`。 */
export const BRAVEMAN_ADDRESS =
  runtimeConfig.braveManGameAddress ?? undefined

/** 地址格式合法性标记，用于 UI 启动门禁提示。 */
export const BRAVEMAN_ADDRESS_VALID =
  !!BRAVEMAN_ADDRESS &&
  BRAVEMAN_ADDRESS !== ZERO_ADDRESS &&
  isAddress(BRAVEMAN_ADDRESS)
/** 前端调用合约时使用的 ABI。 */
export const BRAVEMAN_ABI = bravemanAbi

/** 前端历史弹窗展示结构（已将 bigint 转成 number）。 */
export type ChainRunRecord = {
  player: `0x${string}`
  kills: number
  survivalMs: number
  goldEarned: number
  endedAt: number
}

/**
 * 前端待上链结算结构。
 * 字段与 Solidity `Settlement` 一一对应，保证 `claimSettlement` 参数对齐。
 */
export type SettlementPayload = {
  sessionId: `0x${string}`
  player: `0x${string}`
  kills: number
  survivalMs: number
  goldEarned: number
  endedAt: number
  rulesetVersion: number
  configHash: `0x${string}`
}

/**
 * 将链上读取到的 bigint 字段转换为前端可直接渲染的 number 结构。
 * 说明：
 * - 历史展示数据量级受业务约束，不会超过 JS number 安全范围；
 * - 如后续引入大数结算，需切换为 bigint/string 渲染策略。
 */
export const toChainRunRecord = (entry: {
  player: `0x${string}`
  kills: number | bigint
  survivalMs: number | bigint
  goldEarned: number | bigint
  endedAt: number | bigint
}): ChainRunRecord => ({
  player: entry.player,
  kills: Number(entry.kills),
  survivalMs: Number(entry.survivalMs),
  goldEarned: Number(entry.goldEarned),
  endedAt: Number(entry.endedAt),
})

/** 把前端 settlement 对象映射为合约函数 `claimSettlement` 的参数结构。 */
export const settlementToArgs = (settlement: SettlementPayload) => ({
  // 参数顺序与 Solidity struct 声明顺序保持一致，避免编码错位。
  sessionId: settlement.sessionId,
  player: settlement.player,
  kills: settlement.kills,
  survivalMs: settlement.survivalMs,
  goldEarned: settlement.goldEarned,
  endedAt: settlement.endedAt,
  rulesetVersion: settlement.rulesetVersion,
  configHash: settlement.configHash,
})
