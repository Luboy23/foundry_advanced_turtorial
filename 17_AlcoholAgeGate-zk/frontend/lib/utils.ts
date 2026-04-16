import { clsx, type ClassValue } from "clsx";
import { formatEther, isAddress } from "viem";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAddress(address?: string | null) {
  if (!address || !isAddress(address)) {
    return "未连接";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

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

export function formatRelativeDate(timestamp?: number | null) {
  if (!timestamp) {
    return "暂无";
  }

  const value = timestamp > 10_000_000_000 ? timestamp : timestamp * 1000;
  const delta = Date.now() - value;
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

  if (delta < hour) {
    return "刚刚";
  }
  if (delta < day) {
    return `${Math.round(delta / hour)} 小时前`;
  }

  return `${Math.round(delta / day)} 天前`;
}

export function formatEth(wei: bigint | string) {
  const value = typeof wei === "string" ? BigInt(wei) : wei;
  const eth = Number(formatEther(value));
  return `${eth.toFixed(3).replace(/\.?0+$/, "")} ETH`;
}

export function createFailureId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
