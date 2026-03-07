"use client";

import { useMemo } from "react";
import { usePublicClient } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { ANVIL_CHAIN_ID } from "@/lib/chain";
import {
  SCORE_CONTRACT_ABI,
  SCORE_CONTRACT_ADDRESS,
  isZeroAddress,
} from "@/lib/contract";
import { leaderboardKey } from "@/lib/query-keys";
import {
  formatDuration,
  formatTimestamp,
  formatUpdatedAt,
  shortenAddress,
} from "@/lib/format";

type LeaderboardProps = {
  variant?: "card" | "plain";
  onClose?: () => void;
};

export default function Leaderboard({
  variant = "card",
  onClose,
}: LeaderboardProps) {
  const publicClient = usePublicClient({ chainId: ANVIL_CHAIN_ID });
  const hasContract = !isZeroAddress(SCORE_CONTRACT_ADDRESS);
  // 只有“合约地址有效 + RPC 客户端可用”时才发起链上读取。
  const enabled = hasContract && !!publicClient;

  const query = useQuery({
    queryKey: leaderboardKey(SCORE_CONTRACT_ADDRESS),
    enabled,
    queryFn: async () => {
      const result = (await publicClient!.readContract({
        address: SCORE_CONTRACT_ADDRESS as `0x${string}`,
        abi: SCORE_CONTRACT_ABI,
        functionName: "getLeaderboard",
      })) as ReadonlyArray<{
        player: `0x${string}`;
        score: number | bigint;
        duration: number | bigint;
        timestamp: number | bigint;
      }>;

      // 前端再次执行排序与截断，确保展示规则与合约侧保持一致（Top10、同分按更早时间优先）。
      return result
        .map((entry) => ({
          player: entry.player,
          score: Number(entry.score),
          duration: Number(entry.duration),
          timestamp: Number(entry.timestamp),
        }))
        .sort((a, b) => {
          if (b.score !== a.score) {
            return b.score - a.score;
          }
          return a.timestamp - b.timestamp;
        })
        .slice(0, 10);
    },
    // 允许短周期刷新，兼顾“事件驱动刷新”与“定时兜底刷新”。
    staleTime: 5000,
    gcTime: 60_000,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const entries = useMemo(() => query.data ?? [], [query.data]);
  const errorMessage = !hasContract
    ? "未读取到合约地址，请检查 frontend/.env.local 并重启前端。"
    : query.error instanceof Error
      ? query.error.message
      : query.error
        ? "链上排行榜加载失败，请稍后重试。"
        : null;

  const rows = useMemo(() => {
    if (entries.length === 0) {
      return (
        <div className="text-xs text-[var(--primary-text-color)]">
          暂无链上记录，完成一局并提交后即可上榜
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-2">
        {entries.map((entry, index) => (
          <div
            key={`${entry.player}-${entry.timestamp}`}
            className="flex items-start justify-between rounded bg-[var(--primary-background)] px-3 py-2 text-xs"
          >
            <div className="flex items-center gap-2">
              <span className="font-semibold">#{index + 1}</span>
              <span>{shortenAddress(entry.player)}</span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-3">
                <span className="font-semibold">{entry.score}</span>
                <span className="text-[var(--primary-text-color)]">
                  用时 {formatDuration(entry.duration)}
                </span>
              </div>
              <span className="text-[10px] text-[var(--primary-text-color)]">
                {formatTimestamp(entry.timestamp)}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  }, [entries]);

  const skeletonRows = (
    <div className="flex flex-col gap-2 animate-pulse">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={`skeleton-${index}`}
          className="flex items-center justify-between rounded bg-[var(--primary-background)] px-3 py-2"
        >
          <div className="h-3 w-24 rounded bg-[var(--secondary-background)]" />
          <div className="h-3 w-20 rounded bg-[var(--secondary-background)]" />
        </div>
      ))}
    </div>
  );

  return (
    <div
      className={
        variant === "card"
          ? "flex h-full flex-col gap-4 rounded-lg border border-[var(--secondary-background)] bg-white p-4 text-sm"
          : "flex h-full flex-col gap-4 text-sm"
      }
    >
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <div className="text-lg font-semibold">链上排行榜</div>
          <div className="text-[10px] text-[var(--primary-text-color)] opacity-70">
            更新时间：{formatUpdatedAt(query.dataUpdatedAt)}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => query.refetch()}
            disabled={query.isFetching || !enabled}
            className="text-xs font-semibold uppercase tracking-wide text-[var(--button-background)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            刷新排行榜
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold uppercase tracking-wide text-[var(--button-background)]"
            >
              关闭
            </button>
          )}
        </div>
      </div>

      {query.isLoading && (
        <div className="flex flex-col gap-3">
          <div className="text-xs text-[var(--primary-text-color)]">
            正在加载链上排行榜...
          </div>
          {skeletonRows}
        </div>
      )}

      {errorMessage && (
        <div className="rounded bg-red-50 p-2 text-xs text-red-600">
          {errorMessage}
        </div>
      )}

      {!query.isLoading && !errorMessage && rows}
    </div>
  );
}
