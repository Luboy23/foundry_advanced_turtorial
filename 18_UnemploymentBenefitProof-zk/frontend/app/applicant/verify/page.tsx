"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { useWalletClient } from "wagmi";
import { RoleAccessStateCard } from "@/components/shared/RoleAccessStateCard";
import { StateCard } from "@/components/shared/StateCard";
import { useDialog } from "@/components/shared/DialogProvider";
import { applicantCopy, sharedCopy } from "@/lib/copy";
import {
  useCurrentCredentialSetQuery,
  useHasClaimedQuery,
  useProgramQuery
} from "@/hooks/useBenefitQueries";
import { useFailureHistory } from "@/hooks/useFailureHistory";
import { useLocalCredential } from "@/hooks/useLocalCredential";
import { useProofGenerator } from "@/hooks/useProofGenerator";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { useWalletActionFeedback } from "@/hooks/useWalletActionFeedback";
import { unemploymentBenefitDistributorAbi } from "@/lib/contracts/abis";
import {
  getErrorDetails,
  getFriendlyErrorMessage,
  type FriendlyErrorContext
} from "@/lib/friendly-errors";
import { queryKeys } from "@/lib/query-keys";
import { createFailureId, formatEth } from "@/lib/utils";

/**
 * 申请人资格核验页。
 *
 * 该页面把“检查是否具备核验前置条件”“本地产证”“提交链上领取交易”“成功/失败反馈”串成
 * 一个连续流程，是申请人侧最核心的状态机页面。
 */
type VerifyBlockedState = {
  title: string;
  description: string;
  action?: ReactNode;
};

