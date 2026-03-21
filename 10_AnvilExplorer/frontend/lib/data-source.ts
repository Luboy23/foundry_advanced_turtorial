import { getDataSourceMode, getRpcFallbackEnabled } from "./rpc";

/**
 * 读取当前数据源模式（`auto | indexer | rpc`）。
 */
const mode = () => getDataSourceMode();

/**
 * 是否优先尝试 Indexer 数据源。
 */
export const shouldUseIndexer = () => mode() === "indexer" || mode() === "auto";

/**
 * 是否强制仅使用 RPC 数据源。
 */
export const shouldUseRpc = () => mode() === "rpc";

/**
 * Indexer 失败后是否允许回退 RPC。
 */
export const shouldFallbackRpc = () => {
  if (mode() === "indexer") {
    return getRpcFallbackEnabled();
  }
  if (mode() === "auto") return true;
  return false;
};

/**
 * 尝试从 Indexer 读取：
 * - 读取成功返回结果；
 * - 读取失败时根据策略决定抛错还是返回 `null`（交由 RPC 回退）。
 */
export const tryFromIndexer = async <T>(
  fn: () => Promise<T>,
  label = "indexer request"
) => {
  if (!shouldUseIndexer()) return null;
  try {
    return await fn();
  } catch (error) {
    if (!shouldFallbackRpc()) {
      throw error instanceof Error ? error : new Error(label);
    }
    return null;
  }
};
