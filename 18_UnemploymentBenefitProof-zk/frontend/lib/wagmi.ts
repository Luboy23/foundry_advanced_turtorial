import { createConfig, http } from "wagmi";
import { injected } from "@wagmi/core";
import { defineChain } from "viem";

/**
 * Wagmi 运行时配置。
 *
 * 当前项目固定面向本地教学链，所以这里显式定义 `31337` 环境，确保钱包连接、链切换和
 * SSR hydration 都围绕同一条链展开。
 */
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545";
const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "31337");

export const unemploymentBenefitLocal = defineChain({
  id: chainId,
  name: "UnemploymentBenefit Local",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH"
  },
  rpcUrls: {
    default: {
      http: [rpcUrl]
    }
  }
});

/** 正式前端共享的 wagmi config。 */
export const wagmiConfig = createConfig({
  ssr: true,
  chains: [unemploymentBenefitLocal],
  connectors: [injected()],
  transports: {
    [unemploymentBenefitLocal.id]: http(rpcUrl)
  }
});
