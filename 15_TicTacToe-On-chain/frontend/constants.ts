import { Abi, Address, Chain, toFunctionSelector } from "viem";
import TicTacToeAbiJson from "@/abi/TicTacToe.json";
import SessionAccountAbiJson from "@/abi/SessionAccount.json";
import SessionAccountFactoryAbiJson from "@/abi/SessionAccountFactory.json";

// 常量默认值：在 runtime/env 都缺失时仍能保证前端可启动。
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;
const DEFAULT_RPC_URL = "http://127.0.0.1:8545";
const DEFAULT_CHAIN_ID = 31337;
const WINDOW_CONFIG_KEY = "__TICTACTOE_RUNTIME_CONFIG__";
const DEFAULT_CHAIN_NAME = "Local Anvil";
const DEFAULT_NATIVE_CURRENCY = {
  name: "Ether",
  symbol: "ETH",
  decimals: 18,
} as const;

// 前端运行时合约配置，支持构建时 env 与运行时文件两级来源。
export type RuntimeContractConfig = {
  tictactoeAddress: Address;
  sessionFactoryAddress: Address;
  rpcUrl: string;
  chainId: number;
};

type RuntimeContractConfigSource = {
  tictactoeAddress?: unknown;
  sessionFactoryAddress?: unknown;
  rpcUrl?: unknown;
  chainId?: unknown;
};

let runtimeConfigCache: RuntimeContractConfig | null = null;
let runtimeConfigLoadPromise: Promise<RuntimeContractConfig> | null = null;

// 地址守卫：用于把未知输入收敛为 Address 类型。
const isAddress = (value: unknown): value is Address =>
  typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);

// 地址归一化：非法地址统一回退到给定默认值。
const asAddress = (value: unknown, fallback: Address): Address =>
  isAddress(value) ? value : fallback;

// chainId 归一化：只接受正整数。
const asChainId = (value: unknown, fallback: number): number => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : fallback;
};

// RPC URL 归一化：空字符串或非法输入都退回默认值。
const asRpcUrl = (value: unknown, fallback: string): string =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;

// 统一归一化运行时配置对象，避免不同来源的字段格式漂移。
const normalizeRuntimeConfig = (
  runtimeConfig?: RuntimeContractConfigSource
): RuntimeContractConfig => ({
  tictactoeAddress: asAddress(runtimeConfig?.tictactoeAddress, ZERO_ADDRESS),
  sessionFactoryAddress: asAddress(runtimeConfig?.sessionFactoryAddress, ZERO_ADDRESS),
  rpcUrl: asRpcUrl(runtimeConfig?.rpcUrl, DEFAULT_RPC_URL),
  chainId: asChainId(runtimeConfig?.chainId, DEFAULT_CHAIN_ID),
});

// 从 window 注入对象读取运行时配置（浏览器端优先级最高）。
const getWindowRuntimeConfig = (): RuntimeContractConfigSource => {
  if (typeof window === "undefined") return {};
  const runtime = (window as unknown as Record<string, unknown>)[WINDOW_CONFIG_KEY];
  if (!runtime || typeof runtime !== "object") return {};
  const obj = runtime as Record<string, unknown>;
  return normalizeRuntimeConfig({
    tictactoeAddress: obj.tictactoeAddress,
    sessionFactoryAddress: obj.sessionFactoryAddress,
    rpcUrl: obj.rpcUrl,
    chainId: obj.chainId,
  });
};

// 统一读取 env 配置，作为客户端 runtime 文件加载失败时的兜底值。
const getEnvRuntimeConfig = (): RuntimeContractConfig =>
  normalizeRuntimeConfig({
    tictactoeAddress: process.env.NEXT_PUBLIC_TICTACTOE_ADDRESS,
    sessionFactoryAddress: process.env.NEXT_PUBLIC_SESSION_FACTORY_ADDRESS,
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL,
    chainId: process.env.NEXT_PUBLIC_CHAIN_ID,
  });

// 基于当前可见输入解析一份配置快照：window > env > 默认值。
const resolveRuntimeConfigSnapshot = (): RuntimeContractConfig => {
  const envConfig = getEnvRuntimeConfig();
  const windowConfig = getWindowRuntimeConfig();

  return normalizeRuntimeConfig({
    tictactoeAddress: windowConfig.tictactoeAddress ?? envConfig.tictactoeAddress,
    sessionFactoryAddress:
      windowConfig.sessionFactoryAddress ?? envConfig.sessionFactoryAddress,
    rpcUrl: windowConfig.rpcUrl ?? envConfig.rpcUrl,
    chainId: windowConfig.chainId ?? envConfig.chainId,
  });
};

