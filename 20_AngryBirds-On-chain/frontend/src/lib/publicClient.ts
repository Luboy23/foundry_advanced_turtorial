import { createPublicClient, http } from 'viem'
import { angryBirdsChain } from './chain'

let publicClient: ReturnType<typeof createPublicClient> | null = null

// 单例公共客户端：统一执行合约只读调用。
export const getPublicClient = () => {
  if (!publicClient) {
    publicClient = createPublicClient({
      chain: angryBirdsChain,
      transport: http(angryBirdsChain.rpcUrls.default.http[0]),
    })
  }

  return publicClient
}
