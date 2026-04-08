import { createConfig, http } from 'wagmi'
import { anvil } from 'wagmi/chains'
import { getRpcUrl } from '../../src/lib/contract'

const RPC_URL = getRpcUrl()

export const config = createConfig({
  chains: [anvil],
  transports: {
    [anvil.id]: http(RPC_URL),
  },
  ssr: false,
})
