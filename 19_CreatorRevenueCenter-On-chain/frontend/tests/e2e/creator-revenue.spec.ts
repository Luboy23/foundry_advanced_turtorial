import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { createPublicClient, createWalletClient, defineChain, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3119";
const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8645";
const EXPECTED_CHAIN_ID = 31337;
const WRONG_CHAIN_ID = 1;
const PLATFORM_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const batchRegistryAbi = parseAbi([
  "function pauseBatch(bytes32 batchId)",
  "function resumeBatch(bytes32 batchId)"
]);
const anvilChain = defineChain({
  id: EXPECTED_CHAIN_ID,
  name: "Anvil",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: [RPC_URL]
    }
  }
});

type RuntimeConfig = {
  batchRegistryAddress: `0x${string}`;
  distributorAddress: `0x${string}`;
  chainId: number;
  demoAddresses: {
    platform: `0x${string}`;
    creator: `0x${string}`;
    collaboratorA: `0x${string}`;
  };
  activeBatchId: `0x${string}`;
};

type PlatformMonthlyConfigsResponse = {
  configs: Array<{
    monthLabel: string;
    isLocked: boolean;
  }>;
  activeMonth: string | null;
  minAllowedMonth: string;
};

function getNextMonthLabel(monthLabel: string) {
  const [rawYear, rawMonth] = monthLabel.split("-");
  const year = Number(rawYear);
  const month = Number(rawMonth);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return monthLabel;
  }

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

type MockWalletInit = {
  account: `0x${string}`;
  chainId: number;
};

async function requestMockWalletConnection(page: Page) {
  await page.evaluate(async () => {
    const provider = (window as Window & { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } })
      .ethereum;

    if (!provider) {
      throw new Error("Missing mock wallet provider");
    }

    await provider.request({ method: "eth_requestAccounts" });
  });
}

async function setMockWalletChain(page: Page, chainId: number) {
  const chainIdHex = `0x${chainId.toString(16)}`;

  await page.evaluate(async (nextChainIdHex) => {
    const provider = (window as Window & { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } })
      .ethereum;

    if (!provider) {
      throw new Error("Missing mock wallet provider");
    }

    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: nextChainIdHex }]
    });
  }, chainIdHex);
}

async function createMockWalletContext(browser: Browser, account: `0x${string}`, chainId: number): Promise<BrowserContext> {
  const context = await browser.newContext();

  await context.exposeBinding(
    "__mockRpcRequest",
    async (_source, request: { method: string; params?: unknown[] }) => {
      const response = await fetch(RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: request.method,
          params: request.params ?? []
        })
      });
      const payload = (await response.json()) as {
        result?: unknown;
        error?: { message?: string };
      };

      if (payload.error?.message) {
        throw new Error(payload.error.message);
      }

      return payload.result ?? null;
    }
  );

  await context.addInitScript(
    ({ account, chainId }: MockWalletInit) => {
      type RpcBridge = (request: { method: string; params?: unknown[] }) => Promise<unknown>;

      class MockEthereumProvider {
        account: string;
        chainId: number;
        connected: boolean;
        isMetaMask: boolean;
        listeners: Record<string, Array<(...args: unknown[]) => void>>;

        constructor(nextAccount: string, nextChainId: number) {
          this.account = nextAccount;
          this.chainId = nextChainId;
          this.connected = false;
          this.isMetaMask = true;
          this.listeners = {};
        }

        on(event: string, listener: (...args: unknown[]) => void) {
          this.listeners[event] ??= [];
          this.listeners[event].push(listener);
        }

        removeListener(event: string, listener: (...args: unknown[]) => void) {
          this.listeners[event] = (this.listeners[event] ?? []).filter((entry) => entry !== listener);
        }

        emit(event: string, payload: unknown) {
          for (const listener of this.listeners[event] ?? []) {
            listener(payload);
          }
        }

        async request({ method, params }: { method: string; params?: Array<Record<string, unknown>> }) {
          const rpcRequest = (window as Window & { __mockRpcRequest?: RpcBridge }).__mockRpcRequest;

          if (method === "eth_requestAccounts") {
            this.connected = true;
            const accounts = [this.account];
            this.emit("accountsChanged", accounts);
            return accounts;
          }

          if (method === "eth_accounts") {
            return this.connected ? [this.account] : [];
          }

          if (method === "eth_chainId") {
            return `0x${this.chainId.toString(16)}`;
          }

          if (method === "wallet_switchEthereumChain") {
            const nextValue = params?.[0]?.chainId;
            if (typeof nextValue !== "string") {
              throw new Error("Missing chain id");
            }

            this.chainId = Number.parseInt(nextValue, 16);
            this.emit("chainChanged", nextValue);
            return null;
          }

          if (method === "wallet_addEthereumChain") {
            return null;
          }

          if (!rpcRequest) {
            throw new Error("Missing RPC bridge");
          }

          if (method === "eth_sendTransaction") {
            const tx = (params?.[0] ?? {}) as Record<string, unknown>;
            return rpcRequest({
              method,
              params: [
                {
                  ...tx,
                  from: this.account
                }
              ]
            });
          }

          return rpcRequest({
            method,
            params
          });
        }
      }

      Object.defineProperty(window, "ethereum", {
        configurable: true,
        value: new MockEthereumProvider(account, chainId)
      });
    },
    { account, chainId }
  );

  return context;
}

