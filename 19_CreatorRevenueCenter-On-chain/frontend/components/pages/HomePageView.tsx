"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Coins, LayoutDashboard, ShieldCheck } from "lucide-react";
import { HomeHeader } from "@/components/layout/HomeHeader";
import { AmountCard } from "@/components/ui/AmountCard";
import { Button } from "@/components/ui/Button";
import { CurrentMonthWorkflowPanel } from "@/components/ui/CurrentMonthWorkflowPanel";
import { RoleEntryCard } from "@/components/ui/RoleEntryCard";
import { ReadModelMetaNotice } from "@/components/ui/ReadModelMetaNotice";
import { ErrorState, InfoNotice, LoadingState } from "@/components/ui/StatePanels";
import { getCurrentMonthWorkflowCopy } from "@/lib/current-month-workflow";
import { formatAssetDisplay } from "@/lib/format";
import { fetchJson } from "@/lib/fetch-json";
import { scopedQueryKey } from "@/lib/query-keys";
import { getLiveRefreshInterval, isActiveBatchStatus, isLiveBillStatus } from "@/lib/read-model-meta";
import { getRoleEntryActionReason } from "@/lib/roles";
import { useChainConsistency } from "@/hooks/useChainConsistency";
import { useRoleIdentity } from "@/hooks/useRoleIdentity";
import { useRuntimeConfig } from "@/hooks/useRuntimeConfig";
import { useWalletStatus } from "@/hooks/useWalletStatus";
import { shortenAddress } from "@/lib/utils";
import type { CreatorSettlementBillResponse, RevenueBatchSummaryResponse } from "@/types/domain";

function getPrimaryAction(args: {
  isConnected: boolean;
  isWriteReady: boolean;
  isSwitching: boolean;
  wrongChain: boolean;
  role: ReturnType<typeof useRoleIdentity>["role"];
  isRecognized: boolean;
  defaultHref: string;
  connectWallet: (connectorId?: string) => Promise<void>;
  switchToExpectedChain: () => Promise<void>;
  reconnectWallet: () => Promise<void>;
}) {
  const {
    isConnected,
    isWriteReady,
    isSwitching,
    wrongChain,
    role,
    isRecognized,
    defaultHref,
    connectWallet,
    switchToExpectedChain,
    reconnectWallet
  } = args;

  if (!isConnected) {
    return (
      <Button size="lg" className="w-full" onClick={() => void connectWallet()}>
        连接钱包
      </Button>
    );
  }

  if (wrongChain) {
    return (
      <Button size="lg" className="w-full" onClick={() => void switchToExpectedChain()} disabled={isSwitching}>
        {isSwitching ? "切换中..." : "切换网络"}
      </Button>
    );
  }

  if ((role === "platform" || role === "creator") && !isWriteReady) {
    return (
      <Button size="lg" className="w-full" onClick={() => void reconnectWallet()}>
        准备可写钱包
      </Button>
    );
  }

  if (isRecognized) {
    return (
      <Link href={defaultHref} className="block w-full">
        <Button size="lg" className="w-full">
          进入{role === "platform" ? "平台" : role === "creator" ? "创作者" : "协作者"}
        </Button>
      </Link>
    );
  }

  return null;
}

