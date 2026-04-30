import { anvil } from 'viem/chains'
import { getResolvedRuntimeConfig } from './runtime-config'

const runtimeConfig = getResolvedRuntimeConfig()

export const ANGRY_BIRDS_CHAIN_ID = runtimeConfig.chainId
export const ANGRY_BIRDS_RPC_URL = runtimeConfig.rpcUrl
export const ANGRY_BIRDS_DEPLOYMENT_ID = runtimeConfig.deploymentId

// 基于 viem 内置 anvil 链模板构建运行时链配置。
export const angryBirdsChain = {
  ...anvil,
  id: ANGRY_BIRDS_CHAIN_ID,
  name: ANGRY_BIRDS_CHAIN_ID === anvil.id ? 'Anvil' : `Local Chain ${ANGRY_BIRDS_CHAIN_ID}`,
  rpcUrls: {
    default: { http: [ANGRY_BIRDS_RPC_URL] },
    public: { http: [ANGRY_BIRDS_RPC_URL] },
  },
}
