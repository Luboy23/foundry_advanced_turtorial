import { isAddress } from 'viem'

export type RuntimeScoreboardConfig = {
  address?: `0x${string}`
  rpcUrl?: string
  chainId?: number
  source: 'runtime' | 'legacy' | 'fallback'
}

const CONTRACT_CONFIG_URL = '/contract-config.json'
const LEGACY_SCOREBOARD_CONFIG_URL = '/scoreboard.json'

const normalizeRuntimeConfig = (
  data: unknown,
  source: RuntimeScoreboardConfig['source']
): RuntimeScoreboardConfig => {
  const candidate = typeof data === 'object' && data !== null ? data : {}
  const config = candidate as Record<string, unknown>
  const addressCandidate =
    config.scoreboardAddress ?? config.address
  const address =
    typeof addressCandidate === 'string' && isAddress(addressCandidate)
    ? (addressCandidate as `0x${string}`)
    : undefined
  const rpcUrl =
    typeof config.rpcUrl === 'string' && config.rpcUrl.trim()
      ? config.rpcUrl.trim()
      : undefined
  const chainId =
    typeof config.chainId === 'number' && Number.isFinite(config.chainId)
      ? config.chainId
      : undefined
  if (!address && !rpcUrl && !chainId) {
    return { source: 'fallback' }
  }
  return { address, rpcUrl, chainId, source }
}

export const loadRuntimeConfig = async (): Promise<RuntimeScoreboardConfig> => {
  if (typeof window === 'undefined') {
    return { source: 'fallback' }
  }
  try {
    const response = await fetch(
      `${CONTRACT_CONFIG_URL}?ts=${Date.now()}`,
      { cache: 'no-store' }
    )
    if (!response.ok) {
      throw new Error('runtime_missing')
    }
    const data = await response.json()
    const runtimeConfig = normalizeRuntimeConfig(data, 'runtime')
    if (runtimeConfig.source !== 'fallback') {
      return runtimeConfig
    }
  } catch {
    // 继续尝试旧版 runtime 文件
  }

  try {
    const response = await fetch(
      `${LEGACY_SCOREBOARD_CONFIG_URL}?ts=${Date.now()}`,
      { cache: 'no-store' }
    )
    if (!response.ok) {
      return { source: 'fallback' }
    }
    const data = await response.json()
    const runtimeConfig = normalizeRuntimeConfig(data, 'legacy')
    return runtimeConfig.source === 'fallback'
      ? { source: 'fallback' }
      : runtimeConfig
  } catch {
    return { source: 'fallback' }
  }
}
