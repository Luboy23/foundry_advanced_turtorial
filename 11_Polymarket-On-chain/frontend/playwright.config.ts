import { defineConfig, devices } from "@playwright/test";

const e2ePort = process.env.E2E_PORT ?? "3110";
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${e2ePort}`;
const e2eMode = process.env.NEXT_PUBLIC_E2E_MODE ?? "1";
const e2eAccountIndex = process.env.NEXT_PUBLIC_E2E_ACCOUNT_INDEX ?? "0";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: {
    timeout: 20_000
  },
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    headless: true
  },
  webServer: {
    command: `bash -lc "rm -f .next/dev/lock && npm run dev -- --hostname 127.0.0.1 --port ${e2ePort}"`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      NEXT_PUBLIC_E2E_MODE: e2eMode,
      NEXT_PUBLIC_E2E_ACCOUNT_INDEX: e2eAccountIndex
    }
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
