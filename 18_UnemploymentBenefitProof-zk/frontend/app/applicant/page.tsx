"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, FileText, RefreshCw } from "lucide-react";
import { RoleAccessStateCard } from "@/components/shared/RoleAccessStateCard";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { StateCard } from "@/components/shared/StateCard";
import { useDialog } from "@/components/shared/DialogProvider";
import { applicantCopy, sharedCopy } from "@/lib/copy";
import { useDialogAction } from "@/hooks/useDialogAction";
import {
  prefetchApplicantVerificationQueries,
  useClaimHistoryQuery,
  useCurrentCredentialSetQuery,
  useHasClaimedQuery,
  useProgramQuery
} from "@/hooks/useBenefitQueries";
import { useFailureHistory } from "@/hooks/useFailureHistory";
import { useVisibilityOnce } from "@/hooks/useVisibilityOnce";
import { useLocalCredential } from "@/hooks/useLocalCredential";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { useWalletActionFeedback } from "@/hooks/useWalletActionFeedback";
import { getErrorDetails, getFriendlyErrorMessage } from "@/lib/friendly-errors";
import { preloadZkArtifacts } from "@/lib/zk/preload";
import type { BenefitClaimRecord } from "@/types/domain";
import { createFailureId, formatEth, formatAddress } from "@/lib/utils";

const ApplicantClaimHistorySection = dynamic(
  () => import("@/components/applicant/ApplicantClaimHistorySection").then((mod) => mod.ApplicantClaimHistorySection)
);
const ApplicantFailureHistorySection = dynamic(
  () => import("@/components/applicant/ApplicantFailureHistorySection").then((mod) => mod.ApplicantFailureHistorySection)
);

/**
 * 申请人工作台首页。
 *
 * 这一页负责把“资格凭证是否就绪”“当前补助项目状态”“本人领取历史”和“失败记录”放到同一
 * 个工作台里，并把后续进入核验页所需的数据尽量提前热身。
 */
