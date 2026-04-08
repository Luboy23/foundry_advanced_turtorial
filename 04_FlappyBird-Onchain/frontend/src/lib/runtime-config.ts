const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const DEFAULT_RPC_URL = 'http://127.0.0.1:8545'
const DEFAULT_CHAIN_ID = 31337

export type FlappyRuntimeConfig = {
  flappyScoreAddress: `0x${string}`
  rpcUrl: string
  chainId: number
}

export const normalizeRuntimeConfig = (
  runtimeConfig: Partial<FlappyRuntimeConfig> = {},
): FlappyRuntimeConfig => ({
  flappyScoreAddress:
    typeof runtimeConfig.flappyScoreAddress === 'string' &&
    /^0x[a-fA-F0-9]{40}$/.test(runtimeConfig.flappyScoreAddress)
      ? (runtimeConfig.flappyScoreAddress as `0x${string}`)
      : ZERO_ADDRESS,
  rpcUrl:
    typeof runtimeConfig.rpcUrl === 'string' && runtimeConfig.rpcUrl.trim()
      ? runtimeConfig.rpcUrl.trim()
      : DEFAULT_RPC_URL,
  chainId:
    typeof runtimeConfig.chainId === "number" && Number.isFinite(runtimeConfig.chainId)
      ? runtimeConfig.chainId
      : DEFAULT_CHAIN_ID,
})

let runtimeConfigCache = normalizeRuntimeConfig({
  flappyScoreAddress: import.meta.env.VITE_FLAPPY_SCORE_ADDRESS,
  rpcUrl: import.meta.env.VITE_RPC_URL || import.meta.env.VITE_ANVIL_RPC_URL,
  chainId: Number(import.meta.env.VITE_CHAIN_ID),
})

export const getRuntimeConfig = (): FlappyRuntimeConfig => runtimeConfigCache

export const loadRuntimeConfig = async (): Promise<FlappyRuntimeConfig> => {
  try {
    const response = await fetch(`/contract-config.json?ts=${Date.now()}`, {
      cache: 'no-store',
    })
    if (response.ok) {
      const data = (await response.json()) as Partial<FlappyRuntimeConfig>
      runtimeConfigCache = normalizeRuntimeConfig(data)
      return runtimeConfigCache
    }
  } catch {
    // ignore and fall back to env/default values
  }

  return runtimeConfigCache
}
