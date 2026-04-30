"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ArrowDownLeft } from "lucide-react";
import { AmountCard } from "@/components/ui/AmountCard";
import { Button } from "@/components/ui/Button";
import { ChainGuardNotice } from "@/components/ui/ChainGuardNotice";
import { CurrentMonthWorkflowPanel } from "@/components/ui/CurrentMonthWorkflowPanel";
import { ReadModelMetaNotice } from "@/components/ui/ReadModelMetaNotice";
import { RecordDisplayCard } from "@/components/ui/RecordDisplayCard";
import { EmptyState, ErrorState, InfoNotice, LoadingState } from "@/components/ui/StatePanels";
import { SectionCard } from "@/components/ui/SectionCard";
import { getCurrentMonthWorkflowCopy } from "@/lib/current-month-workflow";
import { formatAssetDisplay } from "@/lib/format";
import { fetchJson } from "@/lib/fetch-json";
import { getLiveRefreshInterval, isActiveBatchStatus, isLiveBillStatus } from "@/lib/read-model-meta";
import { scopedQueryKey } from "@/lib/query-keys";
import { useChainConsistency } from "@/hooks/useChainConsistency";
import { useRoleIdentity } from "@/hooks/useRoleIdentity";
import { useRuntimeConfig } from "@/hooks/useRuntimeConfig";
import { useWalletStatus } from "@/hooks/useWalletStatus";
import type { CollaboratorReceiptsResponse, CreatorSettlementBillResponse, RevenueBatchSummaryResponse } from "@/types/domain";

const PAGE_LIMIT = 20;

function getCollaboratorActionCopy(phase: ReturnType<typeof getCurrentMonthWorkflowCopy>["phase"]) {
  if (phase === "activate") {
    return {
      title: "等待平台激活",
      description: "本月还没有进入结算流程。"
    };
  }

  if (phase === "claim") {
    return {
      title: "等待创作者领取",
      description: "领取确认后，你的分账会自动到账。"
    };
  }

  if (phase === "settled") {
    return {
      title: "已到账",
      description: "本月分账已完成，可直接查看到账记录。"
    };
  }

  if (phase === "paused") {
    return {
      title: "等待平台处理",
      description: "当前批次已暂停，到账流程暂时冻结。"
    };
  }

  return {
    title: "本月已关闭",
    description: "当前月份不再推进新的到账变化。"
  };
}

