import { createConfig, http } from 'wagmi'
import { injected } from '@wagmi/core'
import { anvil } from 'viem/chains'
import { BRAVEMAN_CHAIN_ID, BRAVEMAN_RPC_URL } from './chain'

// 本地链描述：以 anvil 为模板，覆盖链 ID 与 RPC 入口。
const localChain = {
  ...anvil,
  id: BRAVEMAN_CHAIN_ID,
  name: BRAVEMAN_CHAIN_ID === anvil.id ? 'Anvil' : `Local Chain ${BRAVEMAN_CHAIN_ID}`,
  rpcUrls: {
    default: { http: [BRAVEMAN_RPC_URL] },
    public: { http: [BRAVEMAN_RPC_URL] },
  },
}

// wagmi 全局配置：仅启用本地链与 injected 钱包连接器。
export const wagmiConfig = createConfig({
  // 当前项目只面向单链教学环境，避免多链切换带来的状态分叉复杂度。
  chains: [localChain],
  // 仅启用浏览器注入钱包（MetaMask/OKX Wallet 等）。
  connectors: [injected()],
  transports: {
    // transport 必须与 chains 中的 id 一一对应。
    [localChain.id]: http(localChain.rpcUrls.default.http[0]),
  },
})
