import { createConfig, http } from "wagmi";
import { injected } from "@wagmi/core";
import { defineChain } from "viem";

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545";

export const foundryLocal = defineChain({
  id: 31337,
  name: "Foundry Local",
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

export const wagmiConfig = createConfig({
  ssr: true,
  chains: [foundryLocal],
  connectors: [injected()],
  transports: {
    [foundryLocal.id]: http(rpcUrl)
  }
});
