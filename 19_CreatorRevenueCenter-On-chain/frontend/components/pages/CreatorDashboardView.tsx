"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowRight, ReceiptText, Users, Wallet2 } from "lucide-react";
import { AmountCard } from "@/components/ui/AmountCard";
import { Button } from "@/components/ui/Button";
import { ChainGuardNotice } from "@/components/ui/ChainGuardNotice";
import { CurrentMonthWorkflowPanel } from "@/components/ui/CurrentMonthWorkflowPanel";
import { ReadModelMetaNotice } from "@/components/ui/ReadModelMetaNotice";
import { RecordDisplayCard } from "@/components/ui/RecordDisplayCard";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, InfoNotice, LoadingState } from "@/components/ui/StatePanels";
import { getCurrentMonthWorkflowCopy } from "@/lib/current-month-workflow";
import { formatAssetDisplay } from "@/lib/format";
import { fetchJson } from "@/lib/fetch-json";
import { getFriendlyErrorMessage } from "@/lib/friendly-errors";
import { scopedQueryKey } from "@/lib/query-keys";
import { getLiveRefreshInterval, isLiveBillStatus } from "@/lib/read-model-meta";
import { applyOptimisticClaimUpdates } from "@/lib/query-cache-updates";
import { getBillStatusMeta } from "@/lib/settlement-status";
import { shortenAddress } from "@/lib/utils";
import { useChainConsistency } from "@/hooks/useChainConsistency";
import { useClaimFlow } from "@/hooks/useClaimFlow";
import { useDialogAction } from "@/hooks/useDialogAction";
import { useRuntimeConfig } from "@/hooks/useRuntimeConfig";
import { useWalletStatus } from "@/hooks/useWalletStatus";
import type {
  CreatorClaimPackageResponse,
  CreatorHistoryResponse,
  CreatorSettlementBill,
  CreatorSettlementBillResponse
} from "@/types/domain";

function getClaimDisabledReason(args: {
  chainMessage: string | null;
  chainChecking: boolean;
  isConnected: boolean;
  isWriteReady: boolean;
  writeDisabledReason: string | null;
  walletAddress?: `0x${string}`;
  bill: CreatorSettlementBill | undefined;
  isBillLoading: boolean;
  isBillError: boolean;
}) {
  const { chainMessage, chainChecking, isConnected, isWriteReady, writeDisabledReason, walletAddress, bill, isBillLoading, isBillError } = args;

  if (chainChecking) {
    return "链状态校验中。";
  }

  if (chainMessage) {
    return chainMessage;
  }

  if (!isConnected) {
    return "请先连接钱包。";
  }

  if (!isWriteReady) {
    return writeDisabledReason ?? "当前钱包不可写。";
  }

  if (!walletAddress) {
    return "钱包未就绪。";
  }

  if (isBillLoading) {
    return "账单读取中。";
  }

  if (isBillError || !bill) {
    return "账单读取失败。";
  }

  if (walletAddress.toLowerCase() !== bill.creatorAddress.toLowerCase()) {
    return "当前钱包不能领取。";
  }

  if (bill.status === "draft") {
    return "平台尚未激活本月收益。";
  }

  if (bill.status === "paused") {
    return "当前批次已暂停。";
  }

  if (bill.status === "closed") {
    return "当前批次已关闭。";
  }

  if (bill.status === "claimed") {
    return "本月已领取，无需重复操作。";
  }

  return null;
}

