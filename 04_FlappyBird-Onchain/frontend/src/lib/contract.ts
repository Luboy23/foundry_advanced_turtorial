import flappyScoreAbi from './flappy.abi.json'
import { getRuntimeConfig, type FlappyRuntimeConfig } from './runtime-config'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export type FlappyScoreLeaderboardEntry = {
  player: `0x${string}`
  score: bigint
  timestamp: bigint
}

export { flappyScoreAbi }

export const getFlappyRuntimeConfig = (): FlappyRuntimeConfig => getRuntimeConfig()

export const getFlappyScoreAddress = (): `0x${string}` => getRuntimeConfig().flappyScoreAddress

export const getRpcUrl = (): string => getRuntimeConfig().rpcUrl

export const getChainId = (): number => getRuntimeConfig().chainId

export const isFlappyScoreReady = (): boolean => {
  const address = getFlappyScoreAddress()
  return Boolean(address) && address !== ZERO_ADDRESS
}
