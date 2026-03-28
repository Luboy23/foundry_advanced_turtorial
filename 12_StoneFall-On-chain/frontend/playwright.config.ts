import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright e2e 配置。
 * 通过 globalSetup 先重启本地链并部署合约，保证链上依赖可复现。
 */
export default defineConfig({
  // e2e 用例统一放在 src/test/e2e，避免和单元测试目录混淆。
  testDir: './src/test/e2e',
  timeout: 120_000,
  retries: 0,
  // 全局前置：准备 Anvil 与合约地址，确保每轮测试环境干净。
  globalSetup: './src/test/e2e/global-setup.js',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    // 首次失败保留 trace，便于定位钱包注入与链交互问题。
    trace: 'on-first-retry',
  },
  webServer: {
    command:
      'VITE_E2E_BYPASS_WALLET=true VITE_E2E_TEST_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    // 本地调试时可复用已启动服务，CI 默认重启保证隔离性。
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
