"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuthorityWorkbench } from "@/lib/api/authority";
import { normalizeAuthorityDraftPayload } from "@/lib/authority/draft";
import type { ScoreSourceDraft } from "@/types/admission";
import type { AuthorityPublishHistoryItem } from "@/types/history";

// 考试院 workbench hook。
// 这里只做 DTO -> 前端稳定结构的转换，不再在前端拼草稿、发布记录或链上成绩源真相。
function toOptionalHexString(value: unknown) {
  return typeof value === "string" ? (value as `0x${string}`) : undefined;
}

function toOptionalBigInt(value: unknown) {
  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint") {
    return BigInt(value);
  }
  return undefined;
}

export function useAuthorityWorkbench(args: { enabled?: boolean }) {
  const { enabled = true } = args;
  const query = useQuery({
    queryKey: ["authority-workbench"],
    enabled,
    queryFn: getAuthorityWorkbench
  });

  // 后端已经把 payloadJson 解析成结构化对象，但这里仍统一走 normalize，
  // 保证“导入文件”和“从后端恢复草稿”得到完全同构的草稿结构。
  const currentDraft = useMemo(
    () => normalizeAuthorityDraftPayload(query.data?.currentDraft?.payloadJson) as ScoreSourceDraft | null,
    [query.data?.currentDraft?.payloadJson]
  );

  // 发布记录只认链上成绩源投影，不再混入任何浏览器本地 publish 缓存。
  const publishHistory = useMemo<AuthorityPublishHistoryItem[]>(
    () =>
      (query.data?.publishHistory ?? []).map((record) => ({
        scoreSourceId: record.scoreSourceId as `0x${string}`,
        scoreSourceIdLabel: record.scoreSourceIdLabel,
        sourceTitle: record.sourceTitle,
        issuer: record.issuer as `0x${string}`,
        issuedAt: new Date(record.issuedAt).getTime(),
        txHash: toOptionalHexString(record.txHash),
        blockNumber: toOptionalBigInt(record.blockNumber),
        active: record.active
      })),
    [query.data?.publishHistory]
  );

  // 发放记录是后端托管的离线操作记录，不代表链上成绩源发布历史。
  const issuanceRecords = useMemo(
    () =>
      (query.data?.issuanceRecords ?? []).map((record: {
        id: string;
        batchId: string;
        scoreSourceIdLabel: string;
        candidateLabel: string;
        boundStudentAddress: string;
        score: number;
        fileName: string;
        createdAt: string;
      }) => ({
        ...record,
        createdAt: new Date(record.createdAt).getTime()
      })),
    [query.data?.issuanceRecords]
  );

  // 最新启用成绩源和最新历史成绩源分别保留，方便考试院页区分“当前链上真相”和“待发布预览”。
  const latestActiveSource = useMemo(() => {
    const source = query.data?.latestActiveSource;
    if (!source) {
      return null;
    }
    return {
      ...source,
      scoreSourceId: source.scoreSourceId as `0x${string}`,
      merkleRoot: BigInt(source.merkleRoot),
      maxScore: Number(source.maxScore),
      issuedAt: Math.floor(new Date(source.issuedAt).getTime() / 1000),
      issuer: source.issuer as `0x${string}`
    };
  }, [query.data?.latestActiveSource]);

  const latestSource = useMemo(() => {
    const source = query.data?.latestSource;
    if (!source) {
      return null;
    }
    return {
      ...source,
      scoreSourceId: source.scoreSourceId as `0x${string}`,
      merkleRoot: BigInt(source.merkleRoot),
      maxScore: Number(source.maxScore),
      issuedAt: Math.floor(new Date(source.issuedAt).getTime() / 1000),
      issuer: source.issuer as `0x${string}`
    };
  }, [query.data?.latestSource]);

  return {
    ...query,
    draft: currentDraft,
    draftId: query.data?.currentDraft?.id ?? null,
    publishHistory,
    issuanceRecords,
    latestActiveSource,
    latestSource,
    syncStatus: query.data?.syncStatus ?? { stale: false, partialErrors: [] }
  };
}
