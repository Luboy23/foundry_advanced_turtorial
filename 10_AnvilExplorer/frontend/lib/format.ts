import { formatEther, formatUnits } from "viem";

/**
 * bigint 千分位格式化，保留负号。
 */
const formatBigIntWithGrouping = (value: bigint) => {
  const negative = value < 0n;
  const digits = (negative ? -value : value).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return negative ? `-${grouped}` : grouped;
};

/**
 * 缩短哈希展示：保留前后固定长度，中间用省略号。
 */
export function shortenHash(hash: string, left = 6, right = 4) {
  if (!hash) return "";
  if (hash.length <= left + right + 2) return hash;
  return `${hash.slice(0, left + 2)}…${hash.slice(-right)}`;
}

/**
 * wei -> ETH 文本。
 */
export function formatEth(value: bigint | null | undefined) {
  if (value === null || value === undefined) return "-";
  try {
    return `${formatEther(value)} ETH`;
  } catch {
    return "-";
  }
}

/**
 * 通用数值展示：
 * - bigint 用手写千分位；
 * - number 用 `zh-CN` 本地化格式化。
 */
export function formatNumber(value: bigint | number | null | undefined) {
  if (value === null || value === undefined) return "-";
  if (typeof value === "bigint") {
    return formatBigIntWithGrouping(value);
  }
  if (!Number.isFinite(value)) return "-";
  return value.toLocaleString("zh-CN");
}

/**
 * 秒级时间戳 -> 本地日期时间字符串。
 */
export function formatTimestamp(value: bigint | number | null | undefined) {
  if (value === null || value === undefined) return "-";
  const seconds = typeof value === "bigint" ? Number(value) : value;
  if (!Number.isFinite(seconds)) return "-";
  const date = new Date(seconds * 1000);
  return date.toLocaleString("zh-CN", { hour12: false });
}

/**
 * wei -> Gwei 文本。
 */
export function formatGwei(value: bigint | null | undefined) {
  if (value === null || value === undefined) return "-";
  try {
    return `${formatUnits(value, 9)} Gwei`;
  } catch {
    return "-";
  }
}
