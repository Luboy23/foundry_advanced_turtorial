import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { anvil } from "viem/chains";

import { RPC_URL } from "./contracts";

const anvilChain = {
  ...anvil,
  rpcUrls: {
    default: { http: [RPC_URL] },
    public: { http: [RPC_URL] }
  }
};

export const wagmiConfig = createConfig({
  chains: [anvilChain],
  connectors: [injected()],
  transports: {
    [anvilChain.id]: http(anvilChain.rpcUrls.default.http[0])
  },
  ssr: true
});