export function CollaboratorDashboardView() {
  const config = useRuntimeConfig();
  const wallet = useWalletStatus(config.chainId);
  const roleIdentity = useRoleIdentity(wallet.address);
  const chainConsistency = useChainConsistency({ config, enabled: wallet.isHydrated });
  const recipient = (wallet.address ?? config.demoAddresses.collaboratorA) as `0x${string}`;

  const batchQuery = useQuery({
    queryKey: scopedQueryKey(config, "collaborator-current-batch"),
    queryFn: () => fetchJson<RevenueBatchSummaryResponse>("/api/platform/batches/current"),
    refetchInterval: (query) => getLiveRefreshInterval(isActiveBatchStatus(query.state.data?.status ?? "draft")),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });

  const billQuery = useQuery({
    queryKey: scopedQueryKey(config, "collaborator-current-bill"),
    queryFn: () => fetchJson<CreatorSettlementBillResponse>("/api/creator/bill/current"),
    refetchInterval: (query) => getLiveRefreshInterval(isLiveBillStatus(query.state.data?.status ?? "draft")),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });

  const receiptsQuery = useInfiniteQuery({
    queryKey: scopedQueryKey(config, "collaborator-receipts", recipient),
    queryFn: ({ pageParam }) =>
      fetchJson<CollaboratorReceiptsResponse>(
        `/api/collaborator/receipts?recipient=${recipient}&limit=${PAGE_LIMIT}${pageParam ? `&cursor=${pageParam}` : ""}`
      ),
    enabled: Boolean(recipient),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.pageInfo.nextCursor,
    refetchInterval: getLiveRefreshInterval(isActiveBatchStatus(batchQuery.data?.status ?? "draft")),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });

  const pages = receiptsQuery.data?.pages ?? [];
  const receipts = pages[0];
  const records = pages.flatMap((page) => page.records);
  const currentBill = billQuery.data;

  if (chainConsistency.isChecking || billQuery.isLoading || (receiptsQuery.isLoading && !receipts)) {
    return <LoadingState title="正在读取协作者数据" description="请稍候。" />;
  }

  if (receiptsQuery.isError || billQuery.isError || !receipts || !currentBill) {
    return <ErrorState title="读取失败" description="请刷新重试。" />;
  }

  const workflow = getCurrentMonthWorkflowCopy({
    role: "collaborator",
    batchStatus: batchQuery.data?.status,
    billStatus: currentBill.status
  });
  const actionCopy = getCollaboratorActionCopy(workflow.phase);

  return (
    <div className="flex w-full flex-col gap-8">
      <div>
        <h1 className="page-title">{`${roleIdentity.collaboratorLabel ?? "协作者"}工作台`}</h1>
      </div>

      {wallet.wrongChain ? (
        <ChainGuardNotice expectedChainId={config.chainId} onSwitch={wallet.switchToExpectedChain} switching={wallet.isSwitching} />
      ) : null}

      {!chainConsistency.isConsistent && chainConsistency.message ? (
        <InfoNotice title="链状态异常" description={chainConsistency.message} tone="warning" />
      ) : null}

      <CurrentMonthWorkflowPanel
        eyebrow="协作者当前月进度"
        monthLabel={currentBill.monthLabel}
        statusLabel={workflow.statusLabel}
        statusTone={workflow.statusTone}
        title={workflow.title}
        description={workflow.description}
        steps={workflow.steps}
        nextStep={workflow.nextStep}
        expectedResult={workflow.expectedResult}
        blockingReason={workflow.blockingReason}
        action={
          <div className="rounded-[1.6rem] border border-line-soft bg-white/85 p-5 shadow-[0_14px_32px_rgba(251,114,153,0.06)]">
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-brand-pink">当前结论</div>
            <div className="mt-3 text-2xl font-black tracking-tight text-text-ink">{actionCopy.title}</div>
            <p className="mt-2 text-sm leading-6 text-text-muted">{actionCopy.description}</p>
            <div className="mt-4 rounded-[1.25rem] border border-line-soft bg-white/80 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted/70">本月预计到账</div>
              <div className="mt-2 text-2xl font-black text-text-ink">{formatAssetDisplay(receipts.summary.currentExpectedAmountDisplay)}</div>
            </div>
          </div>
        }
        summary={
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AmountCard title="本月预计到账" value={formatAssetDisplay(receipts.summary.currentExpectedAmountDisplay)} hint="创作者领取后自动到账的本月分账。" />
            <AmountCard title="累计到账" value={formatAssetDisplay(receipts.summary.totalReceivedDisplay)} hint="历史月份已到账总额。" />
            <AmountCard title="到账次数" value={`${receipts.summary.totalReceiptCount}`} hint="已完成到账的月份次数。" />
            <AmountCard title="最近批次" value={receipts.summary.latestBatchLabel ?? "--"} hint="最近一次到账记录所属月份。" />
          </div>
        }
      />

      {receipts.meta ? <ReadModelMetaNotice meta={receipts.meta} /> : billQuery.data?.meta ? <ReadModelMetaNotice meta={billQuery.data.meta} /> : batchQuery.data?.meta ? <ReadModelMetaNotice meta={batchQuery.data.meta} /> : null}

      <SectionCard title="到账记录" description="到账记录会在创作者领取后生成；当前月状态以上方进度为准。">
        {records.length ? (
          <div className="space-y-3">
            {records.map((record) => (
              <RecordDisplayCard
                key={`${record.claimIdHex}-${record.txHash}`}
                icon={<ArrowDownLeft className="h-5 w-5" />}
                accent="mint"
                title={record.batchLabel}
                subtitle={record.txHash}
                subtitleTitle={record.txHash}
                amount={formatAssetDisplay(record.amountDisplay)}
                meta={`${record.bps / 100}%`}
              />
            ))}
            {receiptsQuery.hasNextPage ? (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  onClick={() => void receiptsQuery.fetchNextPage()}
                  disabled={receiptsQuery.isFetchingNextPage}
                >
                  {receiptsQuery.isFetchingNextPage ? "加载中..." : "加载更多"}
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <EmptyState title="暂无到账记录" description="到账后会在这里显示记录。" />
        )}
      </SectionCard>
    </div>
  );
}
