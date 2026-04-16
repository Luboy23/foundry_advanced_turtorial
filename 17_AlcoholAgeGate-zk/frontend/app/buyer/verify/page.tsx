"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck } from "lucide-react";
import { usePublicClient, useWalletClient } from "wagmi";
import { AccessGuardHero } from "@/components/shared/AccessGuardHero";
import { StatePanel } from "@/components/shared/StatePanel";
import { useActionFeedback } from "@/hooks/useActionFeedback";
import {
  useCurrentCredentialSetQuery,
  useCurrentUtcDateYmdQuery,
  useEligibilityStatusQuery,
  useMarketplaceProductsQuery,
  useRoleStatusQuery
} from "@/hooks/useAppQueries";
import { useBuyerFlowState } from "@/hooks/useBuyerFlowState";
import { useFailureHistory } from "@/hooks/useFailureHistory";
import { useLocalCredential } from "@/hooks/useLocalCredential";
import { usePendingActionStore } from "@/hooks/usePendingActionStore";
import { useProofGenerator } from "@/hooks/useProofGenerator";
import { useRuntimeConfig } from "@/hooks/useRuntimeConfig";
import { useWalletStatus } from "@/hooks/useWalletStatus";
import { getBuyerRoleAccessState } from "@/lib/access";
import { alcoholAgeEligibilityVerifierAbi } from "@/lib/contracts/abis";
import { isCredentialCurrent } from "@/lib/domain/credentials";
import { getPreferredPurchasableProduct } from "@/lib/domain/products";
import { getFriendlyErrorMessage } from "@/lib/friendly-errors";
import { createFailureId } from "@/lib/utils";

type SubmitStatus = "idle" | "submitting" | "confirming" | "success" | "error";

