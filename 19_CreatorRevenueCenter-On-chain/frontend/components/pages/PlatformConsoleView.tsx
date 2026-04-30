"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PauseCircle, PlayCircle, RefreshCcw, StopCircle } from "lucide-react";
import { AmountCard } from "@/components/ui/AmountCard";
import { Button } from "@/components/ui/Button";
import { ChainGuardNotice } from "@/components/ui/ChainGuardNotice";
import { CurrentMonthWorkflowPanel } from "@/components/ui/CurrentMonthWorkflowPanel";
import { ReadModelMetaNotice } from "@/components/ui/ReadModelMetaNotice";
import { EmptyState, ErrorState, InfoNotice, LoadingState } from "@/components/ui/StatePanels";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getCurrentMonthWorkflowCopy } from "@/lib/current-month-workflow";
import { formatAssetDisplay } from "@/lib/format";
import { fetchJson } from "@/lib/fetch-json";
import { getFriendlyErrorMessage } from "@/lib/friendly-errors";
import { scopedQueryKey } from "@/lib/query-keys";
import { getLiveRefreshInterval, isActiveBatchStatus, isLiveBillStatus } from "@/lib/read-model-meta";
import { applyOptimisticBatchStatusUpdate } from "@/lib/query-cache-updates";
import { getBillStatusMeta, getPlatformBatchStatusMeta } from "@/lib/settlement-status";
import { formatDateTime } from "@/lib/utils";
import { useChainConsistency } from "@/hooks/useChainConsistency";
import { useDialogAction } from "@/hooks/useDialogAction";
import { usePlatformBatchActions } from "@/hooks/usePlatformBatchActions";
import { usePlatformRecentAction } from "@/hooks/usePlatformRecentAction";
import { useRuntimeConfig } from "@/hooks/useRuntimeConfig";
import { useWalletStatus } from "@/hooks/useWalletStatus";
import type {
  CreatorSettlementBillResponse,
  PlatformActivationPreviewResponse,
  PlatformMonthlyConfig,
  PlatformMonthlyConfigsResponse,
  RevenueBatchSummaryResponse
} from "@/types/domain";

type BatchAction = "resume" | "pause" | "close";

function getBatchActionLabel(action: BatchAction) {
  if (action === "resume") return "恢复批次";
  if (action === "pause") return "暂停批次";
  return "关闭批次";
}

function getActionState(status: RevenueBatchSummaryResponse["status"]) {
  if (status === "published") {
    return {
      primary: { action: "pause" as const, label: "暂停批次" },
      secondary: { action: "close" as const, label: "关闭批次" }
    };
  }

  if (status === "paused") {
    return {
      primary: { action: "resume" as const, label: "恢复批次" },
      secondary: { action: "close" as const, label: "关闭批次" }
    };
  }

  return { primary: null, secondary: null };
}

function getPlatformActionDisabledReason(args: {
  chainMessage: string | null;
  chainChecking: boolean;
  isConnected: boolean;
  wrongChain: boolean;
  hasWalletClient: boolean;
  batch: RevenueBatchSummaryResponse | undefined;
  isBatchLoading: boolean;
  isBatchError: boolean;
  isActionBusy: boolean;
}) {
  const { chainMessage, chainChecking, isConnected, wrongChain, hasWalletClient, batch, isBatchLoading, isBatchError, isActionBusy } = args;

  if (chainChecking) {
    return "链状态校验中。";
  }

  if (chainMessage) {
    return chainMessage;
  }

  if (!isConnected) {
    return "请先连接钱包。";
  }

  if (wrongChain) {
    return "请先切换网络。";
  }

  if (!hasWalletClient) {
    return "当前钱包不可写。";
  }

  if (isBatchLoading) {
    return "批次读取中。";
  }

  if (isBatchError || !batch) {
    return "批次读取失败。";
  }

  if (isActionBusy) {
    return "交易处理中。";
  }

  if (batch.status === "closed") {
    return "当前批次已关闭，无需继续操作。";
  }

  if (batch.status === "draft") {
    return "请先完成本月保存并激活。";
  }

  return null;
}