async function loadRuntimeConfig() {
  return (await fetch(`${BASE_URL}/contract-config.json`).then((response) => response.json())) as RuntimeConfig;
}

async function connectWalletIntoWorkspace(page: Page, workspaceHeading: RegExp | string) {
  await page.waitForLoadState("networkidle");

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await page.getByRole("heading", { name: workspaceHeading }).isVisible().catch(() => false)) {
      return;
    }

    const connectButtons = page.getByRole("button", { name: "连接钱包" });
    const buttonCount = await connectButtons.count();
    for (let index = 0; index < buttonCount; index += 1) {
      const connectButton = connectButtons.nth(index);
      if (await connectButton.isVisible().catch(() => false)) {
        await connectButton.click();
        await page.waitForTimeout(500);
      }
    }

    await requestMockWalletConnection(page);
    await page.waitForTimeout(500);
  }

  await expect(page.getByRole("heading", { name: workspaceHeading })).toBeVisible();
}

async function connectWalletIntoCreatorPage(page: Page) {
  await page.waitForLoadState("networkidle");

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await page.getByRole("heading", { name: "创作者工作台" }).isVisible().catch(() => false)) {
      return;
    }

    const connectButtons = page.getByRole("button", { name: "连接钱包" });
    const buttonCount = await connectButtons.count();
    for (let index = 0; index < buttonCount; index += 1) {
      const connectButton = connectButtons.nth(index);
      if (await connectButton.isVisible().catch(() => false)) {
        await connectButton.click();
        await page.waitForTimeout(500);
      }
    }

    await requestMockWalletConnection(page);
    await page.waitForTimeout(500);
  }

  await expect(page.getByRole("heading", { name: "创作者工作台" })).toBeVisible();
}

async function waitForReceipt(hash: `0x${string}`) {
  const publicClient = createPublicClient({ chain: anvilChain, transport: http(RPC_URL) });
  await publicClient.waitForTransactionReceipt({ hash });
}

