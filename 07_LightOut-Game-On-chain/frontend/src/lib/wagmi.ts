import { createConfig, http } from "wagmi";
import { injected } from "@wagmi/core";
import { anvil } from "viem/chains";
import { getRuntimeConfig } from "@/lib/runtime-config";

const runtime = getRuntimeConfig();
const chainId = Number.isInteger(runtime.chainId) ? runtime.chainId : anvil.id;
const rpcUrl = runtime.rpcUrl;

// 允许通过 env 覆盖本地教学链参数，避免硬编码散落在页面内
const localChain = {
  ...anvil,
  id: chainId,
  name: chainId === anvil.id ? "Anvil" : `Local Chain ${chainId}`,
  rpcUrls: {
    default: { http: [rpcUrl] },
    public: { http: [rpcUrl] },
  },
};

export const wagmiConfig = createConfig({
  chains: [localChain],
  connectors: [injected()],
  transports: {
    [localChain.id]: http(localChain.rpcUrls.default.http[0]),
  },
  ssr: true,
});
