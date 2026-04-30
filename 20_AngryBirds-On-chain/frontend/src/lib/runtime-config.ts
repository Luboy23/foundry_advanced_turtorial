import { isAddress } from 'viem'

const CONTRACT_CONFIG_URL = '/contract-config.json'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const DEFAULT_RPC_URL = 'http://127.0.0.1:8545'
const DEFAULT_CHAIN_ID = 31337
const DEFAULT_DEPLOYMENT_ID = 'local-dev'
const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8788/api'

type RuntimeConfigSource = {
  chainId?: unknown
  rpcUrl?: unknown
  deploymentId?: unknown
  apiBaseUrl?: unknown
  angryBirdsLevelCatalogAddress?: unknown
  angryBirdsScoreboardAddress?: unknown
}

export type AngryBirdsRuntimeConfig = {
  chainId: number
  rpcUrl: string
  deploymentId: string
  apiBaseUrl: string
  angryBirdsLevelCatalogAddress?: `0x${string}`
  angryBirdsScoreboardAddress?: `0x${string}`
}

let runtimeConfigCache: AngryBirdsRuntimeConfig | null = null
let runtimeConfigLoadPromise: Promise<AngryBirdsRuntimeConfig> | null = null

// 校验并归一化地址；零地址或非法地址会被视为未配置。
const asAddress = (value: unknown): `0x${string}` | undefined => {
  if (typeof value !== 'string' || !isAddress(value) || value === ZERO_ADDRESS) {
    return undefined
  }
  return value as `0x${string}`
}

// 将任意来源配置收敛为完整运行时配置（带默认值）。
const normalizeRuntimeConfig = (runtimeConfig?: RuntimeConfigSource): AngryBirdsRuntimeConfig => ({
  chainId: Number(runtimeConfig?.chainId) > 0 ? Number(runtimeConfig?.chainId) : DEFAULT_CHAIN_ID,
  rpcUrl:
    typeof runtimeConfig?.rpcUrl === 'string' && runtimeConfig.rpcUrl.trim().length > 0
      ? runtimeConfig.rpcUrl.trim()
      : DEFAULT_RPC_URL,
  deploymentId:
    typeof runtimeConfig?.deploymentId === 'string' && runtimeConfig.deploymentId.trim().length > 0
      ? runtimeConfig.deploymentId.trim()
      : DEFAULT_DEPLOYMENT_ID,
  apiBaseUrl:
    typeof runtimeConfig?.apiBaseUrl === 'string' && runtimeConfig.apiBaseUrl.trim().length > 0
      ? runtimeConfig.apiBaseUrl.trim()
      : DEFAULT_API_BASE_URL,
  angryBirdsLevelCatalogAddress: asAddress(runtimeConfig?.angryBirdsLevelCatalogAddress),
  angryBirdsScoreboardAddress: asAddress(runtimeConfig?.angryBirdsScoreboardAddress),
})

// 读取环境变量配置（作为本地兜底）。
const getEnvRuntimeConfig = (): AngryBirdsRuntimeConfig =>
  normalizeRuntimeConfig({
    chainId: import.meta.env.VITE_CHAIN_ID,
    rpcUrl: import.meta.env.VITE_RPC_URL,
    deploymentId: import.meta.env.VITE_DEPLOYMENT_ID,
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
    angryBirdsLevelCatalogAddress: import.meta.env.VITE_ANGRY_BIRDS_LEVEL_CATALOG_ADDRESS,
    angryBirdsScoreboardAddress: import.meta.env.VITE_ANGRY_BIRDS_SCOREBOARD_ADDRESS,
  })

// 同步读取已解析配置；若未加载远端则返回环境变量配置。
export const getResolvedRuntimeConfig = () => runtimeConfigCache ?? getEnvRuntimeConfig()

// 读取 public/contract-config.json 的最新配置（用于热替换部署地址）。
export const fetchLatestRuntimeConfig = async (): Promise<AngryBirdsRuntimeConfig | null> => {
  if (typeof window === 'undefined') {
    return runtimeConfigCache ?? getEnvRuntimeConfig()
  }

  try {
    const response = await fetch(`${CONTRACT_CONFIG_URL}?ts=${Date.now()}`, { cache: 'no-store' })
    if (!response.ok) {
      return null
    }
    return normalizeRuntimeConfig((await response.json()) as RuntimeConfigSource)
  } catch {
    return null
  }
}

// 异步加载运行时配置并做缓存去重，避免并发重复请求。
export const loadRuntimeConfig = async (): Promise<AngryBirdsRuntimeConfig> => {
  if (runtimeConfigCache) {
    return runtimeConfigCache
  }
  if (runtimeConfigLoadPromise) {
    return runtimeConfigLoadPromise
  }
  if (typeof window === 'undefined') {
    runtimeConfigCache = getEnvRuntimeConfig()
    return runtimeConfigCache
  }

  runtimeConfigLoadPromise = (async () => {
    const latestRuntimeConfig = await fetchLatestRuntimeConfig()
    if (latestRuntimeConfig) {
      runtimeConfigCache = latestRuntimeConfig
      return runtimeConfigCache
    }

    runtimeConfigCache = getEnvRuntimeConfig()
    return runtimeConfigCache
  })()

  try {
    return await runtimeConfigLoadPromise
  } finally {
    runtimeConfigLoadPromise = null
  }
}
