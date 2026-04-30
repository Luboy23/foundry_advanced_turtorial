import { createConfig, http } from "wagmi";
import { injected } from "@wagmi/core";
import { defineChain } from "viem";
import { getRuntimeConfig } from "@/lib/runtime-config";

const runtimeConfig = getRuntimeConfig();

export const creatorRevenueChain = defineChain({
  id: runtimeConfig.chainId,
  name: "创作者收益中心本地链",
  nativeCurrency: {
    decimals: 18,
    name: "以太币",
    symbol: "ETH"
  },
  rpcUrls: {
    default: {
      http: [runtimeConfig.rpcUrl]
    }
  }
});

export const wagmiConfig = createConfig({
  ssr: true,
  chains: [creatorRevenueChain],
  connectors: [injected()],
  transports: {
    [creatorRevenueChain.id]: http(runtimeConfig.rpcUrl)
  }
});
