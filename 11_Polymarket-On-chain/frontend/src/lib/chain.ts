import type { Chain } from "viem";

import { CHAIN_ID, RPC_URL } from "@/lib/config";

/** Wagmi/viem 使用的本地链配置（Anvil/Foundry）。 */
export const foundryLocal: Chain = {
  id: CHAIN_ID,
  name: "Foundry Local",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18
  },
  rpcUrls: {
    default: { http: [RPC_URL] },
    public: { http: [RPC_URL] }
  },
  blockExplorers: {
    default: { name: "Local", url: "http://127.0.0.1" }
  },
  testnet: true
};
