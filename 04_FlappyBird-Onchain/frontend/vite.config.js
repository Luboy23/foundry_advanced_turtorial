// Vite 配置：启用 React 插件。
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // React Fast Refresh & JSX 支持
  plugins: [react()],
})
