import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { angryBirdsChain } from './chain'

// wagmi 全局配置：单链 + injected 钱包 + 对应 RPC 传输。
export const wagmiConfig = createConfig({
  chains: [angryBirdsChain],
  connectors: [injected()],
  transports: {
    [angryBirdsChain.id]: http(angryBirdsChain.rpcUrls.default.http[0]),
  },
})