// 写入已锁定的 runtime 配置，并同步回 window，保证后续读取一致。
const cacheRuntimeConfig = (runtimeConfig: RuntimeContractConfig): RuntimeContractConfig => {
  runtimeConfigCache = normalizeRuntimeConfig(runtimeConfig);
  if (typeof window !== "undefined") {
    (window as unknown as Record<string, unknown>)[WINDOW_CONFIG_KEY] = runtimeConfigCache;
  }
  return runtimeConfigCache;
};

// 读取已缓存的 runtime 配置；若尚未初始化则返回 undefined。
export const getCachedRuntimeContractConfig = (): RuntimeContractConfig | undefined =>
  runtimeConfigCache ?? undefined;

// 统一解析最终运行配置：优先已锁定配置，否则读取当前快照。
export const getResolvedRuntimeConfig = (): RuntimeContractConfig =>
  runtimeConfigCache ?? resolveRuntimeConfigSnapshot();

// 主动加载 public/contract-config.json，并把结果锁定为本次页面生命周期配置。
export const loadRuntimeContractConfig = async (): Promise<RuntimeContractConfig> => {
  if (runtimeConfigCache) {
    return runtimeConfigCache;
  }
  if (runtimeConfigLoadPromise) {
    return runtimeConfigLoadPromise;
  }
  if (typeof window === "undefined") {
    return cacheRuntimeConfig(resolveRuntimeConfigSnapshot());
  }

  runtimeConfigLoadPromise = (async () => {
    try {
      const response = await fetch("/contract-config.json", { cache: "no-store" });
      if (response.ok) {
        const data = (await response.json()) as Partial<RuntimeContractConfig>;
        return cacheRuntimeConfig(normalizeRuntimeConfig(data));
      }
    } catch {
      // 忽略运行时配置拉取失败，后续会自动回退到 env/default 配置。
    }

    return cacheRuntimeConfig(resolveRuntimeConfigSnapshot());
  })();

  try {
    return await runtimeConfigLoadPromise;
  } finally {
    runtimeConfigLoadPromise = null;
  }
};

// 构造统一链描述，供 wagmi 与 viem client 共享同一份链配置。
export const buildRuntimeChain = (runtimeConfig: RuntimeContractConfig): Chain => {
  const wsUrl = (() => {
    try {
      const url = new URL(runtimeConfig.rpcUrl);
      if (url.protocol === "http:") {
        url.protocol = "ws:";
        return url.toString();
      }
      if (url.protocol === "https:") {
        url.protocol = "wss:";
        return url.toString();
      }
    } catch {
      return undefined;
    }
    return undefined;
  })();

  const rpcUrlEntry = wsUrl
    ? {
        http: [runtimeConfig.rpcUrl],
        webSocket: [wsUrl],
      }
    : {
        http: [runtimeConfig.rpcUrl],
      };

  return {
    id: runtimeConfig.chainId,
    name: DEFAULT_CHAIN_NAME,
    nativeCurrency: DEFAULT_NATIVE_CURRENCY,
    rpcUrls: {
      default: rpcUrlEntry,
      public: rpcUrlEntry,
    },
    testnet: true,
  };
};

// 获取当前锁定配置对应的统一链描述。
export const getRuntimeChain = (): Chain => buildRuntimeChain(getResolvedRuntimeConfig());

// 测试辅助：重置 runtime config 缓存，便于覆盖不同启动场景。
export const resetRuntimeContractConfigForTests = () => {
  runtimeConfigCache = null;
  runtimeConfigLoadPromise = null;
  if (typeof window !== "undefined") {
    delete (window as unknown as Record<string, unknown>)[WINDOW_CONFIG_KEY];
  }
};

// 合约 ABI 导出：统一通过 constants 作为单一引用入口。
export const CONTRACT_ABI = TicTacToeAbiJson as Abi;
export const SESSION_ACCOUNT_ABI = SessionAccountAbiJson as Abi;
export const SESSION_FACTORY_ABI = SessionAccountFactoryAbiJson as Abi;

// 会话参数：控制一次授权的有效时长、调用上限与预充值金额。
export const SESSION_DURATION_SECONDS = 30 * 60;
export const SESSION_MAX_CALLS = 12;
export const SESSION_PREFUND_WEI = BigInt("10000000000000000"); // 会话预充值 0.01 ETH

// 会话白名单方法选择器：仅允许这些函数被会话账户执行。
export const SESSION_ALLOWED_SELECTORS = [
  toFunctionSelector("makeMove(uint256,uint8)"),
  toFunctionSelector("resign(uint256)"),
  toFunctionSelector("claimTimeoutWin(uint256)"),
  toFunctionSelector("cancelGame(uint256)"),
] as const;

// 对局合约配置对象：address 使用 getter，保证运行时更新后可即时生效。
export const ContractConfig = {
  get address() {
    return getResolvedRuntimeConfig().tictactoeAddress;
  },
  abi: CONTRACT_ABI,
};
