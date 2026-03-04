import type { AppProps } from 'next/app'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { anvil } from 'wagmi/chains'

import '../styles/globals.css'
// Import initial FontAwesome Styles: https://github.com/FortAwesome/react-fontawesome/issues/134#issuecomment-476276516
import '@fortawesome/fontawesome-svg-core/styles.css'

// Import FontAwesome Icons
import { config, library } from '@fortawesome/fontawesome-svg-core'
import {
  faStar,
  faArrowUp,
  faArrowRight,
  faArrowDown,
  faArrowLeft,
  faTrophy,
} from '@fortawesome/free-solid-svg-icons'
import { faGithub } from '@fortawesome/free-brands-svg-icons'

// React Query 全局实例：缓存链上读取与异步请求结果
const queryClient = new QueryClient()
// 优先读取环境变量 RPC；本地开发默认连到 8545
const anvilRpcUrl =
  process.env.NEXT_PUBLIC_ANVIL_RPC_URL ?? 'http://127.0.0.1:8545'
// wagmi 全局配置：限定 Anvil 链 + injected 钱包连接器
const wagmiConfig = createConfig({
  chains: [anvil],
  connectors: [injected()],
  transports: {
    [anvil.id]: http(anvilRpcUrl),
  },
})

// 预注册页面会用到的图标，避免运行时按需导入抖动
library.add(
  faStar,
  faArrowUp,
  faArrowRight,
  faArrowDown,
  faArrowLeft,
  faTrophy,
  faGithub
)
// 关闭 FontAwesome 自动注入 CSS，避免与 Next 全局样式重复
config.autoAddCss = false

// Next.js 自定义 App：注入 wagmi 与 React Query
export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <Component {...pageProps} />
      </QueryClientProvider>
    </WagmiProvider>
  )
}
