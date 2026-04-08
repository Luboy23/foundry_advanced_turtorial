import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import './index.css'
import { loadRuntimeConfig } from './lib/runtime-config'

// 全局 QueryClient：承载链上读写与后端接口缓存。
const queryClient = new QueryClient()

const bootstrap = async () => {
  await loadRuntimeConfig()
  const [{ default: App }, { wagmiConfig }] = await Promise.all([
    import('./App'),
    import('./lib/wagmi'),
  ])

  // 应用入口：先注入 wagmi，再注入 react-query，最后渲染 App。
  createRoot(document.getElementById('root')!).render(
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>,
  )
}

void bootstrap()
