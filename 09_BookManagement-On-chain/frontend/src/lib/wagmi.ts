import { QueryClient } from "@tanstack/react-query";
import { createConfig, http, injected } from "wagmi";
import { defineChain } from "viem";
import { TARGET_CHAIN_ID } from "@/lib/registry";

// RPC 地址：默认连接本地 Anvil
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545";

// 自定义本地链配置（用于 wagmi）
export const localAnvil = defineChain({
  id: TARGET_CHAIN_ID,
  name: "Anvil",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [rpcUrl] },
    public: { http: [rpcUrl] },
  },
});

// wagmi 全局配置：连接器 + 链 + transport
export const wagmiConfig = createConfig({
  chains: [localAnvil],
  connectors: [injected()],
  transports: {
    [localAnvil.id]: http(rpcUrl),
  },
});

// React Query 客户端（缓存链上读取）
export const queryClient = new QueryClient();
