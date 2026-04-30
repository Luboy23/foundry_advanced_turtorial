import { defineConfig } from "@playwright/test";

const WEB_PORT = Number(process.env.WEB_PORT ?? 3119);
const ANVIL_PORT = Number(process.env.ANVIL_PORT ?? 8645);
const INDEXER_PORT = Number(process.env.INDEXER_PORT ?? 42169);
const BASE_URL = process.env.BASE_URL ?? `http://127.0.0.1:${WEB_PORT}`;
const useExistingServer = process.env.PLAYWRIGHT_USE_EXISTING_SERVER === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  timeout: 90_000,
  expect: {
    timeout: 20_000
  },
  use: {
    baseURL: BASE_URL,
    headless: true,
    trace: "retain-on-failure"
  },
  webServer: useExistingServer
    ? undefined
    : {
        command: `ANVIL_PORT=${ANVIL_PORT} WEB_PORT=${WEB_PORT} INDEXER_PORT=${INDEXER_PORT} NEXT_DIST_DIR=.next-e2e bash scripts/run-e2e-stack.sh`,
        cwd: "..",
        url: BASE_URL,
        timeout: 180_000,
        reuseExistingServer: true
      }
});
