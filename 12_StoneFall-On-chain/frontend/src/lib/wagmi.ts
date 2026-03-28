/**
 * 模块职责：构建 wagmi 全局配置，约束钱包连接链与传输层。
 * 说明：本文件注释以“业务意图 + 关键约束”为主，便于后续维护与教学阅读。
 */

import { createConfig, http } from "wagmi";
import { injected } from "@wagmi/core";
import { anvil } from "viem/chains";
import { STONEFALL_CHAIN_ID, STONEFALL_RPC_URL } from "./chain";

// 基于 anvil 模板生成本地链定义，便于在 UI 中显示固定链名与 RPC。
const localChain = {
  ...anvil,
  id: STONEFALL_CHAIN_ID,
  name: STONEFALL_CHAIN_ID === anvil.id ? "Anvil" : `Local Chain ${STONEFALL_CHAIN_ID}`,
  rpcUrls: {
    default: { http: [STONEFALL_RPC_URL] },
    public: { http: [STONEFALL_RPC_URL] },
  },
};

/**
 * wagmi 全局配置。
 * - connectors: 仅启用 injected（MetaMask 等浏览器钱包）
 * - transports: 强制把目标链请求发送到本地 RPC
 */
export const wagmiConfig = createConfig({
  chains: [localChain],
  connectors: [injected()],
  transports: {
    [localChain.id]: http(localChain.rpcUrls.default.http[0]),
  },
});
