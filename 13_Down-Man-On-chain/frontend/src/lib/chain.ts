/**
 * 链环境常量。
 * 前端优先读 runtime config，缺失时回退 env/default。
 */
import { getResolvedRuntimeConfig } from './runtime-config'

export const DEFAULT_RPC_URL = 'http://127.0.0.1:8545'
export const DEFAULT_CHAIN_ID = 31337

const runtimeConfig = getResolvedRuntimeConfig()

export const DOWNMAN_CHAIN_ID = runtimeConfig.chainId

export const DOWNMAN_RPC_URL = runtimeConfig.rpcUrl
