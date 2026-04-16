import { createConfig, http } from "wagmi";
import { injected } from "@wagmi/core";
import { defineChain } from "viem";

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545";
const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "31337");

export const alcoholAgeGateLocal = defineChain({
  id: chainId,
  name: "AlcoholAgeGate Local",
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
  chains: [alcoholAgeGateLocal],
  connectors: [injected()],
  transports: {
    [alcoholAgeGateLocal.id]: http(rpcUrl)
  }
});