/** 资格核验页组件。 */
export default function ApplicantVerifyPage() {
  const [successHash, setSuccessHash] = useState<`0x${string}` | null>(null);
  const [submitPhase, setSubmitPhase] = useState<"idle" | "submitting" | "confirming" | "success">("idle");
  const { config, wallet, publicClient, accessByRole, isConfigured } = useRoleAccess();
  const { data: walletClient } = useWalletClient();
  const { connectWallet, switchToExpectedChain, walletError } = useWalletActionFeedback(wallet);
  const localCredential = useLocalCredential(wallet.address);
  const proofGenerator = useProofGenerator();
  const failureHistory = useFailureHistory(wallet.address);
  const queryClient = useQueryClient();
  const dialog = useDialog();
  const applicantAccess = accessByRole.applicant;

  const currentSetQuery = useCurrentCredentialSetQuery({ config, enabled: Boolean(publicClient && isConfigured) });
  const programQuery = useProgramQuery({ config, enabled: Boolean(publicClient && isConfigured) });
  const claimedQuery = useHasClaimedQuery({
    config,
    walletAddress: wallet.address,
    enabled: Boolean(publicClient && wallet.address && isConfigured)
  });

  const currentSet = currentSetQuery.data;
  const program = programQuery.data;
  const credential = localCredential.credential;
  const isStale =
    Boolean(credential && currentSet) &&
    (credential!.versionNumber !== currentSet!.version || credential!.merkleRoot !== currentSet!.merkleRoot.toString());

  // 把所有“不允许进入产证和领取流程”的前置条件收敛到一个阻塞状态里，页面渲染只需要处理这一份结果。
  const blockedState = useMemo<VerifyBlockedState | null>(() => {
    if (!currentSet) {
      return {
        title: applicantCopy.verify.blockedStates.missingCredentialSetTitle,
        description: applicantCopy.verify.blockedStates.missingCredentialSetDescription,
        action: (
          <Link href="/applicant" className="btn-outline">
            {sharedCopy.backToApplicantService}
          </Link>
        )
      };
    }
    if (!credential) {
      return {
        title: applicantCopy.verify.blockedStates.missingCredentialTitle,
        description: applicantCopy.verify.blockedStates.missingCredentialDescription,
        action: (
          <Link href="/applicant" className="btn-primary">
            {sharedCopy.backToApplicantService}
          </Link>
        )
      };
    }
    if (isStale) {
      return {
        title: applicantCopy.verify.blockedStates.staleCredentialTitle,
        description: applicantCopy.verify.blockedStates.staleCredentialDescription,
        action: (
          <Link href="/applicant" className="btn-primary">
            {sharedCopy.backToApplicantService}
          </Link>
        )
      };
    }
    if (!program?.active) {
      return {
        title: applicantCopy.verify.blockedStates.inactiveProgramTitle,
        description: applicantCopy.verify.blockedStates.inactiveProgramDescription,
        action: (
          <Link href="/applicant" className="btn-outline">
            {sharedCopy.backToApplicantService}
          </Link>
        )
      };
    }
    if (program.poolBalanceWei < program.amountWei) {
      return {
        title: applicantCopy.verify.blockedStates.lowBalanceTitle,
        description: applicantCopy.verify.blockedStates.lowBalanceDescription,
        action: (
          <Link href="/applicant" className="btn-outline">
            {sharedCopy.backToApplicantService}
          </Link>
        )
      };
    }
    if (claimedQuery.data) {
      return {
        title: applicantCopy.verify.blockedStates.claimedTitle,
        description: applicantCopy.verify.blockedStates.claimedDescription,
        action: (
          <Link href="/applicant" className="btn-outline">
            {sharedCopy.backToApplicantService}
          </Link>
        )
      };
    }
    return null;
  }, [claimedQuery.data, credential, currentSet, isStale, program]);

  /** 生成证明并提交领取交易。 */
  async function handleVerifyAndClaim() {
    if (
      !wallet.address ||
      !walletClient ||
      !publicClient ||
      !credential ||
      !currentSet ||
      !program ||
      submitPhase === "submitting" ||
      submitPhase === "confirming"
    ) {
      return;
    }

    const confirmed = await dialog.confirm({
      title: applicantCopy.verify.confirmTitle,
      description: applicantCopy.verify.confirmDescription,
      details: applicantCopy.verify.confirmDetails(wallet.address, formatEth(program.amountWei))
    });

    if (!confirmed) {
      return;
    }

    let failureContext: FriendlyErrorContext = "verify-proof";
    const progress = dialog.showInfo({
      title: applicantCopy.verify.progress.checkingTitle,
      description: applicantCopy.verify.progress.checkingDescription,
      busy: true,
      dismissible: false
    });

    try {
      progress.update({
        title: applicantCopy.verify.progress.generatingTitle,
        description: applicantCopy.verify.progress.generatingDescription
      });

      const proofPackage = await proofGenerator.generateProof({
        credential,
        credentialSet: currentSet,
        program,
        recipientAddress: wallet.address
      });

      failureContext = "verify-submit";
      setSubmitPhase("submitting");
      progress.update({
        title: applicantCopy.verify.progress.submittingTitle,
        description: applicantCopy.verify.progress.submittingDescription
      });

      const hash = await walletClient.writeContract({
        account: wallet.address,
        abi: unemploymentBenefitDistributorAbi,
        address: config.benefitDistributorAddress,
        functionName: "verifyAndDisburse",
        args: [
          proofPackage.calldata.a,
          proofPackage.calldata.b,
          proofPackage.calldata.c,
          proofPackage.calldata.publicSignals
        ]
      });

      setSubmitPhase("confirming");
      progress.update({
        title: applicantCopy.verify.progress.confirmingTitle,
        description: applicantCopy.verify.progress.confirmingDescription,
        details: applicantCopy.verify.progress.confirmingDetails(hash)
      });

      await publicClient.waitForTransactionReceipt({ hash });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.hasClaimed(config, wallet.address) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.claimHistory(config, wallet.address) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.program(config) })
      ]);

      progress.close();
      await dialog.showSuccess({
        title: applicantCopy.verify.success.dialogTitle,
        description: applicantCopy.verify.success.dialogDescription,
        details: applicantCopy.verify.success.dialogDetails(hash, formatEth(program.amountWei))
      });
      setSuccessHash(hash);
      setSubmitPhase("success");
    } catch (error) {
      progress.close();
      const message = getFriendlyErrorMessage(error, failureContext);
      failureHistory.addEntry({
        id: createFailureId(),
        kind: "verify",
        title: applicantCopy.verify.failureHistoryTitle,
        message,
        timestamp: Date.now()
      });
      await dialog.showError({
        title: applicantCopy.verify.errorTitle(failureContext),
        description: message,
        details: getErrorDetails(error, `${applicantCopy.verify.failureHistoryTitle}。`)
      });
      setSubmitPhase("idle");
    }
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

  const isLoadingCriticalQueries =
    (currentSetQuery.isPending && currentSetQuery.data === undefined) ||
    (programQuery.isPending && programQuery.data === undefined) ||
    (claimedQuery.isPending && claimedQuery.data === undefined);
  const criticalQueryError =
    (currentSetQuery.isError && currentSetQuery.error) ||
    (programQuery.isError && programQuery.error) ||
    (claimedQuery.isError && claimedQuery.error) ||
    null;

  if (isLoadingCriticalQueries) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <StateCard title="正在加载资格核验数据" description="系统正在同步资格名单、补助状态和你的领取记录，请稍候。" />
      </div>
    );
  }

  if (criticalQueryError) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <StateCard
          title="资格核验暂时不可用"
          description={getFriendlyErrorMessage(criticalQueryError, "generic")}
          tone="danger"
          action={
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  void currentSetQuery.refetch();
                  void programQuery.refetch();
                  void claimedQuery.refetch();
                }}
                className="btn-primary"
              >
                重新加载核验数据
              </button>
              <Link href="/applicant" className="btn-outline">
                {sharedCopy.backToApplicantService}
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  if (blockedState) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <StateCard title={blockedState.title} description={blockedState.description} action={blockedState.action} />
      </div>
    );
  }

  const steps = applicantCopy.verify.steps.map((step, index) => ({
    ...step,
    complete:
      index === 0
        ? proofGenerator.status === "proof-ready" || submitPhase !== "idle"
        : index === 1
          ? submitPhase !== "idle"
          : submitPhase === "success",
    active:
      index === 0
        ? proofGenerator.status === "loading-artifacts" || proofGenerator.status === "idle"
        : index === 1
          ? proofGenerator.status === "generating-proof"
          : submitPhase === "submitting" || submitPhase === "confirming"
  }));

  if (submitPhase === "success" && successHash && program) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-3xl items-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="card w-full space-y-6 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10 text-green-600">
            <CheckCircle2 size={44} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">{applicantCopy.verify.success.pageTitle}</h1>
            <p className="text-sm text-text-muted">{applicantCopy.verify.success.pageDescription}</p>
          </div>
          <div className="rounded-2xl border border-line-soft bg-bg-paper p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-text-muted">{applicantCopy.verify.success.hashLabel}</span>
              <span className="font-mono text-xs">{successHash}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-text-muted">{applicantCopy.verify.success.amountLabel}</span>
              <span className="font-medium">{formatEth(program.amountWei)}</span>
            </div>
          </div>
          <Link href="/applicant" className="btn-primary w-full">
            {sharedCopy.backToApplicantService}
          </Link>
        </div>
      </div>
    );
  }

  const mainLabel =
    submitPhase === "submitting"
      ? applicantCopy.verify.progress.submittingTitle
      : submitPhase === "confirming"
        ? applicantCopy.verify.progress.confirmingTitle
        : proofGenerator.status === "generating-proof"
          ? proofGenerator.label
          : applicantCopy.verify.buttonLabelIdle;

  return (
    <div className="bg-bg-paper py-12">
      <div className="mx-auto max-w-4xl space-y-8 px-4 sm:px-6 lg:px-8">
        <Link href="/applicant" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-brand-ink">
          <ArrowLeft size={16} />
          {sharedCopy.backToApplicantService}
        </Link>

        <section className="card space-y-8">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-bold">{applicantCopy.verify.pageTitle}</h1>
            <p className="text-sm text-text-muted">{applicantCopy.verify.pageDescription}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {steps.map((step) => (
              <div
                key={step.title}
                className={`rounded-2xl border p-4 text-center transition ${
                  step.active
                    ? "border-brand-ink bg-brand-ink/5"
                    : step.complete
                      ? "border-green-500/30 bg-green-500/5"
                      : "border-line-soft bg-bg-paper opacity-70"
                }`}
              >
                <div className="text-sm font-semibold">{step.title}</div>
                <div className="mt-1 text-xs text-text-muted">{step.desc}</div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-line-soft bg-bg-paper p-8">
            <div className="flex flex-col items-center gap-4 text-center">
              {proofGenerator.status === "generating-proof" || submitPhase === "submitting" || submitPhase === "confirming" ? (
                <Loader2 className="h-12 w-12 animate-spin text-brand-ink" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-seal/10 text-brand-seal">
                  <ShieldCheck size={30} />
                </div>
              )}
              <div className="space-y-1">
                <div className="font-medium">{mainLabel}</div>
                <div className="text-xs text-text-muted">
                  {proofGenerator.status === "generating-proof"
                    ? applicantCopy.verify.mainHintGenerating
                    : applicantCopy.verify.mainHintDefault}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleVerifyAndClaim()}
                disabled={submitPhase === "submitting" || submitPhase === "confirming" || proofGenerator.status === "generating-proof"}
                aria-busy={submitPhase === "submitting" || submitPhase === "confirming" || proofGenerator.status === "generating-proof"}
                className="btn-seal w-full max-w-sm"
              >
                {submitPhase === "idle" ? applicantCopy.verify.buttonLabelIdle : mainLabel}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