export default function ApplicantPage() {
  const { config, wallet, publicClient, accessByRole, isConfigured } = useRoleAccess();
  const { connectWallet, switchToExpectedChain, walletError } = useWalletActionFeedback(wallet);
  const localCredential = useLocalCredential(wallet.address);
  const failureHistory = useFailureHistory(wallet.address);
  const runDialogAction = useDialogAction();
  const dialog = useDialog();
  const queryClient = useQueryClient();
  const { ref: claimHistorySectionRef, isVisible: claimHistoryVisible } = useVisibilityOnce<HTMLElement>();
  const { ref: failureHistorySectionRef, isVisible: failureHistoryVisible } = useVisibilityOnce<HTMLElement>();
  const applicantAccess = accessByRole.applicant;
  const credential = localCredential.credential;
  const walletAddress = wallet.address;

  const currentSetQuery = useCurrentCredentialSetQuery({ config, enabled: Boolean(publicClient && isConfigured) });
  const programQuery = useProgramQuery({ config, enabled: Boolean(publicClient && isConfigured) });
  const claimedQuery = useHasClaimedQuery({
    config,
    walletAddress: wallet.address,
    enabled: Boolean(publicClient && wallet.address && isConfigured)
  });
  const claimHistoryQuery = useClaimHistoryQuery({
    config,
    walletAddress: wallet.address,
    enabled: Boolean(wallet.address && isConfigured && claimHistoryVisible)
  });

  const currentSet = currentSetQuery.data;
  const isStale =
    credential && currentSet
      ? credential.versionNumber !== currentSet.version || credential.merkleRoot !== currentSet.merkleRoot.toString()
      : false;

  useEffect(() => {
    if (!walletAddress || !credential || isStale || !publicClient || !isConfigured) {
      return;
    }

    // 凭证一旦可用，就提前预取核验页马上会用到的链上状态与 zk 资源，减少真正切页后的等待。
    void prefetchApplicantVerificationQueries({
      queryClient,
      publicClient,
      config,
      walletAddress
    });
    void preloadZkArtifacts(config).catch(() => undefined);
  }, [config, credential, isConfigured, isStale, publicClient, queryClient, walletAddress]);

  /** 领取或刷新本地资格凭证，并把失败记录写入本地历史。 */
  async function handleClaimCredential() {
    await runDialogAction({
      confirm: {
        title: applicantCopy.claimDialog.confirmTitle(Boolean(localCredential.credential)),
        description: applicantCopy.claimDialog.confirmDescription(Boolean(localCredential.credential)),
        details: wallet.address ? `当前账户：${formatAddress(wallet.address)}` : undefined
      },
      progress: {
        title: applicantCopy.claimDialog.progressTitle(Boolean(localCredential.credential)),
        description: applicantCopy.claimDialog.progressDescription
      },
      success: (nextCredential) => ({
        title: applicantCopy.claimDialog.successTitle(Boolean(localCredential.credential)),
        description: applicantCopy.claimDialog.successDescription,
        details: applicantCopy.claimDialog.successDetails(
          nextCredential.versionNumber,
          formatAddress(nextCredential.boundApplicantAddress)
        )
      }),
      error: (error) => ({
        title: applicantCopy.claimDialog.errorTitle(Boolean(localCredential.credential)),
        description: applicantCopy.claimDialog.errorDescription,
        details: getErrorDetails(error, `${applicantCopy.claimDialog.failureHistoryTitle}。`)
      }),
      run: async () => {
        try {
          return await localCredential.claimCredential();
        } catch (error) {
          const message = getFriendlyErrorMessage(error, "credential-claim");
          failureHistory.addEntry({
            id: createFailureId(),
            kind: "credential",
            title: applicantCopy.claimDialog.failureHistoryTitle,
            message,
            timestamp: Date.now()
          });
          throw error;
        }
      }
    });
  }

  /** 当凭证缺失或已过期时，解释为什么现在还不能进入资格核验页。 */
  async function handleBlockedVerifyEntry() {
    await dialog.showInfo({
      title: applicantCopy.blockedVerify.title(Boolean(localCredential.credential)),
      description: applicantCopy.blockedVerify.description(Boolean(localCredential.credential)),
      tone: "warning"
    });
  }

  if (!applicantAccess.allowed) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-12 sm:px-6 lg:px-8">
        <RoleAccessStateCard
          access={applicantAccess}
          wallet={wallet}
          onConnect={connectWallet}
          onSwitch={switchToExpectedChain}
        />
        {walletError ? <p className="text-sm text-brand-seal">{walletError}</p> : null}
      </div>
    );
  }

  if (currentSetQuery.isPending && !currentSetQuery.data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <StateCard title="正在加载申请服务" description="系统正在同步资格名单和你的申请状态，请稍候。" />
      </div>
    );
  }

  if (currentSetQuery.isError && !currentSetQuery.data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <StateCard
          title="补助申请服务暂时不可用"
          description={getFriendlyErrorMessage(currentSetQuery.error, "generic")}
          tone="danger"
          action={
            <button type="button" onClick={() => void currentSetQuery.refetch()} className="btn-primary">
              重新加载申请服务
            </button>
          }
        />
      </div>
    );
  }

  if (!currentSetQuery.data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <StateCard
          title={applicantCopy.missingCredentialSetTitle}
          description={applicantCopy.missingCredentialSetDescription}
          action={
            <Link href="/" className="btn-outline">
              {sharedCopy.backHome}
            </Link>
          }
        />
      </div>
    );
  }

  const program = programQuery.data;
  const claimHistory = (claimHistoryQuery.data ?? []) as BenefitClaimRecord[];
  const hasClaimedBenefit = Boolean(claimedQuery.data);

  /** 悬停进入核验页按钮时再次预热 zk 资源，补上“预加载刚刚失效”的极端场景。 */
  function handleVerifyLinkWarmup() {
    if (!credential || isStale) {
      return;
    }

    void preloadZkArtifacts(config).catch(() => undefined);
  }

  return (
    <div className="bg-bg-paper py-12">
      <div className="mx-auto max-w-5xl space-y-8 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-seal text-surface">
            <FileText size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{applicantCopy.pageTitle}</h1>
            <p className="text-sm text-text-muted">{applicantCopy.pageSubtitle}</p>
          </div>
        </div>

        <section className="card space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">{applicantCopy.credentialSectionTitle}</h2>
              <p className="text-sm text-text-muted">{applicantCopy.credentialSectionDescription}</p>
            </div>
            <div className="rounded-full bg-brand-seal/10 px-3 py-1 text-xs font-semibold text-brand-seal">
              {credential
                ? isStale
                  ? applicantCopy.credentialStatus.stale
                  : applicantCopy.credentialStatus.ready
                : applicantCopy.credentialStatus.pending}
            </div>
          </div>

          <div className="grid gap-4 rounded-2xl border border-line-soft bg-bg-paper p-5 md:grid-cols-[1fr_auto] md:items-center">
            <div className="space-y-2">
              <div className="text-sm font-medium">
                {credential
                  ? isStale
                    ? applicantCopy.credentialHint.stale
                    : applicantCopy.credentialHint.ready
                  : applicantCopy.credentialHint.pending}
              </div>
              <div className="text-xs text-text-muted">
                {credential
                  ? applicantCopy.credentialVersionLabel(credential.versionNumber)
                  : applicantCopy.credentialMissingLabel}
              </div>
            </div>

            <div className="flex flex-col gap-3 md:flex-row">
              <button
                type="button"
                onClick={() => void handleClaimCredential()}
                disabled={localCredential.isClaiming}
                aria-busy={localCredential.isClaiming}
                className="btn-primary flex items-center gap-2"
              >
                {localCredential.isClaiming ? <RefreshCw size={18} className="animate-spin" /> : <FileText size={18} />}
                <span>{applicantCopy.claimButtonLabel(Boolean(credential))}</span>
              </button>

              {!credential || isStale ? (
                <button
                  type="button"
                  onClick={() => void handleBlockedVerifyEntry()}
                  aria-disabled="true"
                  className="btn-seal flex items-center gap-2 opacity-60"
                >
                  <span>{applicantCopy.verifyEntryButtonLabel}</span>
                  <ArrowRight size={18} />
                </button>
              ) : (
                <Link
                  href="/applicant/verify"
                  onMouseEnter={handleVerifyLinkWarmup}
                  onFocus={handleVerifyLinkWarmup}
                  className="btn-seal flex items-center gap-2"
                >
                  <span>{applicantCopy.verifyEntryButtonLabel}</span>
                  <ArrowRight size={18} />
                </Link>
              )}
            </div>
          </div>
        </section>

        <div className="grid gap-8 md:grid-cols-2">
          <section className="space-y-4">
            <h3 className="text-base font-semibold">{applicantCopy.benefitInfoTitle}</h3>
            <div className="card space-y-4">
              {programQuery.isError && !program ? (
                <div className="space-y-3">
                  <div className="text-sm font-medium text-brand-seal">补助信息读取失败</div>
                  <div className="text-sm text-text-muted">{getFriendlyErrorMessage(programQuery.error, "generic")}</div>
                  <button type="button" onClick={() => void programQuery.refetch()} className="btn-outline">
                    重新同步补助信息
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-muted">{applicantCopy.benefitNameLabel}</span>
                    <span className="font-medium">{applicantCopy.benefitName}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-muted">{applicantCopy.benefitAmountLabel}</span>
                    <span className="font-medium">{formatEth(program?.amountWei ?? 100000000000000000000n)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-muted">{applicantCopy.benefitStatusLabel}</span>
                    <span className="font-medium">
                      {hasClaimedBenefit
                        ? applicantCopy.benefitStatus.claimed
                        : program?.active
                          ? applicantCopy.benefitStatus.active
                          : applicantCopy.benefitStatus.inactive}
                    </span>
                  </div>
                </>
              )}
            </div>
          </section>

          <div ref={claimHistorySectionRef}>
            {claimHistoryVisible ? (
              <ApplicantClaimHistorySection
                records={claimHistory}
                isPending={claimHistoryQuery.isPending}
                isError={claimHistoryQuery.isError}
                errorMessage={getFriendlyErrorMessage(claimHistoryQuery.error, "generic")}
                isRetrying={claimHistoryQuery.isFetching}
                onRetry={() => void claimHistoryQuery.refetch()}
              />
            ) : (
              <SectionSkeleton title={applicantCopy.claimHistoryTitle} rows={3} />
            )}
          </div>
        </div>

        <div ref={failureHistorySectionRef}>
          {failureHistoryVisible ? (
            <ApplicantFailureHistorySection entries={failureHistory.entries} />
          ) : (
            <SectionSkeleton title={applicantCopy.failureHistoryTitle} rows={3} />
          )}
        </div>
      </div>
    </div>
  );
}