function getNextMonthLabel(monthLabel: string) {
  const [rawYear, rawMonth] = monthLabel.split("-");
  const year = Number(rawYear);
  const month = Number(rawMonth);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return monthLabel;
  }

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

function getSuggestedMonth(configs: PlatformMonthlyConfig[] | undefined, minAllowedMonth: string, currentInput: string) {
  if (currentInput.trim().length > 0) {
    return currentInput;
  }

  const currentMonthLocked = configs?.some((entry) => entry.monthLabel === minAllowedMonth && entry.isLocked);
  return currentMonthLocked ? getNextMonthLabel(minAllowedMonth) : minAllowedMonth;
}

function getPlatformTaskSummary(phase: ReturnType<typeof getCurrentMonthWorkflowCopy>["phase"]) {
  if (phase === "activate") {
    return "请先激活本月收益。";
  }

  if (phase === "claim") {
    return "本月已就绪，等待创作者领取。";
  }

  if (phase === "settled") {
    return "本月已完成，进入复核归档。";
  }

  if (phase === "paused") {
    return "批次已暂停，请选择恢复或关闭。";
  }

  return "本月已关闭，可准备后续月份。";
}

export function PlatformConsoleView() {
  const router = useRouter();
  const config = useRuntimeConfig();
  const wallet = useWalletStatus(config.chainId);
  const chainConsistency = useChainConsistency({ config, enabled: wallet.isHydrated });
  const actions = usePlatformBatchActions(config);
  const runDialogAction = useDialogAction();
  const queryClient = useQueryClient();
  const { rememberAction } = usePlatformRecentAction(config.deploymentId);

  const [monthLabelInput, setMonthLabelInput] = useState("");
  const [grossAmountEthInput, setGrossAmountEthInput] = useState("");
  const [isActivatingBatch, setIsActivatingBatch] = useState(false);
  const [monthlyConfigError, setMonthlyConfigError] = useState<string | null>(null);
  const [monthlyConfigSuccess, setMonthlyConfigSuccess] = useState<string | null>(null);
  const [hasInitializedMonthlyForm, setHasInitializedMonthlyForm] = useState(false);

  const batchQuery = useQuery({
    queryKey: scopedQueryKey(config, "platform-current-batch"),
    queryFn: () => fetchJson<RevenueBatchSummaryResponse>("/api/platform/batches/current"),
    refetchInterval: (query) => getLiveRefreshInterval(isActiveBatchStatus(query.state.data?.status ?? "draft")),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });

  const currentBillQuery = useQuery({
    queryKey: scopedQueryKey(config, "platform-current-bill"),
    queryFn: () => fetchJson<CreatorSettlementBillResponse>("/api/creator/bill/current"),
    refetchInterval: (query) => getLiveRefreshInterval(isLiveBillStatus(query.state.data?.status ?? "draft")),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });

  const monthlyConfigsQuery = useQuery({
    queryKey: scopedQueryKey(config, "platform-monthly-configs"),
    queryFn: () => fetchJson<PlatformMonthlyConfigsResponse>("/api/platform/monthly-configs")
  });

  useEffect(() => {
    if (hasInitializedMonthlyForm) return;
    const minAllowedMonth = monthlyConfigsQuery.data?.minAllowedMonth ?? config.activeBatchLabel;
    const suggestedMonth = getSuggestedMonth(monthlyConfigsQuery.data?.configs, minAllowedMonth, "");

    setMonthLabelInput(suggestedMonth);
    setHasInitializedMonthlyForm(true);
  }, [monthlyConfigsQuery.data, config.activeBatchLabel, hasInitializedMonthlyForm]);

  const selectedMonthConfig = useMemo(
    () => monthlyConfigsQuery.data?.configs.find((entry) => entry.monthLabel === monthLabelInput) ?? null,
    [monthlyConfigsQuery.data, monthLabelInput]
  );

  const activationDisabledReason = (() => {
    if (chainConsistency.isChecking) return "链状态校验中。";
    if (chainConsistency.message) return chainConsistency.message;
    if (!wallet.isConnected) return "请先连接钱包。";
    if (wallet.wrongChain) return "请先切换网络。";
    if (!wallet.hasWalletClient) return "当前钱包不可写。";
    if (actions.isPending || actions.isConfirming || isActivatingBatch) return "交易处理中。";
    if (!monthlyConfigsQuery.data) return "月度配置读取中。";

    if (!monthLabelInput.trim()) {
      return "请选择月份。";
    }

    if (selectedMonthConfig?.isLocked) {
      return `月份 ${selectedMonthConfig.monthLabel} 已锁定，不能再次设置。`;
    }

    if (!grossAmountEthInput.trim()) {
      return "请输入结算总额。";
    }

    return null;
  })();

  async function refetchPlatformQueries() {
    await Promise.all([
      queryClient.refetchQueries({ queryKey: scopedQueryKey(config, "platform-monthly-configs"), type: "active" }),
      queryClient.refetchQueries({ queryKey: scopedQueryKey(config, "platform-current-batch"), type: "active" }),
      queryClient.refetchQueries({ queryKey: scopedQueryKey(config, "platform-current-bill"), type: "active" }),
      queryClient.refetchQueries({ queryKey: scopedQueryKey(config, "platform-activity"), type: "active" }),
      queryClient.refetchQueries({ queryKey: scopedQueryKey(config, "platform-history"), type: "active" }),
      queryClient.refetchQueries({ queryKey: scopedQueryKey(config, "home-current-batch"), type: "active" }),
      queryClient.refetchQueries({ queryKey: scopedQueryKey(config, "home-current-bill"), type: "active" }),
      queryClient.refetchQueries({ queryKey: scopedQueryKey(config, "creator-current-bill"), type: "active" }),
      queryClient.refetchQueries({ queryKey: scopedQueryKey(config, "claim-current-bill"), type: "active" })
    ]);
  }

  async function handleActivateBatch() {
    setMonthlyConfigError(null);
    setMonthlyConfigSuccess(null);

    let preview: PlatformActivationPreviewResponse;
    try {
      preview = await fetchJson<PlatformActivationPreviewResponse>("/api/platform/monthly-configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthLabel: monthLabelInput,
          grossAmountEth: grossAmountEthInput
        })
      });
    } catch (error) {
      if (error instanceof Error && error.message.trim().length > 0) {
        setMonthlyConfigError(error.message.trim());
      } else {
        setMonthlyConfigError(getFriendlyErrorMessage(error, "generic"));
      }
      return;
    }

    await runDialogAction({
      confirm: {
        title: "确认保存并激活",
        description: "这会在一笔交易里完成当前月份发布和等额资金上链；激活后该月份会锁定，不能再次修改。",
        details: `月份：${preview.monthLabel}\n账单：${preview.billId}\n总额：${formatAssetDisplay(preview.grossAmountDisplay, "ETH")}`,
        confirmLabel: "确认激活"
      },
      progress: {
        title: "正在提交激活交易",
        description: "正在等待链上确认。"
      },
      success: (result) => ({
        title: "激活成功",
        description: "月份已锁定，本月流程已经开启。",
        details: `月份：${result.monthLabel}\n交易：${result.hash}\n区块：${result.blockNumber.toString()}`
      }),
      error: (error) => {
        const message = getFriendlyErrorMessage(error, "batch-publish");
        setMonthlyConfigError(message);
        return {
          title: "激活失败",
          description: "请稍后再试。",
          details: message
        };
      },
      run: async () => {
        setIsActivatingBatch(true);

        try {
          const hash = await actions.submitBatchActivation(preview);
          const receipt = await actions.waitForReceipt(hash);

          await fetchJson("/api/platform/monthly-configs/commit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              monthLabel: monthLabelInput,
              grossAmountEth: grossAmountEthInput
            })
          });

          await refetchPlatformQueries();
          router.refresh();
          setMonthlyConfigSuccess(`已激活 ${preview.monthLabel}，资金已完成上链。`);

          const nextSuggestedMonth = getSuggestedMonth(monthlyConfigsQuery.data?.configs, preview.minAllowedMonth, "");
          setMonthLabelInput(nextSuggestedMonth === preview.monthLabel ? getNextMonthLabel(preview.monthLabel) : nextSuggestedMonth);
          setGrossAmountEthInput("");

          return {
            hash,
            blockNumber: receipt.blockNumber,
            monthLabel: preview.monthLabel
          };
        } finally {
          setIsActivatingBatch(false);
        }
      }
    });
  }

  async function handleAction(action: BatchAction) {
    const currentBatch = batchQuery.data;
    if (!currentBatch) return;

    await runDialogAction({
      confirm:
        action === "resume"
          ? {
              title: "确认恢复批次",
              description: "恢复后创作者可以继续领取当前月份。",
              confirmLabel: "确认恢复"
            }
          : action === "pause"
            ? {
                title: "确认暂停批次",
                description: "暂停后当前月份会暂时停止领取。",
                confirmLabel: "确认暂停"
              }
            : {
                title: "确认关闭批次",
                description: "关闭后当前月份会进入只读状态。",
                confirmLabel: "确认关闭"
              },
      progress: {
        title: "正在提交批次操作",
        description: "正在等待链上确认。"
      },
      success: (result) => ({
        title: "执行成功",
        description:
          result.action === "resume"
            ? "当前批次已恢复，创作者可以继续领取。"
            : result.action === "pause"
              ? "当前批次已暂停，领取流程已临时冻结。"
              : "当前批次已关闭，本月进入只读状态。",
        details: `动作：${getBatchActionLabel(result.action)}\n交易：${result.hash}\n区块：${result.blockNumber.toString()}`
      }),
      error: (error) => ({
        title: "执行失败",
        description: "请稍后再试。",
        details: getFriendlyErrorMessage(error, action === "resume" ? "batch-publish" : action === "pause" ? "batch-pause" : "batch-close")
      }),
      run: async () => {
        const hash = await actions.submitBatchAction(action, { batchIdHex: currentBatch.batchIdHex });
        const receipt = await actions.waitForReceipt(hash);
        const nextStatus = action === "resume" ? "published" : action === "pause" ? "paused" : "closed";

        applyOptimisticBatchStatusUpdate(queryClient, config, nextStatus);
        await refetchPlatformQueries();

        const result = {
          action,
          hash,
          blockNumber: receipt.blockNumber
        };
        rememberAction(result);
        return result;
      }
    });
  }

  if (chainConsistency.isChecking || batchQuery.isLoading || currentBillQuery.isLoading) {
    return <LoadingState title="正在读取平台数据" description="请稍候。" />;
  }

  if (batchQuery.isError || currentBillQuery.isError || !batchQuery.data || !currentBillQuery.data) {
    return <ErrorState title="读取失败" description="请刷新重试。" />;
  }

  const batch = batchQuery.data;
  const currentBill = currentBillQuery.data;
  const statusMeta = getPlatformBatchStatusMeta(batch.status);
  const creatorStatusMeta = getBillStatusMeta(currentBill.status);
  const workflow = getCurrentMonthWorkflowCopy({
    role: "platform",
    batchStatus: batch.status,
    billStatus: currentBill.status
  });
  const actionState = getActionState(batch.status);
  const actionDisabledReason = getPlatformActionDisabledReason({
    chainMessage: chainConsistency.message,
    chainChecking: chainConsistency.isChecking,
    isConnected: wallet.isConnected,
    wrongChain: wallet.wrongChain,
    hasWalletClient: wallet.hasWalletClient,
    batch,
    isBatchLoading: batchQuery.isLoading,
    isBatchError: batchQuery.isError,
    isActionBusy: actions.isPending || actions.isConfirming
  });

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="page-title">平台工作台</h1>
        <Button
          variant="ghost"
          onClick={() =>
            void Promise.all([
              batchQuery.refetch(),
              currentBillQuery.refetch(),
              monthlyConfigsQuery.refetch()
            ])
          }
        >
          <RefreshCcw className="mr-2 h-4 w-4" />
          刷新
        </Button>
      </div>

      {wallet.wrongChain ? (
        <ChainGuardNotice expectedChainId={config.chainId} onSwitch={wallet.switchToExpectedChain} switching={wallet.isSwitching} />
      ) : null}

      {!chainConsistency.isConsistent && chainConsistency.message ? (
        <InfoNotice title="链状态异常" description={chainConsistency.message} tone="warning" />
      ) : null}

      {monthlyConfigError ? <InfoNotice title="月份激活失败" description={monthlyConfigError} tone="warning" /> : null}
      {monthlyConfigSuccess ? <InfoNotice title="月份已激活" description={monthlyConfigSuccess} tone="success" /> : null}

      <CurrentMonthWorkflowPanel
        eyebrow="本月流程总览"
        monthLabel={batch.monthLabel}
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
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-brand-pink">当前判断</div>
            <div className="mt-3 text-2xl font-black tracking-tight text-text-ink">{getPlatformTaskSummary(workflow.phase)}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge label={`批次：${statusMeta.label}`} tone={statusMeta.tone} />
              <StatusBadge label={`创作者：${creatorStatusMeta.label}`} tone={creatorStatusMeta.tone} />
            </div>
            <p className="mt-3 text-sm leading-6 text-text-muted">{creatorStatusMeta.description}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/platform/results">
                <Button variant="outline">最近结果</Button>
              </Link>
              <Link href="/platform/history">
                <Button variant="outline">历史记录</Button>
              </Link>
            </div>
          </div>
        }
        summary={
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AmountCard title="当前批次" value={batch.monthLabel} badge={statusMeta.label} hint="三方当前都围绕这个月份推进同一条流程。" />
            <AmountCard title="批次总额" value={formatAssetDisplay(batch.grossAmountDisplay, batch.assetSymbol)} hint="平台激活时锁定的当前月收益总额。" />
            <AmountCard title="创作者数" value={`${batch.creatorCount}`} hint="当前批次里会触发领取的创作者数量。" />
            <AmountCard title="协作者数" value={`${batch.collaboratorCount}`} hint="创作者领取后会自动到账的协作者总人数。" />
          </div>
        }
      />

      {batch.meta ? <ReadModelMetaNotice meta={batch.meta} /> : null}
      {currentBill.meta ? <ReadModelMetaNotice meta={currentBill.meta} /> : null}

      <SectionCard title="月度激活" description="录入月份与收益总额，一次交易完成激活。激活后该月份会锁定。">
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[1.5rem] border border-line-soft p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="platform-month-label" className="text-sm font-semibold text-text-ink">
                  月份
                </label>
                <input
                  id="platform-month-label"
                  type="month"
                  min={monthlyConfigsQuery.data?.minAllowedMonth}
                  value={monthLabelInput}
                  onChange={(event) => {
                    setMonthLabelInput(event.target.value);
                    setMonthlyConfigError(null);
                    setMonthlyConfigSuccess(null);
                  }}
                  className="mt-2 h-11 w-full rounded-[0.9rem] border border-line-soft bg-white px-4 text-sm text-text-ink outline-none transition focus:border-brand-pink"
                />
              </div>
              <div>
                <label htmlFor="platform-gross-amount" className="text-sm font-semibold text-text-ink">
                  创作者结算总额（ETH）
                </label>
                <input
                  id="platform-gross-amount"
                  type="text"
                  inputMode="decimal"
                  value={grossAmountEthInput}
                  onChange={(event) => {
                    setGrossAmountEthInput(event.target.value);
                    setMonthlyConfigError(null);
                    setMonthlyConfigSuccess(null);
                  }}
                  placeholder="例如 80"
                  className="mt-2 h-11 w-full rounded-[0.9rem] border border-line-soft bg-white px-4 text-sm text-text-ink outline-none transition focus:border-brand-pink"
                />
              </div>
            </div>
            <div className="mt-4 space-y-2 text-sm text-text-muted">
              <p>
                可录入月份：<span className="font-semibold text-text-ink">{monthlyConfigsQuery.data?.minAllowedMonth ?? "--"}</span> 及之后。
              </p>
              <p>保存并激活会锁定该月份，并一次性完成资金上链。</p>
              {selectedMonthConfig?.isLocked ? (
                <p className="text-rose-700">月份 {selectedMonthConfig.monthLabel} 已锁定，请选择未来月份。</p>
              ) : null}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-sm text-text-muted">{activationDisabledReason ?? "提交后会触发一笔激活交易。"}</p>
              <Button className="shrink-0" onClick={() => void handleActivateBatch()} disabled={Boolean(activationDisabledReason)}>
                {isActivatingBatch ? "激活中..." : "保存并激活"}
              </Button>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-line-soft p-5">
            <div className="text-sm font-semibold text-text-ink">已配置月份</div>
            {monthlyConfigsQuery.isLoading ? (
              <p className="mt-3 text-sm text-text-muted">正在读取配置...</p>
            ) : monthlyConfigsQuery.isError ? (
              <p className="mt-3 text-sm text-rose-700">配置读取失败，请刷新重试。</p>
            ) : monthlyConfigsQuery.data?.configs.length ? (
              <div className="mt-3 space-y-3">
                {monthlyConfigsQuery.data.configs.map((entry) => (
                  <div key={entry.monthLabel} className="rounded-[1.25rem] border border-line-soft p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-base font-semibold text-text-ink">{entry.monthLabel}</div>
                      <StatusBadge
                        label={entry.isActive ? "当前活动" : entry.isLocked ? "已锁定" : "未锁定"}
                        tone={entry.isActive ? "success" : entry.isLocked ? "warning" : "neutral"}
                      />
                    </div>
                    <div className="mt-2 text-sm text-text-muted">
                      总额：{formatAssetDisplay(entry.grossAmountDisplay)} · 创作者净额：{formatAssetDisplay(entry.creatorNetAmountDisplay)}
                    </div>
                    <div className="mt-1 text-xs text-text-muted">
                      更新时间：{formatDateTime(entry.updatedAt)}
                      {entry.lockedAt ? ` · 锁定时间：${formatDateTime(entry.lockedAt)}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-text-muted">暂无月份配置。</p>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="批次控制" description="用于暂停、恢复或关闭当前批次；不影响已锁定的月份金额。" headerAction={<StatusBadge label={statusMeta.label} tone={statusMeta.tone} />}>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)] xl:items-start">
          <div className="rounded-[1.5rem] border border-line-soft p-5">
            <div className="text-sm font-semibold text-text-ink">当前状态</div>
            <p className="mt-2 text-sm leading-6 text-text-muted">{actionDisabledReason ?? "当前批次可控制，可按需暂停或关闭。"}</p>
          </div>
          {actionState.primary ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Button className="w-full" disabled={Boolean(actionDisabledReason)} onClick={() => void handleAction(actionState.primary.action)}>
                {actionState.primary.action === "resume" ? <PlayCircle className="mr-2 h-4 w-4" /> : <PauseCircle className="mr-2 h-4 w-4" />}
                {actionState.primary.label}
              </Button>
              {actionState.secondary ? (
                <Button variant="outline" className="w-full" disabled={Boolean(actionDisabledReason)} onClick={() => void handleAction(actionState.secondary.action)}>
                  <StopCircle className="mr-2 h-4 w-4" />
                  {actionState.secondary.label}
                </Button>
              ) : null}
            </div>
          ) : batch.status === "draft" ? (
            <EmptyState title="等待激活" description="完成月度激活后，才可以控制批次状态。" />
          ) : (
            <EmptyState title="暂无操作" description="当前批次已关闭，无后续操作。" />
          )}
        </div>
      </SectionCard>
    </div>
  );
}