test.describe.serial("Creator revenue center", () => {
  test("shows platform activation UI and seeded historical amounts", async ({ browser }) => {
    const runtimeConfig = await loadRuntimeConfig();
    const creatorContext = await createMockWalletContext(browser, runtimeConfig.demoAddresses.creator, EXPECTED_CHAIN_ID);
    const creatorPage = await creatorContext.newPage();

    const monthlyConfigs = (await fetch(`${BASE_URL}/api/platform/monthly-configs`).then((response) => response.json())) as PlatformMonthlyConfigsResponse;
    const previewMonth = monthlyConfigs.configs.some(
      (entry) => entry.monthLabel === monthlyConfigs.minAllowedMonth && entry.isLocked
    )
      ? getNextMonthLabel(monthlyConfigs.minAllowedMonth)
      : monthlyConfigs.minAllowedMonth;
    const activationPreview = await fetch(`${BASE_URL}/api/platform/monthly-configs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        monthLabel: previewMonth,
        grossAmountEth: "88"
      })
    }).then((response) => response.json());

    expect(activationPreview.monthLabel).toBe(previewMonth);
    expect(activationPreview.grossAmountWei).toBe("88000000000000000000");
    expect(activationPreview.batchIdHex).toMatch(/^0x[a-f0-9]{64}$/);

    await creatorPage.goto("/creator");
    await connectWalletIntoCreatorPage(creatorPage);
    await expect(creatorPage.getByText("50.00 ETH", { exact: true })).toBeVisible();
    await expect(creatorPage.getByText("100.00 ETH", { exact: true })).toBeVisible();
    await expect(creatorPage.getByText("200.00 ETH", { exact: true })).toBeVisible();

    await creatorContext.close();
  });

  test("shows wrong-network guidance and allows switching back", async ({ browser }) => {
    const runtimeConfig = await loadRuntimeConfig();
    const context = await createMockWalletContext(browser, runtimeConfig.demoAddresses.creator, EXPECTED_CHAIN_ID);
    const page = await context.newPage();

    await page.goto("/creator/claim");
    await expect(page).toHaveURL(/\/creator$/);
    await connectWalletIntoCreatorPage(page);
    await setMockWalletChain(page, WRONG_CHAIN_ID);

    await expect(page.getByText("当前网络与项目配置不一致")).toBeVisible();
    await expect(page.getByText("请切换到项目网络 `chainId = 31337` 后再执行链上动作。")).toBeVisible();

    await page.getByRole("button", { name: "切换网络" }).first().click();
    await expect(page.getByText("当前网络与项目配置不一致")).toHaveCount(0);

    await context.close();
  });

  test("syncs batch publish and claim results into creator and collaborator workspaces", async ({ browser }) => {
    const runtimeConfig = await loadRuntimeConfig();
    const creatorContext = await createMockWalletContext(browser, runtimeConfig.demoAddresses.creator, EXPECTED_CHAIN_ID);
    const collaboratorContext = await createMockWalletContext(browser, runtimeConfig.demoAddresses.collaboratorA, EXPECTED_CHAIN_ID);
    const creatorPage = await creatorContext.newPage();
    const collaboratorPage = await collaboratorContext.newPage();
    const publicClient = createPublicClient({ chain: anvilChain, transport: http(RPC_URL) });
    const platformWallet = createWalletClient({
      account: privateKeyToAccount(PLATFORM_PRIVATE_KEY),
      chain: anvilChain,
      transport: http(RPC_URL)
    });
    await creatorPage.goto("/creator");
    await connectWalletIntoCreatorPage(creatorPage);
    await collaboratorPage.goto("/collaborator");
    await connectWalletIntoWorkspace(collaboratorPage, /协作者|编导|摄影/);

    const pauseHash = await platformWallet.writeContract({
      address: runtimeConfig.batchRegistryAddress,
      abi: batchRegistryAbi,
      functionName: "pauseBatch",
      args: [runtimeConfig.activeBatchId]
    });
    await publicClient.waitForTransactionReceipt({ hash: pauseHash });
    await creatorPage.goto("/creator");
    await connectWalletIntoCreatorPage(creatorPage);
    await expect(creatorPage.getByText("批次已暂停。")).toBeVisible({ timeout: 20_000 });

    const resumeHash = await platformWallet.writeContract({
      address: runtimeConfig.batchRegistryAddress,
      abi: batchRegistryAbi,
      functionName: "resumeBatch",
      args: [runtimeConfig.activeBatchId]
    });
    await waitForReceipt(resumeHash);
    await creatorPage.goto("/creator");
    await connectWalletIntoCreatorPage(creatorPage);
    await expect(creatorPage.getByRole("button", { name: "确认领取收益" })).toBeEnabled({ timeout: 20_000 });

    await creatorPage.getByRole("button", { name: "确认领取收益" }).click();
    await creatorPage.getByRole("button", { name: "确认领取", exact: true }).click();
    await expect(creatorPage.locator("h2", { hasText: "领取成功" })).toBeVisible({ timeout: 30_000 });
    await creatorPage.getByRole("button", { name: "知道了" }).click();

    await creatorPage.goto("/creator");
    await connectWalletIntoCreatorPage(creatorPage);
    await collaboratorPage.goto("/collaborator");
    await connectWalletIntoWorkspace(collaboratorPage, /协作者|编导|摄影/);
    await expect(creatorPage.getByRole("heading", { name: "本月收益已领取" })).toBeVisible({ timeout: 20_000 });
    await expect(collaboratorPage.getByText("暂无到账记录")).toHaveCount(0, { timeout: 20_000 });

    await creatorContext.close();
    await collaboratorContext.close();
  });
});
