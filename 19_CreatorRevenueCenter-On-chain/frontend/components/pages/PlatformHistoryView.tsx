"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import { AmountCard } from "@/components/ui/AmountCard";
import { Button } from "@/components/ui/Button";
import { ChainGuardNotice } from "@/components/ui/ChainGuardNotice";
import { ReadModelMetaNotice } from "@/components/ui/ReadModelMetaNotice";
import { RecordDisplayCard } from "@/components/ui/RecordDisplayCard";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, InfoNotice, LoadingState } from "@/components/ui/StatePanels";
import { formatAssetDisplay } from "@/lib/format";
import { fetchJson } from "@/lib/fetch-json";
import { scopedQueryKey } from "@/lib/query-keys";
import { getBillStatusMeta } from "@/lib/settlement-status";
import { cn } from "@/lib/utils";
import { useChainConsistency } from "@/hooks/useChainConsistency";
import { useRuntimeConfig } from "@/hooks/useRuntimeConfig";
import { useWalletStatus } from "@/hooks/useWalletStatus";
import type { PlatformHistoryMonthRecord, PlatformHistoryResponse } from "@/types/domain";

const PAGE_LIMIT = 20;

function getPlatformHistoryParticipantStatusMeta(status: PlatformHistoryMonthRecord["status"]) {
  if (status === "claimable") {
    return {
      label: "待领取",
      tone: "warning" as const
    };
  }

  if (status === "claimed") {
    return {
      label: "已到账",
      tone: "success" as const
    };
  }

  if (status === "paused") {
    return {
      label: "已暂停",
      tone: "warning" as const
    };
  }

  if (status === "closed") {
    return {
      label: "已关闭",
      tone: "danger" as const
    };
  }

  return {
    label: "待激活",
    tone: "neutral" as const
  };
}

function getPlatformHistoryCardClassName(status: PlatformHistoryMonthRecord["status"]) {
  if (status === "claimable") {
    return "border-brand-pink/25 bg-bg-soft-pink/35";
  }

  if (status === "paused") {
    return "border-warning-peach/25 bg-warning-peach/10";
  }

  if (status === "closed") {
    return "border-rose-200 bg-rose-50/70";
  }

  return "border-line-soft bg-white/80";
}

export function PlatformHistoryView() {
  const config = useRuntimeConfig();
  const wallet = useWalletStatus(config.chainId);
  const chainConsistency = useChainConsistency({ config, enabled: wallet.isHydrated });

  const historyQuery = useInfiniteQuery({
    queryKey: scopedQueryKey(config, "platform-history"),
    queryFn: ({ pageParam }) =>
      fetchJson<PlatformHistoryResponse>(`/api/platform/history?limit=${PAGE_LIMIT}${pageParam ? `&cursor=${pageParam}` : ""}`),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.pageInfo.nextCursor
  });

  const pages = historyQuery.data?.pages ?? [];
  const history = pages[0];
  const records = pages.flatMap((page) => page.records);

  if (chainConsistency.isChecking || (historyQuery.isLoading && !history)) {
    return <LoadingState title="正在读取平台历史记录" description="请稍候。" />;
  }

  if (historyQuery.isError || !history) {
    return <ErrorState title="读取失败" description="请刷新重试。" />;
  }

  return (
    <div className="flex w-full flex-col gap-8">
      <div>
        <h1 className="page-title">历史记录</h1>
      </div>

      {wallet.wrongChain ? (
        <ChainGuardNotice expectedChainId={config.chainId} onSwitch={wallet.switchToExpectedChain} switching={wallet.isSwitching} />
      ) : null}

      {!chainConsistency.isConsistent && chainConsistency.message ? (
        <InfoNotice title="链状态异常" description={chainConsistency.message} tone="warning" />
      ) : null}

      {history.meta ? <ReadModelMetaNotice meta={history.meta} /> : null}

      <div className="grid gap-5 md:grid-cols-3">
        <AmountCard title="记录月份" value={`${history.pageInfo.totalCount}`} />
        <AmountCard title="最近月份" value={records[0]?.monthLabel ?? "--"} />
        <AmountCard title="当前展示" value={`${records.length}`} />
      </div>

      <SectionCard title="历史记录" description="按月份查看创作者、编导和摄影的分配结果与领取状态。">
        {records.length ? (
          <div className="space-y-4">
            {records.map((record) => {
              const recordStatusMeta = getBillStatusMeta(record.status);

              return (
                <div
                  key={`${record.monthLabel}-${record.claimIdHex}`}
                  className={cn("rounded-[1.65rem] border p-5 shadow-[var(--shadow-soft-pink)] transition", getPlatformHistoryCardClassName(record.status))}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="text-xl font-black tracking-tight text-text-ink">{record.monthLabel}</div>
                        <StatusBadge label={recordStatusMeta.label} tone={recordStatusMeta.tone} />
                      </div>
                      <p className="mt-2 text-sm leading-6 text-text-muted">{recordStatusMeta.description}</p>
                    </div>

                    <div className="rounded-[1.25rem] border border-line-soft bg-white/90 px-4 py-3 lg:min-w-[220px] lg:text-right">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted/70">创作收益总额</div>
                      <div className="mt-1 text-xl font-black text-brand-pink">{formatAssetDisplay(record.grossAmountDisplay)}</div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {record.participants.map((participant) => {
                      const participantStatusMeta = getPlatformHistoryParticipantStatusMeta(participant.status);

                      return (
                        <RecordDisplayCard
                          key={`${record.claimIdHex}-${participant.recipient}`}
                          icon={<ArrowUpRight className="h-5 w-5" />}
                          accent="peach"
                          title={participant.label}
                          subtitle={participant.recipient}
                          subtitleTitle={participant.recipient}
                          amount={formatAssetDisplay(participant.amountDisplay)}
                          meta={participantStatusMeta.label}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {historyQuery.hasNextPage ? (
              <div className="flex justify-center pt-2">
                <Button variant="outline" onClick={() => void historyQuery.fetchNextPage()} disabled={historyQuery.isFetchingNextPage}>
                  {historyQuery.isFetchingNextPage ? "加载中..." : "加载更多"}
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <EmptyState title="暂无历史记录" description="产生领取结果后会显示在这里。" />
        )}
      </SectionCard>
    </div>
  );
}
