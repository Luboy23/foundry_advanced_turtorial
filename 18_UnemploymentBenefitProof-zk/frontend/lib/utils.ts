import { clsx, type ClassValue } from "clsx";
import { formatEther, isAddress } from "viem";
import { twMerge } from "tailwind-merge";

/** 合并 Tailwind 与条件 className。 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 把地址格式化成前端展示用的短地址；无效地址统一显示为“未连接”。 */
export function formatAddress(address?: string | null) {
  if (!address || !isAddress(address)) {
    return "未连接";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/** 统一格式化秒级或毫秒级时间戳。 */
export function formatDateTime(timestamp?: number | bigint | null) {
  if (!timestamp) {
    return "暂无";
  }

  const value = typeof timestamp === "bigint" ? Number(timestamp) : timestamp;
  const date = value > 10_000_000_000 ? new Date(value) : new Date(value * 1000);
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

/** 把 wei 格式化成简洁的 ETH 展示文案。 */
export function formatEth(wei?: bigint | string | null) {
  if (wei === undefined || wei === null) {
    return "0 ETH";
  }

  const value = typeof wei === "string" ? BigInt(wei) : wei;
  const eth = Number(formatEther(value));
  return `${eth.toFixed(3).replace(/\.?0+$/, "")} ETH`;
}

/** 生成失败记录的临时本地 ID。 */
export function createFailureId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