export function CreatorDashboardView() {
  const config = useRuntimeConfig();
  const wallet = useWalletStatus(config.chainId);
  const chainConsistency = useChainConsistency({ config, enabled: wallet.isHydrated });
  const claimFlow = useClaimFlow(config);
  const runDialogAction = useDialogAction();
  const queryClient = useQueryClient();
  const creator = (wallet.address ?? config.demoAddresses.creator) as `0x${string}`;
  const [completedClaim, setCompletedClaim] = useState<{ hash: `0x${string}`; blockNumber: bigint } | null>(null);
  const [isSyncingResult, setIsSyncingResult] = useState(false);

  const billQuery = useQuery({
    queryKey: scopedQueryKey(config, "creator-current-bill"),
    queryFn: () => fetchJson<CreatorSettlementBillResponse>("/api/creator/bill/current"),
    refetchInterval: (query) => getLiveRefreshInterval(isLiveBillStatus(query.state.data?.status ?? "draft")),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });
  const historyQuery = useQuery({
    queryKey: scopedQueryKey(config, "creator-history", creator),
    queryFn: () => fetchJson<CreatorHistoryResponse>(`/api/creator/history?creator=${creator}&limit=20`),
    enabled: Boolean(creator),
    refetchInterval: getLiveRefreshInterval(isLiveBillStatus(billQuery.data?.status ?? "draft")),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });

  const bill = billQuery.data;
  const history = historyQuery.data;
  const disabledReason = getClaimDisabledReason({
    chainMessage: chainConsistency.message,
    chainChecking: chainConsistency.isChecking,
    isConnected: wallet.isConnected,
    isWriteReady: wallet.isWriteReady,
    writeDisabledReason: wallet.writeDisabledReason,
    walletAddress: wallet.address,
    bill,
    isBillLoading: billQuery.isLoading,
    isBillError: billQuery.isError
  });

  function refreshCreatorViewsInBackground(creatorAddress: `0x${string}`) {
    void Promise.allSettled([
      queryClient.refetchQueries({ queryKey: scopedQueryKey(config, "home-current-bill"), type: "active" }),
      queryClient.refetchQueries({ queryKey: scopedQueryKey(config, "creator-current-bill"), type: "active" }),
      queryClient.refetchQueries({ queryKey: scopedQueryKey(config, "claim-current-bill"), type: "active" }),
      queryClient.refetchQueries({ queryKey: scopedQueryKey(config, "creator-history", creatorAddress), type: "active" }),
      queryClient.refetchQueries({ queryKey: scopedQueryKey(config, "creator-history-page", creatorAddress), type: "active" }),
      queryClient.refetchQueries({ queryKey: scopedQueryKey(config, "creator-ledger", creatorAddress), type: "active" }),
      queryClient.refetchQueries({ queryKey: scopedQueryKey(config, "home-current-batch"), type: "active" }),
      queryClient.refetchQueries({ queryKey: scopedQueryKey(config, "platform-current-batch"), type: "active" })
    ]);
  }

  async function handleClaim() {
    await runDialogAction({
      confirm: {
        title: "确认领取收益",
        description: "确认后会发起链上领取，并同步完成本月结算。",
        details: bill
          ? `账单：${bill.billId}\n批次：${bill.monthLabel}\n到账：${bill.creatorNetAmountDisplay} ${bill.assetSymbol}`
          : undefined,
        confirmLabel: "确认领取"
      },
      progress: {
        title: "正在处理领取",
        description: "正在等待链上确认。"
      },
      success: (result) => ({
        title: "领取成功",
        description: "收益已到账，分账结果会同步展示。",
        details: `交易：${result.hash}\n区块：${result.blockNumber.toString()}`
      }),
      error: (error) => ({
        title: "领取失败",
        description: "请稍后再试。",
        details: getFriendlyErrorMessage(error, "claim")
      }),
      run: async () => {
        if (!bill) {
          throw new Error("账单未就绪。");
        }

        setCompletedClaim(null);
        setIsSyncingResult(true);

        try {
          const payload = await fetchJson<CreatorClaimPackageResponse>("/api/creator/claim-package");
          const hash = await claimFlow.submitClaim(payload);
          const receipt = await claimFlow.waitForReceipt(hash);
          const creatorAddress = bill.creatorAddress;

          applyOptimisticClaimUpdates(queryClient, {
            config,
            creator: creatorAddress,
            bill,
            txHash: hash,
            blockNumber: receipt.blockNumber
          });

          const result = {
            hash,
            blockNumber: receipt.blockNumber
          };
          setCompletedClaim(result);
          refreshCreatorViewsInBackground(creatorAddress);
          return result;
        } finally {
          setIsSyncingResult(false);
        }
      }
    });
  }

  if (chainConsistency.isChecking || billQuery.isLoading || historyQuery.isLoading) {
    return <LoadingState title="正在读取创作者数据" description="请稍候。" />;
  }

  if (billQuery.isError || historyQuery.isError || !bill || !history) {
    return <ErrorState title="读取失败" description="请刷新重试。" />;
  }

  const statusMeta = getBillStatusMeta(bill.status);
  const workflow = getCurrentMonthWorkflowCopy({
    role: "creator",
    batchStatus: undefined,
    billStatus: bill.status
  });
  const buttonBusy = claimFlow.isPending || claimFlow.isConfirming || isSyncingResult;
  const buttonLabel = buttonBusy ? "处理中..." : "确认领取收益";
  const actionHeadline = disabledReason ? "暂时不能领取" : "本月收益可领取";

  return (
    <div className="flex w-full flex-col gap-8">
      <div>
        <h1 className="page-title">创作者工作台</h1>
      </div>

      {wallet.wrongChain ? (
        <ChainGuardNotice expectedChainId={config.chainId} onSwitch={wallet.switchToExpectedChain} switching={wallet.isSwitching} />
      ) : null}

      {!chainConsistency.isConsistent && chainConsistency.message ? (
        <InfoNotice title="链状态异常" description={chainConsistency.message} tone="warning" />
      ) : null}

      {completedClaim ? (
        <InfoNotice
          title="领取成功"
          description={`交易 ${shortenAddress(completedClaim.hash)} 已确认，本月收益已经到账。区块 ${completedClaim.blockNumber.toString()}`}
          tone="success"
        />
      ) : null}

      {claimFlow.actionError && !completedClaim ? (
        <InfoNotice title="领取失败" description={claimFlow.actionError} tone="warning" />
      ) : null}

      <CurrentMonthWorkflowPanel
        eyebrow="创作者当前月任务"
        monthLabel={bill.monthLabel}
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
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-brand-pink">当前操作</div>
            <div className="mt-3 text-2xl font-black tracking-tight text-text-ink">{actionHeadline}</div>
            <p className="mt-2 text-sm leading-6 text-text-muted">{disabledReason ?? "当前条件已满足，可以提交领取。"}</p>
            <div className="mt-4">
              <Button
                size="lg"
                className="w-full"
                disabled={Boolean(disabledReason) || buttonBusy}
                onClick={() => void handleClaim()}
              >
                {buttonLabel}
              </Button>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/creator/history">
                <Button variant="outline">历史记录</Button>
              </Link>
              <Link href="/ledger">
                <Button variant="outline">流水明细</Button>
              </Link>
            </div>
          </div>
        }
        summary={
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AmountCard title="当前批次" value={bill.monthLabel} badge={statusMeta.label} hint="当前月状态决定领取是否开放。" />
            <AmountCard title="结算总额" value={formatAssetDisplay(bill.grossAmountDisplay, bill.assetSymbol)} hint="本月用于结算的收益总额。" />
            <AmountCard title="创作者到账" value={formatAssetDisplay(bill.creatorNetAmountDisplay, bill.assetSymbol)} hint="领取成功后进入创作者钱包。" />
            <AmountCard title="累计到账" value={formatAssetDisplay(history.summary.totalClaimedDisplay)} hint="历史已领取收益总额。" />
          </div>
        }
      />

      {bill.meta ? <ReadModelMetaNotice meta={bill.meta} /> : history.meta ? <ReadModelMetaNotice meta={history.meta} /> : null}

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <SectionCard title="当前月账单明细" headerAction={<StatusBadge label={statusMeta.label} tone={statusMeta.tone} />}>
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[1.75rem] bg-bg-soft-pink/40 p-6">
                <div className="text-xs font-black uppercase tracking-[0.24em] text-brand-pink">本月到账</div>
                <div className="mt-3 text-4xl font-black text-text-ink">
                  {formatAssetDisplay(bill.creatorNetAmountDisplay, bill.assetSymbol)}
                </div>
                <p className="mt-3 text-sm leading-6 text-text-muted">
                  领取成功后会进入你的钱包，协作者分账会同步完成。
                </p>
              </div>
              <div className="grid gap-3">
                <div className="rounded-[1.5rem] border border-line-soft p-4">
                  <div className="text-xs uppercase tracking-[0.24em] text-text-muted">账单</div>
                  <div className="mt-2 text-lg font-semibold text-text-ink">{bill.billId}</div>
                </div>
                <div className="rounded-[1.5rem] border border-line-soft p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-text-ink">
                    <Wallet2 className="h-4 w-4 text-brand-pink" />
                    当前钱包
                  </div>
                  <div className="mt-2 break-all text-xs text-text-muted">{wallet.address ?? creator}</div>
                </div>
                <div className="rounded-[1.5rem] border border-line-soft p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-text-ink">
                    <ReceiptText className="h-4 w-4 text-brand-pink" />
                    账单归属
                  </div>
                  <div className="mt-2 break-all text-xs text-text-muted">{bill.creatorAddress}</div>
                </div>
              </div>
            </div>

            {bill.breakdown.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {bill.breakdown.map((item) => (
                  <div key={item.label} className="rounded-[1.5rem] border border-line-soft bg-bg-soft-pink/35 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-pink">{item.label}</div>
                    <div className="mt-2 text-2xl font-black text-text-ink">{formatAssetDisplay(item.amountDisplay, bill.assetSymbol)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="暂无账单明细" description="请稍后刷新。" />
            )}
          </div>
        </SectionCard>

        <SectionCard title="领取后结果预览">
          {bill.splitRuleSnapshot.length ? (
            <div className="space-y-3">
              {bill.splitRuleSnapshot.map((item) => (
                <div key={`${item.label}-${item.recipient}`} className="flex items-start justify-between gap-4 rounded-[1.5rem] border border-line-soft p-4">
                  <div className="flex items-start gap-3">
                    <Users className="mt-0.5 h-4 w-4 text-brand-pink" />
                    <div>
                      <div className="font-semibold text-text-ink">{item.label}</div>
                      <div className="text-xs text-text-muted">{item.recipient}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-text-ink">{formatAssetDisplay(item.amountDisplay, bill.assetSymbol)}</div>
                    <div className="text-xs text-text-muted">{item.bps / 100}%</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="暂无结果预览" description="请稍后刷新。" />
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="最近记录"
        description="展示最近 3 条已完成领取，完整记录可进入历史或流水。"
        headerAction={
          <Link href="/creator/history" className="text-sm font-semibold text-brand-pink">
            查看全部
          </Link>
        }
      >
        {history.records.length ? (
          <div className="space-y-3">
            {history.records.slice(0, 3).map((record) => (
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
            <Link href="/creator/history" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-pink">
              查看全部 <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <EmptyState title="暂无记录" description="完成领取后会显示在这里。" />
        )}
      </SectionCard>
    </div>
  );
}
