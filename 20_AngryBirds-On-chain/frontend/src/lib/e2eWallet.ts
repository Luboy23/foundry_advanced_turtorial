import { createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import type { WalletClient } from 'viem'
import { angryBirdsChain } from './chain'

const DEFAULT_E2E_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'

export const E2E_BYPASS_WALLET = import.meta.env.VITE_E2E_BYPASS_WALLET === '1'

// 构建 E2E 测试专用账户；可由环境变量覆盖默认私钥。
const getE2EAccount = () => {
  const privateKey = (import.meta.env.VITE_E2E_ACCOUNT_PRIVATE_KEY ||
    DEFAULT_E2E_PRIVATE_KEY) as `0x${string}`
  return privateKeyToAccount(privateKey)
}

let e2eWalletClient: WalletClient | null = null

// 懒加载 E2E 钱包客户端，测试模式下绕过真实钱包连接流程。
export const getE2EWalletClient = (): WalletClient | null => {
  if (!E2E_BYPASS_WALLET) {
    return null
  }

  if (!e2eWalletClient) {
    e2eWalletClient = createWalletClient({
      account: getE2EAccount(),
      chain: angryBirdsChain,
      transport: http(angryBirdsChain.rpcUrls.default.http[0]),
    })
  }

  return e2eWalletClient
}

// 返回 E2E 钱包地址（仅在 bypass 模式下生效）。
export const getE2EWalletAddress = () => {
  if (!E2E_BYPASS_WALLET) {
    return undefined
  }

  return getE2EAccount().address
}
