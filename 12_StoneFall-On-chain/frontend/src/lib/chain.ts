/**
 * 模块职责：统一管理链相关基础配置（链 ID、RPC URL）。
 * 说明：运行时优先读取 `public/contract-config.json`，缺失时回退 `.env.local` 与默认值。
 */
import { getResolvedRuntimeConfig } from './runtime-config'

/** 本地开发默认 RPC。 */
export const DEFAULT_RPC_URL = 'http://127.0.0.1:8545'
/**
 * 默认链 ID（Anvil 本地链）。
 */
export const DEFAULT_CHAIN_ID = 31337

const runtimeConfig = getResolvedRuntimeConfig()

/**
 * 最终生效链 ID。
 */
export const STONEFALL_CHAIN_ID = runtimeConfig.chainId

/**
 * 最终生效 RPC URL。
 */
export const STONEFALL_RPC_URL = runtimeConfig.rpcUrl
