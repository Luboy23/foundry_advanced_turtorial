import type { BatchLabelMap } from "@/types/contract-config";

export function normalizeBatchLabelMap(input: unknown): BatchLabelMap {
  if (!input || typeof input !== "object") {
    return {};
  }

  const entries = Object.entries(input).flatMap(([batchId, label]) => {
    if (typeof batchId !== "string" || !batchId.startsWith("0x")) {
      return [];
    }

    if (typeof label !== "string" || label.trim().length === 0) {
      return [];
    }

    return [[batchId.toLowerCase() as `0x${string}`, label.trim()] as const];
  });

  return Object.fromEntries(entries) as BatchLabelMap;
}

export function resolveBatchLabel(
  batchId: string | undefined,
  batchLabelMap: BatchLabelMap,
  fallback?: string | null
) {
  if (!batchId) {
    return fallback ?? "--";
  }

  return batchLabelMap[batchId.toLowerCase() as `0x${string}`] ?? fallback ?? batchId.slice(0, 10);
}
