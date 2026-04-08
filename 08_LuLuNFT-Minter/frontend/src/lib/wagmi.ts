import { createConfig, http } from "wagmi";
import { injected } from "@wagmi/core";
import { anvil } from "viem/chains";

import { getRuntimeConfig } from "./runtime-config";

const runtime = getRuntimeConfig();

const anvilChain = {
  ...anvil,
  rpcUrls: {
    default: { http: [runtime.rpcUrl] },
    public: { http: [runtime.rpcUrl] },
  },
};

export const wagmiConfig = createConfig({
  chains: [anvilChain],
  connectors: [injected()],
  transports: {
    [anvilChain.id]: http(anvilChain.rpcUrls.default.http[0]),
  },
  ssr: true,
});
