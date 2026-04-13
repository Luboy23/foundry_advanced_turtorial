"use client";

import { useMemo } from "react";
import { useScoreSources, type ScoreSourceSummary } from "@/hooks/useScoreSources";
import type { ContractConfig } from "@/types/contract-config";
import type { AuthorityPublishHistoryItem } from "@/types/history";

// 把成绩源读模型折叠成考试院“链上发布记录”列表需要的最小展示结构。
export function toAuthorityPublishHistoryItems(sources: ScoreSourceSummary[]): AuthorityPublishHistoryItem[] {
  return sources.map((source) => ({
    scoreSourceId: source.scoreSourceId,
    scoreSourceIdLabel: source.scoreSourceIdLabel,
    sourceTitle: source.sourceTitle,
    issuer: source.issuer,
    issuedAt: source.issuedAt * 1000,
    txHash: source.txHash,
    blockNumber: source.blockNumber
  }));
}

// 考试院页单独使用的链上发布记录入口。
// 这里明确只认链上事件回放结果，不再混入本地 publish 缓存。
export function useAuthorityPublishRecords(args: {
  config: ContractConfig;
  enabled?: boolean;
}) {
  const { config, enabled = true } = args;
  const scoreSources = useScoreSources({ config, enabled });

  const records = useMemo(
    () => toAuthorityPublishHistoryItems(scoreSources.sources),
    [scoreSources.sources]
  );

  return {
    records,
    isLoading: scoreSources.isLoading,
    isError: scoreSources.isError,
    error: scoreSources.error,
    readSourceKey: scoreSources.readSourceKey
  };
}
