import { isAddress } from 'viem'

const CONTRACT_CONFIG_URL = '/contract-config.json'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const DEFAULT_RPC_URL = 'http://127.0.0.1:8545'
const DEFAULT_CHAIN_ID = 31337
const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787'

type RuntimeConfigSource = {
  braveManGameAddress?: unknown
  rpcUrl?: unknown
  chainId?: unknown
  apiBaseUrl?: unknown
}

export type BraveManRuntimeConfig = {
  braveManGameAddress?: `0x${string}`
  rpcUrl: string
  chainId: number
  apiBaseUrl: string
}

let runtimeConfigCache: BraveManRuntimeConfig | null = null
let runtimeConfigLoadPromise: Promise<BraveManRuntimeConfig> | null = null

const asAddress = (value: unknown): `0x${string}` | undefined => {
  if (typeof value !== 'string' || !isAddress(value) || value === ZERO_ADDRESS) {
    return undefined
  }
  return value as `0x${string}`
}

const asRpcUrl = (value: unknown): string =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : DEFAULT_RPC_URL

const asApiBaseUrl = (value: unknown): string =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : DEFAULT_API_BASE_URL

const asChainId = (value: unknown): number => {
  const candidate = Number(value)
  return Number.isInteger(candidate) && candidate > 0 ? candidate : DEFAULT_CHAIN_ID
}

const normalizeRuntimeConfig = (
  runtimeConfig?: RuntimeConfigSource,
): BraveManRuntimeConfig => ({
  braveManGameAddress: asAddress(runtimeConfig?.braveManGameAddress),
  rpcUrl: asRpcUrl(runtimeConfig?.rpcUrl),
  chainId: asChainId(runtimeConfig?.chainId),
  apiBaseUrl: asApiBaseUrl(runtimeConfig?.apiBaseUrl),
})

const cacheRuntimeConfig = (runtimeConfig: BraveManRuntimeConfig): BraveManRuntimeConfig => {
  runtimeConfigCache = normalizeRuntimeConfig(runtimeConfig)
  return runtimeConfigCache
}

const getEnvRuntimeConfig = (): BraveManRuntimeConfig =>
  normalizeRuntimeConfig({
    braveManGameAddress: import.meta.env.VITE_BRAVEMAN_ADDRESS,
    rpcUrl: import.meta.env.VITE_RPC_URL,
    chainId: import.meta.env.VITE_CHAIN_ID,
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
  })

export const getResolvedRuntimeConfig = (): BraveManRuntimeConfig =>
  runtimeConfigCache ?? getEnvRuntimeConfig()

export const loadRuntimeConfig = async (): Promise<BraveManRuntimeConfig> => {
  if (runtimeConfigCache) {
    return runtimeConfigCache
  }
  if (runtimeConfigLoadPromise) {
    return runtimeConfigLoadPromise
  }
  if (typeof window === 'undefined') {
    return cacheRuntimeConfig(getEnvRuntimeConfig())
  }

  runtimeConfigLoadPromise = (async () => {
    try {
      const response = await fetch(`${CONTRACT_CONFIG_URL}?ts=${Date.now()}`, {
        cache: 'no-store',
      })
      if (response.ok) {
        const data = (await response.json()) as RuntimeConfigSource
        return cacheRuntimeConfig(normalizeRuntimeConfig(data))
      }
    } catch {
      // runtime 配置缺失时自动回退 env/default，不阻断前端启动。
    }

    return cacheRuntimeConfig(getEnvRuntimeConfig())
  })()

  try {
    return await runtimeConfigLoadPromise
  } finally {
    runtimeConfigLoadPromise = null
  }
}
