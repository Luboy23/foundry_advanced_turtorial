import { formatDateTime } from "@/lib/utils";
import type { CreatorSettlementBill, ReadModelMeta, RevenueBatchSummary } from "@/types/domain";

const ACTIVE_REFRESH_INTERVAL_MS = 10_000;

export function getReadModelSourceLabel(source: ReadModelMeta["source"]) {
  if (source === "indexer") return "索引器读模型";
  if (source === "chain") return "链上事件回退";
  if (source === "server-data+chain") return "私有输入 + 链上状态";
  return "私有输入";
}

export function getReadModelMetaDescription(meta: ReadModelMeta) {
  const sourceLabel = getReadModelSourceLabel(meta.source);
  const syncedAtLabel = formatDateTime(meta.syncedAt);

  if (meta.degraded) {
    return `当前数据来自 ${sourceLabel}，已进入降级模式。最近同步时间：${syncedAtLabel}。${meta.reason ?? "请稍后刷新页面重试。"}`
  }

  return `当前数据来自 ${sourceLabel}。最近同步时间：${syncedAtLabel}。部署会话：${meta.deploymentId}。`;
}

export function getReadModelMetaTitle(meta: ReadModelMeta) {
  return meta.degraded ? "当前数据已进入降级读取模式" : "当前数据同步正常";
}

export function getReadModelMetaTone(meta: ReadModelMeta) {
  return meta.degraded ? "warning" as const : "info" as const;
}

export function getLiveRefreshInterval(active: boolean) {
  return active ? ACTIVE_REFRESH_INTERVAL_MS : false;
}

export function isActiveBatchStatus(status: RevenueBatchSummary["status"]) {
  return status !== "closed";
}

export function isLiveBillStatus(status: CreatorSettlementBill["status"]) {
  return status !== "claimed" && status !== "closed";
}
