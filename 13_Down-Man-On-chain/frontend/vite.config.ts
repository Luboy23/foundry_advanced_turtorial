import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'

/**
 * 前端构建与单元测试统一配置。
 * 关键点：
 * 1) 手动拆分 phaser / web3 chunk，降低首屏包体积抖动。
 * 2) Vitest 仅覆盖 shared 与 systems 核心逻辑层，避免噪音覆盖率。
 */
export default defineConfig(({ mode }) => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      mode === 'analyze'
        ? visualizer({
            filename: 'dist/stats.html',
            gzipSize: true,
            brotliSize: true,
            open: false,
          })
        : null,
    ],
    build: {
      rollupOptions: {
        output: {
          // 手动分包用于稳定教学演示场景下的首屏加载与缓存命中。
          manualChunks: {
            phaser: ['phaser'],
            wallet: ['wagmi', '@wagmi/core', 'viem'],
            query: ['@tanstack/react-query'],
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      // 在每个测试文件执行前注入全局断言扩展。
      setupFiles: './src/test/setup.ts',
      globals: true,
      // e2e 用例由 Playwright 负责，不纳入 Vitest。
      exclude: ['src/test/e2e/**', 'node_modules/**'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        // 覆盖率聚焦核心规则与系统函数，避免 UI 噪声影响判断。
        include: ['src/shared/**/*.ts', 'src/game/systems/**/*.ts'],
      },
    },
  }
})
