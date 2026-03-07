import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { anvil } from "wagmi/chains";
import { RPC_URL } from "@/lib/chain";

export const wagmiConfig = createConfig({
  ssr: true,
  chains: [anvil],
  connectors: [injected()],
  transports: {
    [anvil.id]: http(RPC_URL),
  },
});
