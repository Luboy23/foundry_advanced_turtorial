import type { Address, RuntimeConfig } from "@/types/contract-config";
import type { FailureHistoryEntry } from "@/types/domain";
import { getRuntimeScope } from "@/lib/runtime-config";

/**
 * 本地失败历史存储层。
 *
 * 失败历史只作为当前浏览器的辅助诊断信息，因此直接放在 localStorage，并通过自定义事件
 * 和 `storage` 事件同步到其他标签页。
 */
const FAILURE_HISTORY_EVENT = "unemployment-benefit.failure-history:change";

/** 生成当前部署和账户对应的失败历史键。 */
function getFailureHistoryKey(config: RuntimeConfig, address: Address) {
  return `unemployment-benefit.failure-history:${getRuntimeScope(config, address)}`;
}

/** 主动广播失败历史变化。 */
function emitFailureHistoryChange() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(FAILURE_HISTORY_EVENT));
}

/** 订阅失败历史变化，兼容跨标签页更新。 */
export function subscribeFailureHistory(onChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleChange = () => onChange();
  window.addEventListener("storage", handleChange);
  window.addEventListener(FAILURE_HISTORY_EVENT, handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(FAILURE_HISTORY_EVENT, handleChange);
  };
}

/** 从 localStorage 读取失败历史；解析失败时返回空数组。 */
export function loadFailureHistory(config: RuntimeConfig, address: Address): FailureHistoryEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(getFailureHistoryKey(config, address));
    return raw ? (JSON.parse(raw) as FailureHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

/** 追加一条失败记录，并限制本地历史长度。 */
export function appendFailureHistory(
  config: RuntimeConfig,
  address: Address,
  entry: FailureHistoryEntry
) {
  if (typeof window === "undefined") {
    return;
  }

  const nextEntries = [entry, ...loadFailureHistory(config, address)].slice(0, 20);
  window.localStorage.setItem(getFailureHistoryKey(config, address), JSON.stringify(nextEntries));
  emitFailureHistoryChange();
}

/** 清空当前地址的失败历史。 */
export function clearFailureHistory(config: RuntimeConfig, address: Address) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(getFailureHistoryKey(config, address));
  emitFailureHistoryChange();
}