export function HomePageView({
  initialBatch,
  initialBill
}: {
  initialBatch: RevenueBatchSummaryResponse;
  initialBill: CreatorSettlementBillResponse;
}) {
  const config = useRuntimeConfig();
  const wallet = useWalletStatus(config.chainId);
  const roleIdentity = useRoleIdentity(wallet.address);
  const chainConsistency = useChainConsistency({ config });

  const billQuery = useQuery({
    queryKey: scopedQueryKey(config, "home-current-bill"),
    queryFn: () => fetchJson<CreatorSettlementBillResponse>("/api/creator/bill/current"),
    initialData: initialBill,
    refetchInterval: (query) => getLiveRefreshInterval(isLiveBillStatus(query.state.data?.status ?? "draft")),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });
  const batchQuery = useQuery({
    queryKey: scopedQueryKey(config, "home-current-batch"),
    queryFn: () => fetchJson<RevenueBatchSummaryResponse>("/api/platform/batches/current"),
    initialData: initialBatch,
    refetchInterval: (query) => getLiveRefreshInterval(isActiveBatchStatus(query.state.data?.status ?? "draft")),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });

  const creatorDisabledReason = getRoleEntryActionReason({
    isHydrated: wallet.isHydrated,
    isConnected: wallet.isConnected,
    currentRole: roleIdentity.role,
    currentRoleLabel: roleIdentity.label,
    expectedRole: "creator",
    isRecognized: roleIdentity.isRecognized
  });
  const platformDisabledReason = getRoleEntryActionReason({
    isHydrated: wallet.isHydrated,
    isConnected: wallet.isConnected,
    currentRole: roleIdentity.role,
    currentRoleLabel: roleIdentity.label,
    expectedRole: "platform",
    isRecognized: roleIdentity.isRecognized
  });
  const collaboratorDisabledReason = getRoleEntryActionReason({
    isHydrated: wallet.isHydrated,
    isConnected: wallet.isConnected,
    currentRole: roleIdentity.role,
    currentRoleLabel: roleIdentity.label,
    expectedRole: "collaborator",
    isRecognized: roleIdentity.isRecognized
  });

  const workflow = getCurrentMonthWorkflowCopy({
    role: "home",
    batchStatus: batchQuery.data?.status,
    billStatus: billQuery.data?.status
  });
  const primaryAction = getPrimaryAction({
    isConnected: wallet.isConnected,
    isWriteReady: wallet.isWriteReady,
    isSwitching: wallet.isSwitching,
    wrongChain: wallet.wrongChain,
    role: roleIdentity.role,
    isRecognized: roleIdentity.isRecognized,
    defaultHref: roleIdentity.defaultHref,
    connectWallet: wallet.connectWallet,
    switchToExpectedChain: wallet.switchToExpectedChain,
    reconnectWallet: () => wallet.connectWallet(wallet.connectorId ?? undefined)
  });
  const quickEntrySummary = !wallet.isConnected
    ? "连接钱包后会自动识别你的角色，并带你进入对应工作台。"
    : !roleIdentity.isRecognized
      ? "当前钱包未分配项目角色，请切换到平台、创作者或协作者钱包。"
      : roleIdentity.role === "collaborator"
        ? `已识别为${roleIdentity.label}，可查看当前月进度和到账结果。`
        : `已识别为${roleIdentity.label}，可进入工作台处理当前月份任务。`;

  return (
    <>
      <HomeHeader />
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-8 md:px-6 lg:px-8">
        {!billQuery.data || !batchQuery.data ? (
          <LoadingState title="正在读取当前月份流程" description="请稍候。" />
        ) : billQuery.isError || batchQuery.isError ? (
          <ErrorState title="流程预览读取失败" description="请刷新重试。" />
        ) : (
          <CurrentMonthWorkflowPanel
            eyebrow="当前月份流程"
            monthLabel={batchQuery.data.monthLabel ?? config.activeBatchLabel}
            statusLabel={workflow.statusLabel}
            statusTone={workflow.statusTone}
            title={workflow.title}
            description={workflow.description}
            steps={workflow.steps}
            nextStep={workflow.nextStep}
            expectedResult={workflow.expectedResult}
            blockingReason={workflow.blockingReason}
            action={
              <div className="rounded-[1.6rem] border border-line-soft bg-white/80 p-5 shadow-[0_14px_32px_rgba(251,114,153,0.06)]">
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-brand-pink">快速进入</div>
                <div className="mt-3 text-xl font-black tracking-tight text-text-ink">
                  {wallet.isConnected ? shortenAddress(wallet.address) : "未连接钱包"}
                </div>
                <p className="mt-2 text-sm leading-6 text-text-muted">{quickEntrySummary}</p>
                {primaryAction ? <div className="mt-4">{primaryAction}</div> : null}
              </div>
            }
            summary={
              <div className="grid gap-4 md:grid-cols-3">
                <AmountCard
                  title="结算总额"
                  value={formatAssetDisplay(billQuery.data.grossAmountDisplay, billQuery.data.assetSymbol)}
                  hint="平台激活时锁定的本月收益总额。"
                />
                <AmountCard
                  title="创作者净额"
                  value={formatAssetDisplay(billQuery.data.creatorNetAmountDisplay, billQuery.data.assetSymbol)}
                  hint="创作者确认领取后的到账金额。"
                />
                <AmountCard
                  title="当前批次"
                  value={batchQuery.data.monthLabel ?? config.activeBatchLabel}
                  hint="三方围绕这个月份推进同一条流程。"
                />
              </div>
            }
          />
        )}

        {!chainConsistency.isConsistent && chainConsistency.message ? (
          <InfoNotice title="链状态异常" description={chainConsistency.message} tone="warning" />
        ) : null}

        {wallet.isConnected && !roleIdentity.isRecognized ? (
          <InfoNotice title="钱包未分配角色" description="请切换到平台、创作者或协作者钱包后再进入工作台。" tone="warning" />
        ) : null}

        {batchQuery.data?.meta ? (
          <ReadModelMetaNotice meta={batchQuery.data.meta} />
        ) : billQuery.data?.meta ? (
          <ReadModelMetaNotice meta={billQuery.data.meta} />
        ) : null}

        <section className="grid gap-6 md:grid-cols-3">
          <RoleEntryCard
            title="平台"
            description="激活当月收益，管理暂停、恢复和关闭。"
            href="/platform"
            actionLabel="进入平台"
            icon={ShieldCheck}
            iconTone="bg-bg-soft-pink text-brand-pink"
            disabled={platformDisabledReason != null}
            disabledReason={platformDisabledReason}
            helperText="本月从平台激活开始。"
            badgeLabel={roleIdentity.role === "platform" ? "当前钱包" : "平台角色"}
            badgeTone={roleIdentity.role === "platform" ? "success" : "neutral"}
          />
          <RoleEntryCard
            title="创作者"
            description="确认本月状态，并在可领取时完成领取。"
            href="/creator"
            actionLabel="进入创作者"
            icon={LayoutDashboard}
            iconTone="bg-bg-soft-pink text-brand-pink"
            disabled={creatorDisabledReason != null}
            disabledReason={creatorDisabledReason}
            helperText="领取会同步触发协作者分账。"
            badgeLabel={roleIdentity.role === "creator" ? "当前钱包" : "创作者角色"}
            badgeTone={roleIdentity.role === "creator" ? "success" : "neutral"}
          />
          <RoleEntryCard
            title="协作者"
            description="查看当前月进度，确认分账是否到账。"
            href="/collaborator"
            actionLabel="进入协作者"
            icon={Coins}
            iconTone="bg-bg-soft-pink text-brand-pink"
            disabled={collaboratorDisabledReason != null}
            disabledReason={collaboratorDisabledReason}
            helperText="无需手动操作，关注流程进度即可。"
            badgeLabel={roleIdentity.role === "collaborator" ? "当前钱包" : "协作者角色"}
            badgeTone={roleIdentity.role === "collaborator" ? "success" : "neutral"}
          />
        </section>
      </div>
    </>
  );
}
