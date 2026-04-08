import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright e2e 配置。
 * BraveMan 依赖前后端与链上联动，故统一通过 webServer 拉起前端。
 */
export default defineConfig({
  // e2e 用例统一放在 src/test/e2e，避免和单元测试目录混淆。
  testDir: './src/test/e2e',
  timeout: 120_000,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    // 首次失败保留 trace，便于定位钱包注入与网络请求问题。
    trace: 'on-first-retry',
  },
  webServer: {
    command:
      'VITE_E2E_BYPASS_WALLET=true VITE_E2E_TEST_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    // 本地调试允许复用现有服务，CI 侧建议冷启动隔离。
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
