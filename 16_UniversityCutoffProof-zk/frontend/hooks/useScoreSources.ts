"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getScoreSourceConfig,
  scoreSourceCreatedEvent
} from "@/lib/contracts/score-root-registry";
import { decodeBytes32Label } from "@/lib/admission/rule-version";
import { useReadClient } from "@/hooks/useReadClient";
import type { ContractConfig } from "@/types/contract-config";

export type ScoreSourceSummary = {
  scoreSourceId: `0x${string}`;
  scoreSourceIdLabel: string;
  sourceTitle: string;
  merkleRoot: bigint;
  maxScore: number;
  issuedAt: number;
  issuer: `0x${string}`;
  active: boolean;
  txHash?: `0x${string}`;
  blockNumber?: bigint;
};

// 统一读取考试院已经发布过的成绩源列表，并派生出“最新一条”和“当前仍启用的一条”。
// 这个 hook 是考试院页、大学页、学生页共享的真实成绩批次读模型。
export function useScoreSources(args: {
  config: ContractConfig;
  enabled?: boolean;
}) {
  const { config, enabled = true } = args;
  const readClientState = useReadClient(config);
  const publicClient = readClientState.client;

  const query = useQuery({
    queryKey: [
      "score-sources",
      config.scoreRootRegistryAddress,
      readClientState.sourceKey
    ],
    enabled: Boolean(enabled && readClientState.isReady && publicClient),
    queryFn: async () => {
      // 链上没有“成绩源列表”接口，因此前端通过 ScoreSourceCreated 事件回溯全部历史发布记录。
      const logs = await publicClient!.getLogs({
        address: config.scoreRootRegistryAddress,
        event: scoreSourceCreatedEvent,
        fromBlock: 0n
      });

      // 同一个成绩源编号理论上只该创建一次，但这里仍按“取最新日志”做保护，
      // 避免教学链反复重置或测试回放时出现重复事件导致前端读模型抖动。
      const latestLogsById = new Map<`0x${string}`, (typeof logs)[number]>();
      for (const log of logs) {
        const scoreSourceId = log.args.scoreSourceId!;
        const current = latestLogsById.get(scoreSourceId);
        if (!current?.blockNumber || (log.blockNumber && log.blockNumber > current.blockNumber)) {
          latestLogsById.set(scoreSourceId, log);
        }
      }

      const sources = await Promise.all(
        [...latestLogsById.entries()].map(async ([scoreSourceId, log]) => {
          // 事件只提供索引入口，真正展示仍然以合约当前状态为准，
          // 这样停用/更新之后，前端读到的是最新链上真相而不是旧事件快照。
          const source = await getScoreSourceConfig(
            publicClient!,
            config.scoreRootRegistryAddress,
            scoreSourceId
          );

          return {
            ...source,
            scoreSourceIdLabel: decodeBytes32Label(scoreSourceId),
            txHash: log.transactionHash,
            blockNumber: log.blockNumber
          } satisfies ScoreSourceSummary;
        })
      );

      return sources.sort((left, right) => {
        // 统一按发布时间倒序展示；如果时间相同，再按区块号兜底。
        if (left.issuedAt !== right.issuedAt) {
          return right.issuedAt - left.issuedAt;
        }
        return Number((right.blockNumber ?? 0n) - (left.blockNumber ?? 0n));
      });
    }
  });

  // query.data 为空时也返回稳定数组，减少页面层的空值分支和闪烁判断。
  const sources = useMemo(() => query.data ?? [], [query.data]);
  const latestSource = sources[0] ?? null;
  const latestActiveSource = sources.find((source) => source.active) ?? null;

  return {
    sources,
    latestSource,
    latestActiveSource,
    isLoading:
      Boolean(query.isLoading) ||
      Boolean(enabled && !readClientState.isReady && !readClientState.isWrongChain),
    isError: query.isError,
    error: query.error,
    readSourceKey: readClientState.sourceKey
  };
}
