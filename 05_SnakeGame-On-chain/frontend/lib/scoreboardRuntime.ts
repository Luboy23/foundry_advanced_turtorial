import { isAddress } from 'viem'

export type RuntimeScoreboardConfig = {
  address?: `0x${string}`
  rpcUrl?: string
  source: 'runtime' | 'fallback'
}

const SCOREBOARD_CONFIG_URL = '/scoreboard.json'

// 从运行时配置文件读取合约地址与 RPC
export const loadRuntimeConfig = async (): Promise<RuntimeScoreboardConfig> => {
  if (typeof window === 'undefined') {
    return { source: 'fallback' }
  }
  try {
    const response = await fetch(
      `${SCOREBOARD_CONFIG_URL}?ts=${Date.now()}`,
      { cache: 'no-store' }
    )
    if (!response.ok) {
      return { source: 'fallback' }
    }
    const data = await response.json()
    const address = isAddress(data?.address)
      ? (data.address as `0x${string}`)
      : undefined
    const rpcUrl =
      typeof data?.rpcUrl === 'string' && data.rpcUrl.trim()
        ? data.rpcUrl.trim()
        : undefined
    if (!address && !rpcUrl) {
      return { source: 'fallback' }
    }
    return { address, rpcUrl, source: 'runtime' }
  } catch {
    return { source: 'fallback' }
  }
}
