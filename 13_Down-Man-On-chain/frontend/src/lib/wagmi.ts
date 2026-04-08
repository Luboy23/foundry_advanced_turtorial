/**
 * Wagmi 配置。
 * 当前只接本地链，并默认启用 injected connector。
 */
import { createConfig, http } from "wagmi";
import { injected } from "@wagmi/core";
import { anvil } from "viem/chains";
import { DOWNMAN_CHAIN_ID, DOWNMAN_RPC_URL } from "./chain";

// 复用 anvil 的默认元数据，但允许链 ID / 名称 / RPC 通过环境变量切换。
const localChain = {
  ...anvil,
  id: DOWNMAN_CHAIN_ID,
  name: DOWNMAN_CHAIN_ID === anvil.id ? "Anvil" : `Local Chain ${DOWNMAN_CHAIN_ID}`,
  rpcUrls: {
    default: { http: [DOWNMAN_RPC_URL] },
    public: { http: [DOWNMAN_RPC_URL] },
  },
};

// 当前项目只暴露一条本地链，减少钱包选择与错误链切换的复杂度。
export const wagmiConfig = createConfig({
  chains: [localChain],
  connectors: [injected()],
  transports: {
    [localChain.id]: http(localChain.rpcUrls.default.http[0]),
  },
});
