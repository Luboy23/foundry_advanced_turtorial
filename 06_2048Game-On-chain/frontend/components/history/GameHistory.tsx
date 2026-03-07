"use client";

import { useMemo } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ANVIL_CHAIN_ID } from "@/lib/chain";
import {
  SCORE_CONTRACT_ABI,
  SCORE_CONTRACT_ADDRESS,
  isZeroAddress,
} from "@/lib/contract";
import { historyCountKey, historyKey } from "@/lib/query-keys";
import { formatDuration, formatTimestamp, formatUpdatedAt } from "@/lib/format";

const PAGE_SIZE = 10;

type GameHistoryProps = {
  onClose?: () => void;
};

export default function GameHistory({ onClose }: GameHistoryProps) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: ANVIL_CHAIN_ID });
  const playerAddress = address as `0x${string}` | undefined;
  const hasContract = !isZeroAddress(SCORE_CONTRACT_ADDRESS);
  // 历史记录与当前钱包强绑定：未连接钱包时不发请求。
  const enabled =
    hasContract && !!publicClient && isConnected && !!playerAddress;

  // 单独查询总数，供分页“是否还有下一页”判断使用。
  const countQuery = useQuery({
    queryKey: historyCountKey(SCORE_CONTRACT_ADDRESS, playerAddress),
    enabled,
    queryFn: async () => {
      if (!playerAddress) {
        throw new Error("请先连接钱包查看链上记录。");
      }
      const countResult = (await publicClient!.readContract({
        address: SCORE_CONTRACT_ADDRESS as `0x${string}`,
        abi: SCORE_CONTRACT_ABI,
        functionName: "getPlayerHistoryCount",
        args: [playerAddress],
      })) as bigint;
      return Number(countResult);
    },
    staleTime: 5000,
    gcTime: 60_000,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const historyQuery = useInfiniteQuery({
    queryKey: historyKey(SCORE_CONTRACT_ADDRESS, playerAddress),
    enabled,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      if (!playerAddress) {
        throw new Error("请先连接钱包查看链上记录。");
      }
      // offset = 已加载条数，按 10 条一页向后读取最新历史。
      const offset = Number(pageParam ?? 0);
      const result = (await publicClient!.readContract({
        address: SCORE_CONTRACT_ADDRESS as `0x${string}`,
        abi: SCORE_CONTRACT_ABI,
        functionName: "getPlayerHistory",
        args: [playerAddress, BigInt(offset), BigInt(PAGE_SIZE)],
      })) as ReadonlyArray<{
        score: number | bigint;
        duration: number | bigint;
        timestamp: number | bigint;
      }>;

      const items = result.map((entry) => ({
        score: Number(entry.score),
        duration: Number(entry.duration),
        timestamp: Number(entry.timestamp),
      }));

      return { items };
    },
    getNextPageParam: (_lastPage, pages) => {
      const totalCount = countQuery.data ?? 0;
      const loadedCount = pages.reduce(
        (acc, page) => acc + page.items.length,
        0
      );
      // 已加载数小于总数时继续请求下一页，否则停止分页。
      return loadedCount < totalCount ? loadedCount : undefined;
    },
    staleTime: 5000,
    gcTime: 60_000,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const entries = useMemo(
    () => historyQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [historyQuery.data]
  );
  const totalCount = countQuery.data ?? 0;
  const isLoading = historyQuery.isLoading || countQuery.isLoading;
  const isLoadingMore = historyQuery.isFetchingNextPage;
  const hasMore = Boolean(historyQuery.hasNextPage);
  const lastUpdated = Math.max(
    historyQuery.dataUpdatedAt,
    countQuery.dataUpdatedAt
  );

  const errorMessage = !hasContract
    ? "未读取到合约地址，请检查 frontend/.env.local 并重启前端。"
    : !isConnected || !address
      ? "请先连接钱包查看链上记录。"
      : historyQuery.error instanceof Error
        ? historyQuery.error.message
        : countQuery.error instanceof Error
          ? countQuery.error.message
          : historyQuery.error || countQuery.error
            ? "链上记录加载失败，请稍后重试。"
            : null;

  const rows = useMemo(() => {
    if (entries.length === 0) {
      return (
        <div className="text-xs text-[var(--primary-text-color)]">
          暂无链上记录，完成一局并提交后会显示。
        </div>
      );
    }

    return (
      <div className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
        {entries.map((entry, index) => (
          <div
            key={`${entry.timestamp}-${index}`}
            className="flex items-start justify-between rounded bg-[var(--primary-background)] px-3 py-2 text-xs"
          >
            <div className="flex items-center gap-2">
              <span className="font-semibold">#{index + 1}</span>
              <span className="text-[var(--primary-text-color)]">
                得分 {entry.score}
              </span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[var(--primary-text-color)]">
                用时 {formatDuration(entry.duration)}
              </span>
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
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={`skeleton-${index}`}
          className="flex items-center justify-between rounded bg-[var(--primary-background)] px-3 py-2"
        >
          <div className="h-3 w-20 rounded bg-[var(--secondary-background)]" />
          <div className="h-3 w-16 rounded bg-[var(--secondary-background)]" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex h-full flex-col gap-4 text-sm">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <div className="text-lg font-semibold">链上记录</div>
          <div className="text-[10px] text-[var(--primary-text-color)] opacity-70">
            更新时间：{formatUpdatedAt(lastUpdated)}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              void countQuery.refetch();
              void historyQuery.refetch();
            }}
            disabled={isLoading || !enabled}
            className="text-xs font-semibold uppercase tracking-wide text-[var(--button-background)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            刷新链上记录
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

      {isLoading && (
        <div className="flex flex-col gap-3">
          <div className="text-xs text-[var(--primary-text-color)]">
            正在加载链上记录...
          </div>
          {skeletonRows}
        </div>
      )}

      {errorMessage && (
        <div className="rounded bg-red-50 p-2 text-xs text-red-600">
          {errorMessage}
        </div>
      )}

      {!isLoading && !errorMessage && rows}

      {!isLoading && !errorMessage && hasMore && (
        <button
          type="button"
          onClick={() => historyQuery.fetchNextPage()}
          disabled={isLoadingMore}
          className="self-center rounded border border-[var(--secondary-background)] px-3 py-1 text-xs font-semibold text-[var(--primary-text-color)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoadingMore
            ? "加载中..."
            : `加载更多（已加载 ${entries.length}/${totalCount} 条）`}
        </button>
      )}
    </div>
  );
}
