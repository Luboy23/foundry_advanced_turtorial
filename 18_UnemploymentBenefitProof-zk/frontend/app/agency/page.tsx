"use client";

import dynamic from "next/dynamic";
import { useState, type ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, PauseCircle, PlayCircle, PlusCircle, RefreshCw } from "lucide-react";
import { parseEther } from "viem";
import { useWalletClient } from "wagmi";
import { RoleAccessStateCard } from "@/components/shared/RoleAccessStateCard";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { StateCard } from "@/components/shared/StateCard";
import { agencyCopy } from "@/lib/copy";
import { useClaimHistoryQuery, useProgramQuery } from "@/hooks/useBenefitQueries";
import { useDialogAction } from "@/hooks/useDialogAction";
import { useVisibilityOnce } from "@/hooks/useVisibilityOnce";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { useWalletActionFeedback } from "@/hooks/useWalletActionFeedback";
import { unemploymentBenefitDistributorAbi } from "@/lib/contracts/abis";
import { getErrorDetails, getFriendlyErrorMessage } from "@/lib/friendly-errors";
import {
  getFundAmountInputError,
  getValidatedFundAmount,
  isFundAmountInputAllowed,
  MAX_PROGRAM_FUND_AMOUNT_ETH,
  MIN_PROGRAM_FUND_AMOUNT_ETH,
  normalizeFundAmountInput
} from "@/lib/funding-amount";
import { queryKeys } from "@/lib/query-keys";
import type { BenefitClaimRecord } from "@/types/domain";
import { formatEth } from "@/lib/utils";

const AgencyClaimHistorySection = dynamic(
  () => import("@/components/agency/AgencyClaimHistorySection").then((mod) => mod.AgencyClaimHistorySection)
);

/**
 * 发放机构工作台。
 *
 * 这里负责管理补助池余额、项目开关和全局领取历史，是链上资金状态与业务运营状态的集中入口。
 */
