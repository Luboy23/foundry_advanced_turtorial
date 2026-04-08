import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'

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
          manualChunks: {
            phaser: ['phaser'],
            wallet: ['wagmi', '@wagmi/core', 'viem'],
            query: ['@tanstack/react-query'],
          },
        },
      },
    },
    test: {
      environment: 'node',
      globals: true,
      exclude: ['dist/**', 'node_modules/**'],
    },
  }
})
