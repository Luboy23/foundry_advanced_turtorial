import { getResolvedRuntimeConfig } from './runtime-config'

/** 本地链默认 RPC 地址，开发环境未配置时回退到此值。 */
export const DEFAULT_RPC_URL = 'http://127.0.0.1:8545'
/** 本地链默认 chainId，对应 Anvil 常用开发链。 */
export const DEFAULT_CHAIN_ID = 31337
/** 后端 API 默认地址，前端未显式配置时使用。 */
export const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787'

const runtimeConfig = getResolvedRuntimeConfig()
/** 前端实际使用的链 ID。 */
export const BRAVEMAN_CHAIN_ID = runtimeConfig.chainId
/** 前端实际使用的 RPC 地址。 */
export const BRAVEMAN_RPC_URL = runtimeConfig.rpcUrl
/** 前端实际调用的后端 API 基地址。 */
export const BRAVEMAN_API_BASE_URL = runtimeConfig.apiBaseUrl

/**
 * 配置约束说明：
 * - `BRAVEMAN_CHAIN_ID` 需与合约部署链一致（本地默认 31337）；
 * - `BRAVEMAN_RPC_URL` 与 `BRAVEMAN_API_BASE_URL` 可独立覆盖，便于分离前端/后端调试；
 * - runtime config 缺失时会自动回退 env/default，减少首次运行门槛。
 */