export default function AgencyPage() {
  const [isFunding, setIsFunding] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [fundAmountInput, setFundAmountInput] = useState(String(MIN_PROGRAM_FUND_AMOUNT_ETH));
  const { config, wallet, publicClient, accessByRole, isConfigured } = useRoleAccess();
  const { data: walletClient } = useWalletClient();
  const { connectWallet, switchToExpectedChain, walletError } = useWalletActionFeedback(wallet);
  const runDialogAction = useDialogAction();
  const queryClient = useQueryClient();
  const { ref: claimHistorySectionRef, isVisible: claimHistoryVisible } = useVisibilityOnce<HTMLElement>();
  const agencyAccess = accessByRole.agency;
  const fundAmountError = getFundAmountInputError(fundAmountInput);

  const programQuery = useProgramQuery({ config, enabled: Boolean(publicClient && isConfigured) });
  const claimHistoryQuery = useClaimHistoryQuery({
    config,
    enabled: Boolean(isConfigured && claimHistoryVisible)
  });

  /** 向补助池补充资金，并在交易完成后刷新项目状态。 */
  async function handleFund() {
    const validatedAmount = getValidatedFundAmount(fundAmountInput);
    if (!wallet.address || !walletClient || !publicClient || isFunding) {
      return;
    }
    if (!validatedAmount.ok) {
      return;
    }

    setFundAmountInput(validatedAmount.normalized);

    await runDialogAction({
      confirm: {
        title: agencyCopy.funding.confirmTitle,
        description: agencyCopy.funding.confirmDescription(validatedAmount.normalized),
        details: agencyCopy.funding.confirmDetails(validatedAmount.normalized, wallet.address)
      },
      progress: {
        title: agencyCopy.funding.progressTitle,
        description: agencyCopy.funding.progressDescription
      },
      success: (hash) => ({
        title: agencyCopy.funding.successTitle,
        description: agencyCopy.funding.successDescription,
        details: agencyCopy.funding.successDetails(hash)
      }),
      error: (error) => ({
        title: agencyCopy.funding.errorTitle,
        description: agencyCopy.funding.errorDescription,
        details: getErrorDetails(error, `${agencyCopy.funding.errorTitle}。`)
      }),
      run: async () => {
        setIsFunding(true);
        try {
          const hash = await walletClient.writeContract({
            account: wallet.address,
            abi: unemploymentBenefitDistributorAbi,
            address: config.benefitDistributorAddress,
            functionName: "fundProgram",
            value: parseEther(validatedAmount.normalized)
          });

          await publicClient.waitForTransactionReceipt({ hash });
          await queryClient.invalidateQueries({ queryKey: queryKeys.program(config) });
          return hash;
        } finally {
          setIsFunding(false);
        }
      }
    });
  }

  /** 限制输入过程中的字符，避免用户刚输入小数点时就被最终校验拦掉。 */
  function handleFundAmountChange(event: ChangeEvent<HTMLInputElement>) {
    const nextValue = event.target.value.replace(/\s+/g, "");
    if (!isFundAmountInputAllowed(nextValue)) {
      return;
    }
    setFundAmountInput(nextValue);
  }

  /** 输入框失焦时再做最终标准化。 */
  function handleFundAmountBlur() {
    setFundAmountInput((currentValue) => normalizeFundAmountInput(currentValue));
  }

  /** 切换项目发放状态。 */
  async function handleToggle() {
    const program = programQuery.data;
    if (!wallet.address || !walletClient || !publicClient || !program || isToggling) {
      return;
    }

    const nextActive = !program.active;

    await runDialogAction({
      confirm: {
        title: agencyCopy.distribution.confirmTitle(nextActive),
        description: agencyCopy.distribution.confirmDescription(nextActive),
        details: agencyCopy.distribution.confirmDetails(program.active, nextActive)
      },
      progress: {
        title: agencyCopy.distribution.progressTitle(nextActive),
        description: agencyCopy.distribution.progressDescription
      },
      success: (hash) => ({
        title: agencyCopy.distribution.successTitle(nextActive),
        description: agencyCopy.distribution.successDescription(nextActive),
        details: agencyCopy.distribution.successDetails(hash)
      }),
      error: (error) => ({
        title: agencyCopy.distribution.errorTitle(nextActive),
        description: agencyCopy.distribution.errorDescription,
        details: getErrorDetails(error, "更新发放状态失败。")
      }),
      run: async () => {
        setIsToggling(true);
        try {
          const hash = await walletClient.writeContract({
            account: wallet.address,
            abi: unemploymentBenefitDistributorAbi,
            address: config.benefitDistributorAddress,
            functionName: "setProgramActive",
            args: [nextActive]
          });

          await publicClient.waitForTransactionReceipt({ hash });
          await queryClient.invalidateQueries({ queryKey: queryKeys.program(config) });
          return hash;
        } finally {
          setIsToggling(false);
        }
      }
    });
  }

  if (!agencyAccess.allowed) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-12 sm:px-6 lg:px-8">
        <RoleAccessStateCard access={agencyAccess} wallet={wallet} onConnect={connectWallet} onSwitch={switchToExpectedChain} />
        {walletError ? <p className="text-sm text-brand-seal">{walletError}</p> : null}
      </div>
    );
  }

  if (programQuery.isPending && !programQuery.data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <StateCard title="正在加载发放工作台" description="系统正在同步补助池余额和当前发放状态，请稍候。" />
      </div>
    );
  }

  if (programQuery.isError && !programQuery.data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <StateCard
          title="补助发放管理暂时不可用"
          description={getFriendlyErrorMessage(programQuery.error, "generic")}
          tone="danger"
          action={
            <button type="button" onClick={() => void programQuery.refetch()} className="btn-primary">
              重新加载发放工作台
            </button>
          }
        />
      </div>
    );
  }

  const program = programQuery.data;
  const claimHistory = (claimHistoryQuery.data ?? []) as BenefitClaimRecord[];

  return (
    <div className="bg-bg-paper py-12">
      <div className="mx-auto max-w-5xl space-y-8 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-ink/10 text-brand-ink">
            <LayoutDashboard size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{agencyCopy.pageTitle}</h1>
            <p className="text-sm text-text-muted">{agencyCopy.pageSubtitle}</p>
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <section className="card space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{agencyCopy.funding.sectionTitle}</h2>
              <span className="text-xs text-text-muted">{agencyCopy.funding.sectionHint}</span>
            </div>
            <div className="rounded-2xl border border-line-soft bg-bg-paper p-6 text-center">
              <div className="text-4xl font-bold text-brand-ink">{formatEth(program?.poolBalanceWei ?? 0n)}</div>
              <div className="mt-2 text-xs text-text-muted">{agencyCopy.funding.cardLabel}</div>
            </div>
            <div className="space-y-2">
              <label htmlFor="fund-amount" className="text-sm font-medium text-brand-ink">
                {agencyCopy.funding.inputLabel}
              </label>
              <div className="relative">
                <input
                  id="fund-amount"
                  type="text"
                  inputMode="decimal"
                  value={fundAmountInput}
                  onChange={handleFundAmountChange}
                  onBlur={handleFundAmountBlur}
                  placeholder={`${MIN_PROGRAM_FUND_AMOUNT_ETH} - ${MAX_PROGRAM_FUND_AMOUNT_ETH}`}
                  aria-describedby="fund-amount-help"
                  aria-invalid={Boolean(fundAmountError)}
                  className="field-input pr-16"
                />
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-text-muted">
                  ETH
                </span>
              </div>
              <p id="fund-amount-help" className={`text-xs ${fundAmountError ? "text-brand-seal" : "text-text-muted"}`}>
                {fundAmountError
                  ? fundAmountError
                  : `可输入 ${MIN_PROGRAM_FUND_AMOUNT_ETH} - ${MAX_PROGRAM_FUND_AMOUNT_ETH} ETH 之间的金额。`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleFund()}
              disabled={isFunding || Boolean(fundAmountError)}
              aria-busy={isFunding}
              className="btn-primary flex w-full items-center justify-center gap-2"
            >
              {isFunding ? <RefreshCw size={18} className="animate-spin" /> : <PlusCircle size={18} />}
              <span>{agencyCopy.funding.actionLabel}</span>
            </button>
          </section>

          <section className="card space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{agencyCopy.distribution.sectionTitle}</h2>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${program?.active ? "bg-green-500/10 text-green-700" : "bg-brand-seal/10 text-brand-seal"}`}
              >
                {program?.active ? agencyCopy.distribution.activeStatus : agencyCopy.distribution.pausedStatus}
              </span>
            </div>
            <div className="rounded-2xl border border-line-soft bg-bg-paper p-6 text-center">
              <div className="text-sm font-medium">
                {program?.active ? agencyCopy.distribution.activeDescription : agencyCopy.distribution.pausedDescription}
              </div>
              <div className="mt-2 text-xs text-text-muted">{agencyCopy.distribution.helperText}</div>
            </div>
            <button
              type="button"
              onClick={() => void handleToggle()}
              disabled={isToggling || !program}
              aria-busy={isToggling}
              className={
                program?.active
                  ? "btn-outline flex w-full items-center justify-center gap-2"
                  : "btn-seal flex w-full items-center justify-center gap-2"
              }
            >
              {isToggling ? <RefreshCw size={18} className="animate-spin" /> : program?.active ? <PauseCircle size={18} /> : <PlayCircle size={18} />}
              <span>{agencyCopy.distribution.actionLabel(Boolean(program?.active))}</span>
            </button>
          </section>
        </div>

        <section className="space-y-4">
          <h3 className="text-base font-semibold">{agencyCopy.overview.title}</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="card text-center">
              <div className="text-xs uppercase tracking-[0.18em] text-text-muted">{agencyCopy.overview.totalClaimsLabel}</div>
              <div className="mt-2 text-3xl font-bold">{program?.totalClaims ?? 0}</div>
            </div>
            <div className="card text-center">
              <div className="text-xs uppercase tracking-[0.18em] text-text-muted">{agencyCopy.overview.totalAmountLabel}</div>
              <div className="mt-2 text-3xl font-bold">{formatEth(program?.totalDisbursedWei ?? 0n)}</div>
            </div>
            <div className="card text-center">
              <div className="text-xs uppercase tracking-[0.18em] text-text-muted">{agencyCopy.overview.availableBalanceLabel}</div>
              <div className="mt-2 text-3xl font-bold">{formatEth(program?.poolBalanceWei ?? 0n)}</div>
            </div>
          </div>
        </section>

        <div ref={claimHistorySectionRef}>
          {claimHistoryVisible ? (
            <AgencyClaimHistorySection
              records={claimHistory}
              isPending={claimHistoryQuery.isPending}
              isError={claimHistoryQuery.isError}
              errorMessage={getFriendlyErrorMessage(claimHistoryQuery.error, "generic")}
              isRetrying={claimHistoryQuery.isFetching}
              onRetry={() => void claimHistoryQuery.refetch()}
            />
          ) : (
            <SectionSkeleton title={agencyCopy.history.title} rows={4} />
          )}
        </div>
      </div>
    </div>
  );
}
