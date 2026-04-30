"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowDownLeft } from "lucide-react";
import { AmountCard } from "@/components/ui/AmountCard";
import { Button } from "@/components/ui/Button";
import { ChainGuardNotice } from "@/components/ui/ChainGuardNotice";
import { ReadModelMetaNotice } from "@/components/ui/ReadModelMetaNotice";
import { RecordDisplayCard } from "@/components/ui/RecordDisplayCard";
import { InfoNotice } from "@/components/ui/StatePanels";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StatePanels";
import { SectionCard } from "@/components/ui/SectionCard";
import { formatAssetDisplay } from "@/lib/format";
import { fetchJson } from "@/lib/fetch-json";
import { scopedQueryKey } from "@/lib/query-keys";
import { useChainConsistency } from "@/hooks/useChainConsistency";
import { useRuntimeConfig } from "@/hooks/useRuntimeConfig";
import { useWalletStatus } from "@/hooks/useWalletStatus";
import type { CreatorHistoryResponse } from "@/types/domain";

const PAGE_LIMIT = 20;

export function CreatorHistoryView() {
  const config = useRuntimeConfig();
  const wallet = useWalletStatus(config.chainId);
  const chainConsistency = useChainConsistency({ config, enabled: wallet.isHydrated });
  const creator = (wallet.address ?? config.demoAddresses.creator) as `0x${string}`;

  const historyQuery = useInfiniteQuery({
    queryKey: scopedQueryKey(config, "creator-history-page", creator),
    queryFn: ({ pageParam }) =>
      fetchJson<CreatorHistoryResponse>(
        `/api/creator/history?creator=${creator}&limit=${PAGE_LIMIT}${pageParam ? `&cursor=${pageParam}` : ""}`
      ),
    enabled: Boolean(creator),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.pageInfo.nextCursor
  });

  const pages = historyQuery.data?.pages ?? [];
  const history = pages[0];
  const records = pages.flatMap((page) => page.records);

  if (chainConsistency.isChecking || (historyQuery.isLoading && !history)) {
    return <LoadingState title="正在读取历史记录" description="请稍候。" />;
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
        <AmountCard title="累计批次" value={`${history.summary.totalClaimCount}`} />
        <AmountCard title="累计到账" value={formatAssetDisplay(history.summary.totalClaimedDisplay)} />
        <AmountCard title="最近批次" value={history.summary.latestBatchLabel ?? "--"} />
      </div>

      <SectionCard title="领取记录">
        {records.length ? (
          <div className="space-y-3">
            {records.map((record) => (
              <RecordDisplayCard
                key={record.claimIdHex}
                icon={<ArrowDownLeft className="h-5 w-5" />}
                accent="mint"
                title={record.batchLabel}
                subtitle={record.txHash}
                subtitleTitle={record.txHash}
                amount={formatAssetDisplay(record.grossAmountDisplay)}
                meta="已到账"
              />
            ))}
            {historyQuery.hasNextPage ? (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  onClick={() => void historyQuery.fetchNextPage()}
                  disabled={historyQuery.isFetchingNextPage}
                >
                  {historyQuery.isFetchingNextPage ? "加载中..." : "加载更多"}
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <EmptyState title="暂无记录" description="完成领取后显示。" />
        )}
      </SectionCard>
    </div>
  );
}
