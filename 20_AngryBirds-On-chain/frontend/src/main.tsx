import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import './index.css'
import { loadRuntimeConfig } from './lib/runtime-config'

const queryClient = new QueryClient()

const bootstrap = async () => {
  await loadRuntimeConfig()
  const [{ default: App }, { wagmiConfig }] = await Promise.all([import('./App'), import('./lib/wagmi')])

  createRoot(document.getElementById('root')!).render(
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>,
  )
}

void bootstrap()