// 这页不是单纯的“提交一个表单”，而是买家资格流程的总编排层：
// 它同时要协调本地凭证、当前资格集合、当前 UTC 日期、浏览器 proving、链上交易和结果恢复。
export default function BuyerVerifyPage() {
  const config = useRuntimeConfig();
  const wallet = useWalletStatus(config.chainId);
  const queryClient = useQueryClient();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { showError, showSuccess } = useActionFeedback();
  const { credential, hasStoredCredential, status: credentialStatus, error: credentialError, isClaiming, claimCredential } =
    useLocalCredential(wallet.address);
  const { append: appendFailureHistory } = useFailureHistory();
  const { upsert: upsertPendingAction, clear: clearPendingAction, findByKind } = usePendingActionStore();
  const proof = useProofGenerator({
    wasmUrl: config.zkArtifactPaths.wasm,
    zkeyUrl: config.zkArtifactPaths.zkey,
    artifactVersion: config.deploymentId
  });
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submittedProofRef = useRef<number | null>(null);

  const roleQuery = useRoleStatusQuery(wallet.address, {
    enabled: wallet.isConnected && !wallet.wrongChain
  });
  const buyerAccess = getBuyerRoleAccessState({
    isConnected: wallet.isConnected,
    wrongChain: wallet.wrongChain,
    isLoadingRole: wallet.isConnected && !wallet.wrongChain && roleQuery.isLoading,
    roleError: roleQuery.isError,
    hasBuyerRole: Boolean(roleQuery.data?.isBuyer)
  });

  const currentSetQuery = useCurrentCredentialSetQuery({
    enabled: buyerAccess.allowed
  });
  const productsQuery = useMarketplaceProductsQuery({
    enabled: buyerAccess.allowed
  });

  const eligibilityQuery = useEligibilityStatusQuery(wallet.address, {
    enabled: buyerAccess.allowed
  });
  const currentDateQuery = useCurrentUtcDateYmdQuery({
    enabled: buyerAccess.allowed
  });
  const refetchEligibility = eligibilityQuery.refetch;

  // 刷新本地年龄凭证后，立刻把与之耦合的链上上下文同步到最新，
  // 避免“新凭证 + 旧集合缓存”组合在一起时仍然被页面误判为过期。
  const syncCredentialContext = useCallback(async () => {
    await Promise.all([
      currentSetQuery.refetch(),
      eligibilityQuery.refetch(),
      currentDateQuery.refetch()
    ]);
  }, [currentDateQuery, currentSetQuery, eligibilityQuery]);

  const credentialCurrent = useMemo(
    () => isCredentialCurrent(credential, currentSetQuery.data ?? null),
    [credential, currentSetQuery.data]
  );
  const currentDateYmd = currentDateQuery.data ?? null;
  const flowState = useBuyerFlowState({
    wallet,
    roleStatus: roleQuery.data,
    localCredential: {
      hasStoredCredential,
      status: credentialStatus,
      error: credentialError,
      isClaiming,
      credential
    },
    currentSet: currentSetQuery.data ?? null,
    eligibility: eligibilityQuery.data ?? null,
    currentDateYmd
  });
  const preferredProduct = useMemo(
    () => getPreferredPurchasableProduct(productsQuery.data ?? []),
    [productsQuery.data]
  );
  const preferredProductHref = preferredProduct ? `/products/${preferredProduct.productIdLabel}` : null;
  const pendingVerifyAction = findByKind("verify");

  // 一旦链上资格写入成功，统一在这里收敛后续动作：
  // 刷新资格查询、切到成功态，并弹出全局成功反馈。
  const handleVerificationConfirmed = useCallback(async () => {
    await Promise.all([
      refetchEligibility(),
      queryClient.invalidateQueries({
        queryKey: ["eligibility", wallet.address ?? "disconnected"]
      })
    ]);
    setSubmitStatus("success");
    setSubmitError(null);
    showSuccess({
      title: "购买资格已生效",
      description: preferredProductHref
        ? "当前账户已经具备有效购买资格，可以直接进入推荐商品页继续购买。"
        : "当前账户已经具备有效购买资格，当前暂无可购商品，可以先返回买家中心查看状态。",
      primaryAction: preferredProductHref
        ? {
            label: "去购买商品",
            href: preferredProductHref
          }
        : {
            label: "返回买家中心",
            href: "/buyer"
          },
      secondaryAction: preferredProductHref
        ? {
            label: "返回买家中心",
            href: "/buyer"
          }
        : undefined
    });
  }, [preferredProductHref, queryClient, refetchEligibility, showSuccess, wallet.address]);

  useEffect(() => {
    const proofPackage = proof.proofPackage;
    if (!proofPackage || !wallet.address) {
      submittedProofRef.current = null;
      return;
    }

    if (submittedProofRef.current === proofPackage.generatedAt) {
      return;
    }

    submittedProofRef.current = proofPackage.generatedAt;

    let active = true;

    (async () => {
      try {
        setSubmitStatus("submitting");
        setSubmitError(null);
        if (!walletClient) {
          throw new Error("当前钱包尚未完成授权，请点击右上角重新连接钱包后再试。");
        }
        const hash = await walletClient.writeContract({
          abi: alcoholAgeEligibilityVerifierAbi,
          address: config.eligibilityVerifierAddress,
          functionName: "verifyEligibility",
          args: [
            proofPackage.setId,
            proofPackage.verificationDateYmd,
            proofPackage.calldata.a,
            proofPackage.calldata.b,
            proofPackage.calldata.c
          ],
          account: walletClient.account
        });

        // 记录 pending action 的目的不是重复造状态，而是让刷新页面后仍能接着等同一笔交易确认。
        upsertPendingAction({
          kind: "verify",
          txHash: hash,
          startedAt: Date.now(),
          ownerAddress: wallet.address
        });

        if (!publicClient) {
          throw new Error("当前页面尚未准备好，请稍后再试。");
        }

        if (!active) {
          return;
        }

        setSubmitStatus("confirming");
        await publicClient.waitForTransactionReceipt({ hash });
        clearPendingAction("verify");
        if (!active) {
          return;
        }

        await handleVerificationConfirmed();
      } catch (error) {
        const message = getFriendlyErrorMessage(error, "verify-submit");
        clearPendingAction("verify");
        setSubmitStatus("error");
        setSubmitError(message);
        appendFailureHistory({
          id: createFailureId(),
          kind: "verify",
          title: "年龄验证失败",
          message,
          timestamp: Date.now()
        });
      }
    })();

    return () => {
      active = false;
    };
  }, [appendFailureHistory, clearPendingAction, config.eligibilityVerifierAddress, handleVerificationConfirmed, proof.proofPackage, publicClient, upsertPendingAction, wallet.address, walletClient]);

  useEffect(() => {
    // 如果页面在“已发起验证、等待链上确认”阶段被刷新，
    // 这里会接管那笔未完成交易，避免用户只能手动整页刷新才能看到最终结果。
    if (
      proof.proofPackage ||
      !pendingVerifyAction ||
      pendingVerifyAction.ownerAddress?.toLowerCase() !== wallet.address?.toLowerCase() ||
      !publicClient
    ) {
      return;
    }

    let active = true;
    setSubmitStatus("confirming");
    setSubmitError(null);

    void (async () => {
      try {
        await publicClient.waitForTransactionReceipt({ hash: pendingVerifyAction.txHash });
        clearPendingAction("verify");
        if (!active) {
          return;
        }
        await handleVerificationConfirmed();
      } catch (error) {
        clearPendingAction("verify");
        if (!active) {
          return;
        }
        const message = getFriendlyErrorMessage(error, "verify-submit");
        setSubmitStatus("error");
        setSubmitError(message);
      }
    })();

    return () => {
      active = false;
    };
  }, [clearPendingAction, handleVerificationConfirmed, pendingVerifyAction, proof.proofPackage, publicClient, wallet.address]);

  const accessGuard =
    !wallet.isConnected
      ? "请先连接钱包后再进行年龄验证。"
      : wallet.wrongChain
        ? "当前网络不正确，请切换到项目网络后再进行资格验证。"
        : !wallet.hasWalletClient
          ? "当前钱包尚未完成授权，请点击右上角重新连接钱包后再试。"
        : roleQuery.data && !roleQuery.data.isBuyer
          ? "当前账户暂无买家权限，无法提交资格验证。"
          : null;

  // accessGuard 负责拦“这个钱包当前是否有资格进入验证流程”；
  // credentialGuard 则负责拦“这个钱包即使有资格，当前本地凭证是否已经可用”。
  const credentialGuard =
    flowState.status === "missing-credential"
      ? flowState.description
      : flowState.status === "credential-mismatch"
        ? flowState.description
        : credentialStatus === "loading" || isClaiming
          ? "系统正在准备本地凭证，请稍候。"
          : credentialError
            ? credentialError
            : !credential
              ? "当前本地凭证暂不可用，请重新领取年龄凭证。"
              : flowState.status === "credential-stale"
                ? flowState.description
                : null;

  const busy =
    isClaiming ||
    currentDateQuery.isLoading ||
    proof.status === "loading-artifacts" ||
    proof.status === "generating-proof" ||
    submitStatus === "submitting" ||
    submitStatus === "confirming";

  const alreadyEligible = Boolean(eligibilityQuery.data?.isCurrent);
  const eligibleFromYmd = credential?.eligibleFromYmd ?? null;

  // dynamicAgeGuard 只在“凭证本身有效”以后才介入，
  // 它拦的是还没到成年日、或当前链上日期尚未同步完成这类动态条件。
  const dynamicAgeGuard =
    !credentialCurrent || !eligibleFromYmd
      ? null
      : currentDateQuery.isLoading
        ? "正在同步当前链上日期，请稍候。"
        : currentDateQuery.isError || !currentDateYmd
          ? "当前未能同步链上日期，请稍后重试。"
          : flowState.status === "waiting-for-adult-date"
            ? flowState.description
            : null;

  const showClaimAction = !accessGuard && (
    !hasStoredCredential ||
    Boolean(credentialError) ||
    (Boolean(credential) && currentSetQuery.data !== undefined && !credentialCurrent)
  );

  function renderVerificationSuccessActions() {
    if (preferredProductHref) {
      return (
        <div className="flex flex-wrap gap-3">
          <Link href={preferredProductHref} className="btn-primary">
            去购买商品
          </Link>
          <Link href="/buyer" className="btn-outline">
            返回买家中心
          </Link>
        </div>
      );
    }

    return (
      <Link href="/buyer" className="btn-primary">
        返回买家中心
      </Link>
    );
  }

  async function handleCredentialClaim() {
    const isRefreshing = hasStoredCredential;

    try {
      await claimCredential();
      await syncCredentialContext();
      showSuccess({
        title: isRefreshing ? "年龄凭证已刷新" : "年龄凭证已领取",
        description: isRefreshing
          ? "当前账户的本地年龄凭证已经刷新完成，现在可以继续留在本页并开始年龄验证。"
          : "当前账户的本地年龄凭证已经领取完成，现在可以继续留在本页并开始年龄验证。",
        primaryAction: {
          label: "继续验证"
        }
      });
    } catch (error) {
      showError({
        title: isRefreshing ? "年龄凭证刷新失败" : "年龄凭证领取失败",
        description: getFriendlyErrorMessage(error, "credential-claim")
      });
    }
  }

  if (!buyerAccess.allowed) {
    return (
      <AccessGuardHero
        pageLabel="年龄资格验证"
        title="当前不能进入买家验证页"
        reason={buyerAccess.description ?? "当前钱包没有进入买家验证页的权限。"}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-3 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-amber">Eligibility</p>
        <h1 className="text-4xl font-semibold text-brand-green">年龄资格验证</h1>
        <p className="text-base leading-7 text-text-muted">首次领取年龄凭证后，后续只需在这里完成资格验证，就可以继续浏览商品并完成购买。</p>
      </div>

      {accessGuard ? <StatePanel title="当前不能开始验证" description={accessGuard} tone="warning" /> : null}

      {credentialGuard ? (
        <StatePanel
          title="当前还不能开始验证"
          description={credentialGuard}
          tone={credentialError ? "danger" : "warning"}
          action={
            showClaimAction ? (
              <button
                type="button"
                onClick={() => {
                  void handleCredentialClaim();
                }}
                disabled={isClaiming}
                className="btn-primary"
              >
                {isClaiming ? "正在处理中..." : hasStoredCredential ? "刷新年龄凭证" : "领取年龄凭证"}
              </button>
            ) : null
          }
        />
      ) : null}

      {!credentialGuard && dynamicAgeGuard ? (
        <StatePanel
          title="当前还不能开始验证"
          description={dynamicAgeGuard}
          tone="warning"
        />
      ) : null}

      <section className="glass-card space-y-6 p-8">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-brand-green">验证进度</h2>
          <p className="text-sm text-text-muted">
            当前资格版本：{currentSetQuery.data?.version ?? "暂无"}
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm font-medium">
            <span className="text-brand-green">
              {submitStatus === "success"
                ? "验证已完成"
                : submitStatus === "confirming"
                  ? "正在确认结果"
                  : submitStatus === "submitting"
                    ? "正在提交验证"
                    : proof.label}
            </span>
            <span className="text-brand-amber">
              {submitStatus === "submitting" || submitStatus === "confirming" || submitStatus === "success"
                ? submitStatus === "success"
                  ? "已完成"
                  : "处理中"
                : `${proof.progress}%`}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-brand-green/8">
            <div
              className="h-full rounded-full bg-brand-amber transition-all"
              style={{
                width:
                  submitStatus === "success"
                    ? "100%"
                    : submitStatus === "confirming"
                      ? "92%"
                      : submitStatus === "submitting"
                        ? "80%"
                        : `${proof.progress}%`
              }}
            />
          </div>
        </div>

        <div className="rounded-3xl bg-bg-ivory p-5 text-sm leading-7 text-text-muted">
          系统只会使用完成资格验证所需的信息，不会展示完整身份资料或具体生日。
        </div>

        {proof.error ? (
          <StatePanel
            title="验证准备失败"
            description={getFriendlyErrorMessage(proof.error, "verify-proof")}
            tone="danger"
          />
        ) : null}
        {submitError ? <StatePanel title="验证提交失败" description={submitError} tone="danger" /> : null}

        <div className="flex flex-wrap gap-4">
          <button
            onClick={() => {
              if (!credential || !wallet.address || !currentSetQuery.data || !currentDateYmd) {
                return;
              }
              setSubmitStatus("idle");
              setSubmitError(null);
              proof.generateProof({
                credential,
                credentialSet: currentSetQuery.data,
                recipientAddress: wallet.address,
                verificationDateYmd: currentDateYmd
              });
            }}
            disabled={
              Boolean(accessGuard) ||
              Boolean(credentialGuard) ||
              Boolean(dynamicAgeGuard) ||
              busy ||
              !currentSetQuery.data ||
              !currentDateYmd ||
              alreadyEligible
            }
            className="btn-primary gap-2"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {alreadyEligible ? "当前资格已生效" : "开始验证"}
          </button>
          <button onClick={proof.reset} className="btn-outline" disabled={busy}>
            重置状态
          </button>
        </div>

        {alreadyEligible && submitStatus !== "success" ? (
          <StatePanel
            title="购买资格已有效"
            description={preferredProductHref
              ? "当前账户已经具备有效购买资格，无需重复提交年龄验证，可以直接前往推荐商品页购买。"
              : "当前账户已经具备有效购买资格，无需重复提交年龄验证。当前暂无可购商品，可先返回买家中心查看状态。"}
            action={renderVerificationSuccessActions()}
          />
        ) : null}

        {submitStatus === "success" ? (
          <StatePanel
            title="购买资格已生效"
            description={preferredProductHref
              ? "当前账户已具备有效购买资格，可以直接前往推荐商品页购买。"
              : "当前账户已具备有效购买资格，当前暂无可购商品，可以先返回买家中心查看状态。"}
            action={renderVerificationSuccessActions()}
          />
        ) : null}
      </section>
    </div>
  );
}
