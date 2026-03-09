import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { anvil } from "viem/chains";

const envChainIdRaw = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? anvil.id);
const chainId = Number.isInteger(envChainIdRaw) ? envChainIdRaw : anvil.id;
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545";

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
