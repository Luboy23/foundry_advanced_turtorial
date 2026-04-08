import { createConfig, http } from "wagmi";
import { injected } from "@wagmi/core";
import { anvil } from "wagmi/chains";
import { getRuntimeConfig } from "@/lib/runtime-config";

const runtime = getRuntimeConfig();

export const wagmiConfig = createConfig({
  ssr: true,
  chains: [anvil],
  connectors: [injected()],
  transports: {
    [anvil.id]: http(runtime.rpcUrl),
  },
});
