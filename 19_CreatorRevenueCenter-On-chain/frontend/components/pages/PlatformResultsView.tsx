"use client";

import { useQuery } from "@tanstack/react-query";
import { ChainGuardNotice } from "@/components/ui/ChainGuardNotice";
import { ReadModelMetaNotice } from "@/components/ui/ReadModelMetaNotice";
import { SectionCard } from "@/components/ui/SectionCard";
import { ErrorState, InfoNotice, LoadingState } from "@/components/ui/StatePanels";
import { formatAssetDisplay } from "@/lib/format";
import { fetchJson } from "@/lib/fetch-json";
import { scopedQueryKey } from "@/lib/query-keys";
import { getLiveRefreshInterval, isActiveBatchStatus } from "@/lib/read-model-meta";
import { formatDateTime } from "@/lib/utils";
import { useChainConsistency } from "@/hooks/useChainConsistency";
import { usePlatformRecentAction, type PlatformRecentBatchAction } from "@/hooks/usePlatformRecentAction";
import { useRuntimeConfig } from "@/hooks/useRuntimeConfig";
import { useWalletStatus } from "@/hooks/useWalletStatus";
import type { PlatformActivityResponse, RevenueBatchSummaryResponse } from "@/types/domain";

function getBatchActionLabel(action: PlatformRecentBatchAction["action"]) {
  if (action === "resume") return "恢复批次";
  if (action === "pause") return "暂停批次";
  return "关闭批次";
}

function ResultCard({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.5rem] border border-line-soft bg-white/80 p-5">
      <div className="text-sm font-semibold text-text-ink">{title}</div>
      <div className="mt-3 min-w-0 space-y-3">{children}</div>
    </div>
  );
}

function ResultRow({
  label,
  value,
  mono = false
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted/70">{label}</div>
      <div className={mono ? "mt-1 break-all font-mono text-[13px] leading-6 text-text-muted" : "mt-1 text-sm leading-6 text-text-muted"}>
        {value}
      </div>
    </div>
  );
}

function ResultEmpty({ message }: { message: string }) {
  return <p className="text-sm leading-6 text-text-muted">{message}</p>;
}

export function PlatformResultsView() {
  const config = useRuntimeConfig();
  const wallet = useWalletStatus(config.chainId);
  const chainConsistency = useChainConsistency({ config, enabled: wallet.isHydrated });
  const { lastAction } = usePlatformRecentAction(config.deploymentId);

  const batchQuery = useQuery({
    queryKey: scopedQueryKey(config, "platform-current-batch"),
    queryFn: () => fetchJson<RevenueBatchSummaryResponse>("/api/platform/batches/current"),
    refetchInterval: (query) => getLiveRefreshInterval(isActiveBatchStatus(query.state.data?.status ?? "draft")),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });

  const activityQuery = useQuery({
    queryKey: scopedQueryKey(config, "platform-activity"),
    queryFn: () => fetchJson<PlatformActivityResponse>("/api/platform/activity"),
    refetchInterval: (query) => getLiveRefreshInterval(isActiveBatchStatus(batchQuery.data?.status ?? "draft")),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });

  if (chainConsistency.isChecking || batchQuery.isLoading || activityQuery.isLoading) {
    return <LoadingState title="正在读取最近结果" description="请稍候。" />;
  }

  if (batchQuery.isError || activityQuery.isError || !batchQuery.data || !activityQuery.data) {
    return <ErrorState title="读取失败" description="请刷新重试。" />;
  }

  const batch = batchQuery.data;
  const latestPublishContext = activityQuery.data.latestPublishContext;

  return (
    <div className="flex w-full flex-col gap-8">
      <div>
        <h1 className="page-title">最近结果</h1>
      </div>

      {wallet.wrongChain ? (
        <ChainGuardNotice expectedChainId={config.chainId} onSwitch={wallet.switchToExpectedChain} switching={wallet.isSwitching} />
      ) : null}

      {!chainConsistency.isConsistent && chainConsistency.message ? (
        <InfoNotice title="链状态异常" description={chainConsistency.message} tone="warning" />
      ) : null}

      {batch.meta ? <ReadModelMetaNotice meta={batch.meta} /> : null}
      {activityQuery.data.meta ? <ReadModelMetaNotice meta={activityQuery.data.meta} /> : null}

      <SectionCard title="最近结果" description="保留最近同步、激活和批次操作结果，用于快速核对。">
        <div className="grid gap-4 xl:grid-cols-2">
          <ResultCard title="最近同步">
            <ResultRow label="时间" value={formatDateTime(batch.lastSyncedAt)} />
            <ResultRow label="当前批次" value={batch.monthLabel} />
          </ResultCard>

          <ResultCard title="最近激活">
            {latestPublishContext ? (
              <>
                <ResultRow label="月份" value={latestPublishContext.monthLabel} />
                <ResultRow label="总额" value={formatAssetDisplay(latestPublishContext.grossAmountDisplay, "ETH")} />
                <ResultRow label="交易" value={latestPublishContext.txHash} mono />
              </>
            ) : (
              <ResultEmpty message="暂无记录" />
            )}
          </ResultCard>

          <ResultCard title="最近发布上下文">
            {latestPublishContext ? (
              <>
                <ResultRow label="月份" value={latestPublishContext.monthLabel} />
                <ResultRow label="账单" value={latestPublishContext.billId} mono />
                <ResultRow label="交易" value={latestPublishContext.txHash} mono />
              </>
            ) : (
              <ResultEmpty message="暂无记录" />
            )}
          </ResultCard>

          <ResultCard title="最近动作">
            {lastAction ? (
              <>
                <ResultRow label="动作" value={getBatchActionLabel(lastAction.action)} />
                <ResultRow label="交易" value={lastAction.hash} mono />
                <ResultRow label="区块" value={lastAction.blockNumber} mono />
                <ResultRow label="时间" value={formatDateTime(lastAction.updatedAt)} />
              </>
            ) : (
              <ResultEmpty message="完成暂停、恢复或关闭后会显示在这里。" />
            )}
          </ResultCard>
        </div>
      </SectionCard>
    </div>
  );
}
