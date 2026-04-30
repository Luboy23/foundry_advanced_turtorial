"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
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
import { shortenAddress } from "@/lib/utils";
import { useChainConsistency } from "@/hooks/useChainConsistency";
import { useRuntimeConfig } from "@/hooks/useRuntimeConfig";
import { useWalletStatus } from "@/hooks/useWalletStatus";
import type { CreatorLedgerResponse } from "@/types/domain";

const PAGE_LIMIT = 20;

export function LedgerPageView() {
  const config = useRuntimeConfig();
  const wallet = useWalletStatus(config.chainId);
  const chainConsistency = useChainConsistency({ config, enabled: wallet.isHydrated });
  const creator = (wallet.address ?? config.demoAddresses.creator) as `0x${string}`;

  const ledgerQuery = useInfiniteQuery({
    queryKey: scopedQueryKey(config, "creator-ledger", creator),
    queryFn: ({ pageParam }) =>
      fetchJson<CreatorLedgerResponse>(`/api/ledger?creator=${creator}&limit=${PAGE_LIMIT}${pageParam ? `&cursor=${pageParam}` : ""}`),
    enabled: Boolean(creator),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.pageInfo.nextCursor
  });

  const pages = ledgerQuery.data?.pages ?? [];
  const ledger = pages[0];
  const claimRecords = pages.flatMap((page) => page.claimRecords);
  const splitRecords = pages.flatMap((page) => page.splitRecords);

  if (chainConsistency.isChecking || (ledgerQuery.isLoading && !ledger)) {
    return <LoadingState title="正在读取流水" description="请稍候。" />;
  }

  if (ledgerQuery.isError || !ledger) {
    return <ErrorState title="读取失败" description="请刷新重试。" />;
  }

  return (
    <div className="flex w-full flex-col gap-8">
      <div>
        <h1 className="page-title">流水</h1>
      </div>

      {wallet.wrongChain ? (
        <ChainGuardNotice expectedChainId={config.chainId} onSwitch={wallet.switchToExpectedChain} switching={wallet.isSwitching} />
      ) : null}

      {!chainConsistency.isConsistent && chainConsistency.message ? (
        <InfoNotice title="链状态异常" description={chainConsistency.message} tone="warning" />
      ) : null}

      {ledger.meta ? <ReadModelMetaNotice meta={ledger.meta} /> : null}

      <div className="grid gap-5 md:grid-cols-3">
        <AmountCard title="领取记录数" value={`${ledger.totals.claimRecordCount}`} />
        <AmountCard title="分账记录数" value={`${ledger.totals.splitRecordCount}`} />
        <AmountCard title="当前钱包" value={shortenAddress(creator)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="领取记录">
          {claimRecords.length ? (
            <div className="space-y-3">
              {claimRecords.map((record) => (
                <RecordDisplayCard
                  key={record.claimIdHex}
                  icon={<ArrowDownLeft className="h-5 w-5" />}
                  accent="mint"
                  title={record.batchLabel}
                  subtitle={record.txHash}
                  subtitleTitle={record.txHash}
                  amount={formatAssetDisplay(record.grossAmountDisplay)}
                  meta="到账"
                />
              ))}
            </div>
          ) : (
            <EmptyState title="暂无领取记录" description="完成领取后显示。" />
          )}
        </SectionCard>

        <SectionCard title="分账记录">
          {splitRecords.length ? (
            <div className="space-y-3">
              {splitRecords.map((record) => (
                <RecordDisplayCard
                  key={`${record.claimIdHex}-${record.txHash}`}
                  icon={<ArrowUpRight className="h-5 w-5" />}
                  accent="peach"
                  title={record.isCreator ? "创作者到账" : "协作者分账"}
                  subtitle={record.txHash}
                  subtitleTitle={record.txHash}
                  amount={formatAssetDisplay(record.amountDisplay)}
                  meta={`${record.bps / 100}%`}
                />
              ))}
            </div>
          ) : (
            <EmptyState title="暂无分账记录" description="完成领取后显示。" />
          )}
        </SectionCard>
      </div>

      {ledgerQuery.hasNextPage ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => void ledgerQuery.fetchNextPage()} disabled={ledgerQuery.isFetchingNextPage}>
            {ledgerQuery.isFetchingNextPage ? "加载中..." : "加载更多"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
