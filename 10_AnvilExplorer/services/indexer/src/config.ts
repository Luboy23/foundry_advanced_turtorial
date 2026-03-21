import path from "node:path";
import { fileURLToPath } from "node:url";

// ESM 环境下计算当前模块目录，用于推导默认 DB 路径。
const dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(dirname, "..", "..", "..");

/**
 * 读取整数环境变量并做范围校验。
 * 校验失败时回退到 `fallback`，保证服务可启动。
 */
const readIntEnv = (
  name: string,
  fallback: number,
  options?: { min?: number; max?: number }
) => {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return fallback;
  if (options?.min !== undefined && parsed < options.min) return fallback;
  if (options?.max !== undefined && parsed > options.max) return fallback;
  return parsed;
};

/**
 * 读取字符串环境变量；空字符串会被当作未配置并回退。
 */
const readStringEnv = (name: string, fallback: string) => {
  const raw = process.env[name];
  if (!raw || !raw.trim()) return fallback;
  return raw.trim();
};

/**
 * Indexer 运行配置：
 * - 由环境变量驱动；
 * - 保证每个字段都有稳定默认值；
 * - 供 API 层与 Sync Loop 共享。
 */
export const indexerConfig = {
  // 服务监听地址。
  host: readStringEnv("INDEXER_HOST", "127.0.0.1"),
  // 服务端口。
  port: readIntEnv("INDEXER_PORT", 8787, { min: 1, max: 65535 }),
  // 链节点 RPC 地址，优先使用 Indexer 专属配置。
  rpcUrl: readStringEnv(
    "INDEXER_RPC_URL",
    readStringEnv("NEXT_PUBLIC_RPC_URL", "http://127.0.0.1:8545")
  ),
  // 链 ID，用于创建 PublicClient 时构造链定义。
  chainId: readIntEnv(
    "INDEXER_CHAIN_ID",
    readIntEnv("NEXT_PUBLIC_CHAIN_ID", 31337, { min: 1 }),
    { min: 1 }
  ),
  // SQLite 文件路径（默认项目根目录下 .data/explorer.db）。
  dbPath: path.resolve(projectRoot, readStringEnv("INDEXER_DB_PATH", ".data/explorer.db")),
  // Sync Loop 轮询周期（毫秒）。
  pollMs: readIntEnv("INDEXER_POLL_MS", 500, { min: 100, max: 60_000 }),
  // 每个区块并行拉取 receipt 的并发上限。
  receiptConcurrency: readIntEnv("INDEXER_RECEIPT_CONCURRENCY", 8, { min: 1, max: 32 }),
  // 冷启动时最多回看多少块。
  bootstrapBlocks: readIntEnv("INDEXER_BOOTSTRAP_BLOCKS", 2000, { min: 1, max: 2_000_000 }),
  // Reorg 回滚深度上限，避免无限回溯。
  maxReorgDepth: readIntEnv("INDEXER_MAX_REORG_DEPTH", 32, { min: 1, max: 256 }),
  // 是否打印 SQL 调试信息（当前仅保留配置位）。
  logSql: readStringEnv("INDEXER_LOG_SQL", "0") === "1",
};

export type IndexerConfig = typeof indexerConfig;
