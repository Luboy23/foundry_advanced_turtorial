/**
 * 模块职责：应用启动入口，注入 wagmi 与 react-query 全局 Provider。
 * 说明：本文件注释以“业务意图 + 关键约束”为主，便于后续维护与教学阅读。
 */

import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import './index.css'
import App from './App.tsx'
import { wagmiConfig } from './lib/wagmi'

// 全局查询客户端：缓存链上读取结果并控制失效策略。
const queryClient = new QueryClient()

// Provider 顺序：
// 1) WagmiProvider 提供钱包连接与链交互上下文
// 2) QueryClientProvider 提供请求缓存与状态管理
createRoot(document.getElementById('root')!).render(
  <WagmiProvider config={wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </WagmiProvider>,
)
