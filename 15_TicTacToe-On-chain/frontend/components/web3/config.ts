import { fallback, http, webSocket } from "wagmi";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { injectedWallet } from "@rainbow-me/rainbowkit/wallets";
import { PROJECT_NAME_EN } from "@/lib/projectBrand";
import {
  RuntimeContractConfig,
  buildRuntimeChain,
  getResolvedRuntimeConfig,
  loadRuntimeContractConfig,
} from "@/constants";

// WalletConnect 项目 ID：本地开发可使用占位值，生产环境应替换为真实 ID。
const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "YOUR_PROJECT_ID";

let appConfigCache: ReturnType<typeof createAppConfig> | null = null;

// 根据 HTTP RPC 自动推导 WS 地址，用于事件订阅优先通道。
const deriveWsUrl = (rpcUrl: string): string | undefined => {
  try {
    const url = new URL(rpcUrl);
    if (url.protocol === "http:") {
      url.protocol = "ws:";
      return url.toString();
    }
    if (url.protocol === "https:") {
      url.protocol = "wss:";
      return url.toString();
    }
    return undefined;
  } catch {
    return undefined;
  }
};

// 基于锁定后的 runtime config 构造 wagmi + RainbowKit 配置。
export const createAppConfig = (runtimeConfig: RuntimeContractConfig) => {
  const chain = buildRuntimeChain(runtimeConfig);
  const wsUrl = deriveWsUrl(runtimeConfig.rpcUrl);

  return getDefaultConfig({
    appName: PROJECT_NAME_EN,
    projectId: walletConnectProjectId,
    chains: [chain] as [typeof chain],
    pollingInterval: 1_000,
    wallets: [
      {
        groupName: "Recommended",
        wallets: [injectedWallet],
      },
    ],
    transports: {
      [chain.id]: wsUrl
        ? fallback([webSocket(wsUrl), http(runtimeConfig.rpcUrl)])
        : http(runtimeConfig.rpcUrl),
    },
  });
};

// 启动阶段初始化全局 wagmi 配置，并在后续调用中复用。
export const initializeAppConfig = async () => {
  if (appConfigCache) {
    return appConfigCache;
  }

  const runtimeConfig = await loadRuntimeContractConfig();
  appConfigCache = createAppConfig(runtimeConfig);
  return appConfigCache;
};

// 读取当前全局 wagmi 配置；若尚未初始化则按当前解析结果惰性构造。
export const getAppConfig = () => {
  if (appConfigCache) {
    return appConfigCache;
  }

  appConfigCache = createAppConfig(getResolvedRuntimeConfig());
  return appConfigCache;
};

// 测试辅助：重置缓存的 wagmi 配置。
export const resetAppConfigForTests = () => {
  appConfigCache = null;
};
