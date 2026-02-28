// 应用入口：挂载 React 根节点，注入全局 Provider，并渲染 App。
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// 全局样式（包含页面基础样式与容器布局）
import './index.css'
// 主应用组件（页面结构与游戏入口）
import App from './App.jsx'
// Provider 统一注入 wagmi 与 React Query
import Provider from './providers.jsx'

// 将 React 应用挂载到 index.html 的 #root 容器
createRoot(document.getElementById('root')).render(
  // StrictMode 用于帮助在开发环境发现潜在问题
  <StrictMode>
    {/* Provider 为后续组件提供 Web3 与数据缓存能力 */}
    <Provider>
      {/* 主应用渲染入口 */}
      <App />
    </Provider>
  </StrictMode>,
)
