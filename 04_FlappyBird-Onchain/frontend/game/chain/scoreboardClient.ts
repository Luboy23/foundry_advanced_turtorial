import { createPublicClient, createWalletClient, custom, http } from 'viem'
import { anvil } from 'viem/chains'
import {
  flappyScoreAbi,
  getChainId,
  getFlappyScoreAddress,
  getFlappyRuntimeConfig,
  isFlappyScoreReady,
  type FlappyScoreLeaderboardEntry,
} from '../../src/lib/contract'

type SubmitScoreResult =
  | { status: 'disabled' | 'no_wallet' | 'no_account' }
  | { status: 'wrong_network'; expected: number; actual: number }
  | { status: 'submitted'; hash: `0x${string}` }

const clientCache = new Map<string, ReturnType<typeof createPublicClient>>()

const getPublicClient = (rpcUrl: string) => {
  const cached = clientCache.get(rpcUrl)
  if (cached) return cached
  const client = createPublicClient({
    chain: anvil,
    transport: http(rpcUrl),
  })
  clientCache.set(rpcUrl, client)
  return client
}

export const isContractReady = (): boolean => isFlappyScoreReady()

export const fetchLeaderboard = async (): Promise<FlappyScoreLeaderboardEntry[]> => {
  if (!isContractReady()) return []
  const runtimeConfig = getFlappyRuntimeConfig()
  const publicClient = getPublicClient(runtimeConfig.rpcUrl) as any
  const [players, scores, timestamps] = (await publicClient.readContract({
    address: getFlappyScoreAddress(),
    abi: flappyScoreAbi,
    functionName: 'getLeaderboard',
  })) as readonly [readonly `0x${string}`[], readonly bigint[], readonly bigint[]]

  return players.map((player, index) => ({
    player: player as `0x${string}`,
    score: scores[index],
    timestamp: timestamps[index],
  }))
}

export const submitScore = async (score: number): Promise<SubmitScoreResult> => {
  if (!isContractReady()) return { status: 'disabled' }
  if (typeof window === 'undefined' || !window.ethereum) {
    return { status: 'no_wallet' }
  }

  const accounts = await window.ethereum.request({ method: 'eth_accounts' }) as string[]
  if (!accounts || accounts.length === 0) {
    return { status: 'no_account' }
  }

  const walletClient = createWalletClient({
    chain: anvil,
    transport: custom(window.ethereum),
  })

  const walletChainId = await walletClient.getChainId()
  if (walletChainId !== getChainId()) {
    return { status: 'wrong_network', expected: getChainId(), actual: walletChainId }
  }

  const hash = (await (walletClient as any).writeContract({
    address: getFlappyScoreAddress(),
    abi: flappyScoreAbi,
    functionName: 'submitScore',
    args: [BigInt(score)],
    account: accounts[0] as `0x${string}`,
  })) as `0x${string}`

  return { status: 'submitted', hash }
}

export const waitForReceipt = (hash: `0x${string}`) =>
  getPublicClient(getFlappyRuntimeConfig().rpcUrl).waitForTransactionReceipt({ hash })
