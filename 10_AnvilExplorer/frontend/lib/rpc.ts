import { createPublicClient, defineChain, http } from "viem";

/**
 * 环境变量非法时输出警告并说明回退值。
 */
const warnInvalidEnv = (name: string, raw: unknown, fallback: number | string) => {
  if (process.env.NODE_ENV === "test") return;
  // 保持启动可用性：配置非法时降级到默认值并给出提示。
  console.warn(`[rpc-config] Invalid ${name}=${String(raw)}, fallback to ${fallback}`);
};

/**
 * 读取整数环境变量并做边界校验。
 */
const readIntEnv = (
  name: string,
  fallback: number,
  options?: { min?: number; max?: number }
) => {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    warnInvalidEnv(name, raw, fallback);
    return fallback;
  }
  if (options?.min !== undefined && parsed < options.min) {
    warnInvalidEnv(name, raw, fallback);
    return fallback;
  }
  if (options?.max !== undefined && parsed > options.max) {
    warnInvalidEnv(name, raw, fallback);
    return fallback;
  }
  return parsed;
};

/**
 * 读取字符串环境变量，空值回退默认值。
 */
const readStringEnv = (name: string, fallback: string) => {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  return raw;
};

// 节点 RPC 地址。
const RPC_URL = readStringEnv("NEXT_PUBLIC_RPC_URL", "http://127.0.0.1:8545");
// 目标链 ID。
const CHAIN_ID = readIntEnv("NEXT_PUBLIC_CHAIN_ID", 31337, { min: 1 });
// 首页扫描窗口大小（区块数）。
const SCAN_BLOCKS = readIntEnv("NEXT_PUBLIC_SCAN_BLOCKS", 200, { min: 1, max: 10000 });
// 大窗口读取并发上限。
const SCAN_CONCURRENCY = readIntEnv("NEXT_PUBLIC_SCAN_CONCURRENCY", 8, { min: 1, max: 20 });
// 扫描缓存 TTL（毫秒）。
const SCAN_CACHE_TTL_MS = readIntEnv("NEXT_PUBLIC_SCAN_CACHE_TTL_MS", 2500, { min: 0, max: 60000 });
// 合约创建者“快速扫描”块数上限。
const CREATOR_QUICK_SCAN_BLOCKS = readIntEnv("NEXT_PUBLIC_CREATOR_QUICK_SCAN_BLOCKS", 40, {
  min: 1,
  max: 5000,
});
// 合约创建者查询最大 receipt 扫描数。
const CREATOR_MAX_RECEIPTS = readIntEnv("NEXT_PUBLIC_CREATOR_MAX_RECEIPTS", 3000, {
  min: 50,
  max: 200000,
});
// Cast API 超时时间（毫秒）。
const CAST_API_TIMEOUT_MS = readIntEnv("CAST_API_TIMEOUT_MS", 10000, {
  min: 500,
  max: 60000,
});
// Cast API body 大小上限。
const CAST_API_MAX_BODY_BYTES = readIntEnv("CAST_API_MAX_BODY_BYTES", 16384, {
  min: 1024,
  max: 1024 * 1024,
});
// Cast API 参数个数上限。
const CAST_API_MAX_PARAMS = readIntEnv("CAST_API_MAX_PARAMS", 32, {
  min: 1,
  max: 256,
});
// Indexer 服务地址。
const INDEXER_URL = readStringEnv("NEXT_PUBLIC_INDEXER_URL", "http://127.0.0.1:8787");
// 数据源模式：`auto | indexer | rpc`。
const DATA_SOURCE = readStringEnv("NEXT_PUBLIC_DATA_SOURCE", "auto");
// Indexer 失败后是否允许回退 RPC。
const RPC_FALLBACK = readStringEnv("NEXT_PUBLIC_RPC_FALLBACK", "true") !== "false";

// 前端连接 Anvil 的链定义。
const anvilChain = defineChain({
  id: CHAIN_ID,
  name: "Anvil",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [RPC_URL] },
  },
});

let cachedClient: ReturnType<typeof createPublicClient> | null = null;

/**
 * 获取全局复用的 `PublicClient` 实例，避免重复创建连接。
 */
export function getPublicClient() {
  if (!cachedClient) {
    cachedClient = createPublicClient({
      chain: anvilChain,
      transport: http(RPC_URL),
    });
  }
  return cachedClient;
}

/**
 * 返回 RPC URL。
 */
export function getRpcUrl() {
  return RPC_URL;
}

/**
 * 返回链 ID。
 */
export function getChainId() {
  return CHAIN_ID;
}

/**
 * 返回扫描窗口大小（区块数）。
 */
export function getScanBlocks() {
  return SCAN_BLOCKS;
}

/**
 * 返回扫描并发。
 */
export function getScanConcurrency() {
  return SCAN_CONCURRENCY;
}

/**
 * 返回扫描缓存 TTL（毫秒）。
 */
export function getScanCacheTtlMs() {
  return SCAN_CACHE_TTL_MS;
}

/**
 * 返回快速创建者扫描上限。
 */
export function getCreatorQuickScanBlocks() {
  return CREATOR_QUICK_SCAN_BLOCKS;
}

/**
 * 返回创建者扫描 receipt 上限。
 */
export function getCreatorMaxReceipts() {
  return CREATOR_MAX_RECEIPTS;
}

/**
 * 返回 Cast API 超时配置。
 */
export function getCastApiTimeoutMs() {
  return CAST_API_TIMEOUT_MS;
}

/**
 * 返回 Cast API body 上限。
 */
export function getCastApiMaxBodyBytes() {
  return CAST_API_MAX_BODY_BYTES;
}

/**
 * 返回 Cast API 参数数量上限。
 */
export function getCastApiMaxParams() {
  return CAST_API_MAX_PARAMS;
}

/**
 * 返回 Indexer URL。
 */
export function getIndexerUrl() {
  return INDEXER_URL;
}

/**
 * 返回数据源模式；非法值统一降级到 `auto`。
 */
export function getDataSourceMode() {
  if (DATA_SOURCE === "indexer" || DATA_SOURCE === "rpc" || DATA_SOURCE === "auto") {
    return DATA_SOURCE;
  }
  return "auto";
}

/**
 * 返回是否允许 RPC 回退。
 */
export function getRpcFallbackEnabled() {
  return RPC_FALLBACK;
}
