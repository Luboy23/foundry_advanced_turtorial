import { isAddress } from 'viem'

export type RuntimeScoreboardConfig = {
  address?: `0x${string}`
  rpcUrl?: string
  source: 'runtime' | 'fallback'
}

// 前端运行时配置文件（由 make env / sync 脚本写入）
const SCOREBOARD_CONFIG_URL = '/scoreboard.json'

// 从运行时配置文件读取合约地址与 RPC
export const loadRuntimeConfig = async (): Promise<RuntimeScoreboardConfig> => {
  // SSR 阶段没有 window，直接走 fallback 交给环境变量
  if (typeof window === 'undefined') {
    return { source: 'fallback' }
  }
  try {
    // 带时间戳禁用缓存，确保部署后无需硬刷新即可拿到最新地址
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
    // 读取失败时不抛错，回退到 fallback 配置保持页面可用
    return { source: 'fallback' }
  }
}
