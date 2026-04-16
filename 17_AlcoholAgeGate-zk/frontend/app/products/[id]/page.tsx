"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Minus, Plus, ShieldCheck, ShoppingCart } from "lucide-react";
import { usePublicClient, useWalletClient } from "wagmi";
import { AccessGuardHero } from "@/components/shared/AccessGuardHero";
import { StatePanel } from "@/components/shared/StatePanel";
import { StatusBadge } from "@/components/shared/StatusBadge";
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
import { useRuntimeConfig } from "@/hooks/useRuntimeConfig";
import { useWalletStatus } from "@/hooks/useWalletStatus";
import { getBuyerRoleAccessState } from "@/lib/access";
import { alcoholMarketplaceAbi } from "@/lib/contracts/abis";
import { formatYmdDate, isEligibleOnYmd } from "@/lib/domain/age-eligibility";
import { isCredentialCurrent } from "@/lib/domain/credentials";
import { getFriendlyErrorMessage } from "@/lib/friendly-errors";
import { createFailureId, formatEth } from "@/lib/utils";

function buildQuantityLabel(quantity: number, totalPriceWei: bigint) {
  return `立即购买 ${quantity} 件 · ${formatEth(totalPriceWei)}`;
}

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const config = useRuntimeConfig();
  const wallet = useWalletStatus(config.chainId);
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { showError, showSuccess } = useActionFeedback();
  const failureHistory = useFailureHistory();
  const localCredential = useLocalCredential(wallet.address);
  const { upsert: upsertPendingAction, clear: clearPendingAction, findByKind } = usePendingActionStore();
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
  const productsQuery = useMarketplaceProductsQuery({
    enabled: buyerAccess.allowed
  });
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [quantityInput, setQuantityInput] = useState("1");

  const product = useMemo(
    () => (productsQuery.data ?? []).find((item) => item.productIdLabel === params.id) ?? null,
    [params.id, productsQuery.data]
  );

  const currentSetQuery = useCurrentCredentialSetQuery({
    enabled: buyerAccess.allowed
  });

  const eligibilityQuery = useEligibilityStatusQuery(wallet.address, {
    enabled: buyerAccess.allowed
  });
  const currentDateQuery = useCurrentUtcDateYmdQuery({
    enabled: buyerAccess.allowed
  });

  useEffect(() => {
    if (!product) {
      return;
    }

    setQuantityInput((current) => {
      if (product.stock === 0) {
        return "0";
      }

      const parsed = Number.parseInt(current, 10);
      if (!Number.isFinite(parsed) || parsed < 1) {
        return "1";
      }

      return String(Math.min(parsed, product.stock));
    });
  }, [product]);

  const credential = localCredential.credential;
  const credentialCurrent = isCredentialCurrent(credential, currentSetQuery.data ?? null);
  const currentDateYmd = currentDateQuery.data ?? null;
  const waitingForAdultDate = Boolean(
    credentialCurrent &&
      credential?.eligibleFromYmd &&
      currentDateYmd &&
      !isEligibleOnYmd(credential.eligibleFromYmd, currentDateYmd)
  );

  const selectedQuantity = useMemo(() => {
    if (!product || product.stock === 0) {
      return 0;
    }
    if (quantityInput.trim() === "") {
      return null;
    }

    const parsed = Number.parseInt(quantityInput, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return null;
    }

    return Math.min(parsed, product.stock);
  }, [product, quantityInput]);

  const quantityInputInvalid = Boolean(product && product.stock > 0 && selectedQuantity === null);
  const effectiveQuantity = selectedQuantity ?? (product?.stock ? 1 : 0);
  const totalPriceWei = product ? product.priceWei * BigInt(effectiveQuantity) : 0n;
  const flowState = useBuyerFlowState({
    wallet,
    roleStatus: roleQuery.data,
    localCredential,
    currentSet: currentSetQuery.data ?? null,
    eligibility: eligibilityQuery.data ?? null,
    currentDateYmd,
    canPurchaseNow: Boolean(
      eligibilityQuery.data?.isCurrent &&
      product?.active &&
      (product?.stock ?? 0) > 0 &&
      !quantityInputInvalid
    )
  });
  const pendingPurchaseAction = findByKind("purchase");
  const refetchProducts = productsQuery.refetch;
  const purchaseStartedLocallyRef = useRef(false);

  useEffect(() => {
    if (
      purchaseStartedLocallyRef.current ||
      !pendingPurchaseAction ||
      pendingPurchaseAction.ownerAddress?.toLowerCase() !== wallet.address?.toLowerCase() ||
      pendingPurchaseAction.metadata?.productId !== product?.productIdLabel ||
      !publicClient
    ) {
      return;
    }

    let active = true;
    setIsPurchasing(true);

    void (async () => {
      try {
        await publicClient.waitForTransactionReceipt({ hash: pendingPurchaseAction.txHash });
        clearPendingAction("purchase");
        if (!active) {
          return;
        }

        await Promise.all([
          refetchProducts(),
          queryClient.invalidateQueries({ queryKey: ["buyer-orders-api"] }),
          queryClient.invalidateQueries({ queryKey: ["seller-orders-api"] }),
          queryClient.invalidateQueries({ queryKey: ["seller-balance"] }),
          queryClient.invalidateQueries({ queryKey: ["marketplace-product-states"] })
        ]);

        showSuccess({
          title: "购买成功",
          description: `你已成功购买 ${pendingPurchaseAction.metadata?.productName ?? product?.displayName ?? "当前商品"} ${pendingPurchaseAction.metadata?.quantity ?? ""} 件，总价 ${pendingPurchaseAction.metadata?.totalPriceEth ?? ""}。可以前往订单页查看最新状态。`,
          primaryAction: {
            label: "查看订单",
            href: "/buyer/orders"
          },
          secondaryAction: {
            label: "继续浏览"
          }
        });
      } catch (error) {
        clearPendingAction("purchase");
        if (!active) {
          return;
        }

        const message = getFriendlyErrorMessage(error, "purchase-product");
        showError({
          title: "下单失败",
          description: message
        });
      } finally {
        if (active) {
          setIsPurchasing(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [clearPendingAction, pendingPurchaseAction, product?.displayName, product?.productIdLabel, publicClient, queryClient, refetchProducts, showError, showSuccess, wallet.address]);

  if (productsQuery.isLoading) {
    return <StatePanel title="正在加载商品详情" description="正在整理当前商品信息，请稍候。" />;
  }

  if (!product) {
    return <StatePanel title="未找到商品" description="当前商品不存在或暂不可查看，请返回首页重新选择。" tone="danger" />;
  }

  const purchaseBlockedReason =
    !wallet.isConnected
      ? "请先连接买家钱包。"
      : wallet.wrongChain
        ? "当前网络不正确，请切换到项目网络。"
        : !wallet.hasWalletClient
          ? "当前钱包尚未完成授权，请点击右上角重新连接钱包后再试。"
          : flowState.status === "no-buyer-role"
            ? flowState.description
            : flowState.status === "missing-credential"
              ? flowState.description
              : flowState.status === "credential-mismatch"
                ? flowState.description
                : localCredential.status === "loading" || localCredential.isClaiming
                  ? "系统正在准备本地凭证，请稍候。"
                  : localCredential.error
                    ? localCredential.error
                    : !credential
                      ? "当前本地凭证暂不可用，请重新领取年龄凭证。"
                      : flowState.status === "credential-stale"
                        ? flowState.description
                        : flowState.status === "waiting-for-adult-date"
                          ? flowState.description
                        : !eligibilityQuery.data?.isCurrent
                          ? "当前账户还没有有效购买资格，请先完成年龄资格验证。"
                          : !product.active
                            ? "商品当前已下架。"
                            : product.stock === 0
                              ? "商品当前库存为 0。"
                              : quantityInputInvalid
                                ? "请先输入有效的购买数量。"
                                : null;

  const purchaseStateLabel = purchaseBlockedReason ? "待完成" : "已就绪";
  const roleStateLabel =
    flowState.status === "no-buyer-role" ? "未开放" : roleQuery.data?.isBuyer ? "已具备" : "待确认";
  const credentialStateLabel = flowState.status === "missing-credential"
    ? "未领取"
    : flowState.status === "credential-mismatch"
      ? "账户不匹配"
      : localCredential.isClaiming || localCredential.status === "loading"
        ? "处理中"
        : credentialCurrent
          ? "已准备"
          : "需刷新";
  const eligibilityStateLabel = flowState.status === "waiting-for-adult-date"
    ? "待成年"
    : !eligibilityQuery.data?.active
    ? "待验证"
    : eligibilityQuery.data.isCurrent
      ? "当前有效"
      : "需要重验";

  const canClaimCredential = wallet.isConnected && !wallet.wrongChain && (!roleQuery.data || roleQuery.data.isBuyer);
  const shouldShowClaimAction = !wallet.wrongChain && (
    !localCredential.hasStoredCredential ||
    Boolean(localCredential.error) ||
    !credential ||
    Boolean(credential && currentSetQuery.data && !credentialCurrent)
  );
  const shouldShowVerifyAction =
    !shouldShowClaimAction &&
    wallet.isConnected &&
    !wallet.wrongChain &&
    (!roleQuery.data || roleQuery.data.isBuyer) &&
    !waitingForAdultDate &&
    !eligibilityQuery.data?.isCurrent;
  const shouldShowWaitAction =
    !shouldShowClaimAction &&
    wallet.isConnected &&
    !wallet.wrongChain &&
    (!roleQuery.data || roleQuery.data.isBuyer) &&
    waitingForAdultDate;

  const claimActionDescription = credentialCurrent
    ? waitingForAdultDate
      ? `当前账户将在 ${formatYmdDate(credential?.eligibleFromYmd)} 满足购买年龄条件，届时可直接使用现有凭证重新验证。`
      : "请先完成年龄资格验证，系统会在验证通过后开放购买。"
    : credential
      ? "当前本地年龄凭证对应的资格集合已更新，请先刷新年龄凭证后再继续。"
      : "请先领取年龄凭证，系统会在本地准备完成验证所需的私有信息。";

  function handleQuantityChange(nextValue: string) {
    if (!product) {
      return;
    }
    if (!/^\d*$/.test(nextValue)) {
      return;
    }
    if (nextValue === "") {
      setQuantityInput("");
      return;
    }

    const parsed = Number.parseInt(nextValue, 10);
    if (!Number.isFinite(parsed)) {
      return;
    }

    if (product.stock === 0) {
      setQuantityInput("0");
      return;
    }

    setQuantityInput(String(Math.min(Math.max(parsed, 1), product.stock)));
  }

  function adjustQuantity(delta: number) {
    if (!product || product.stock === 0) {
      return;
    }

    const base = selectedQuantity ?? 1;
    const next = Math.min(Math.max(base + delta, 1), product.stock);
    setQuantityInput(String(next));
  }

  async function handleCredentialClaim() {
    const isRefreshing = localCredential.hasStoredCredential;

    try {
      await localCredential.claimCredential();
      await Promise.all([
        currentSetQuery.refetch(),
        eligibilityQuery.refetch(),
        currentDateQuery.refetch()
      ]);
      showSuccess({
        title: isRefreshing ? "年龄凭证已刷新" : "年龄凭证已领取",
        description: isRefreshing
          ? "当前账户的本地年龄凭证已经刷新完成，接下来可以前往年龄验证页面确认最新购买资格。"
          : "当前账户的本地年龄凭证已经领取完成，接下来可以前往年龄验证页面确认购买资格。",
        primaryAction: {
          label: "去年龄验证",
          href: "/buyer/verify"
        },
        secondaryAction: {
          label: "稍后再说"
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
        pageLabel="商品详情"
        title="当前不能进入商品详情页"
        reason={buyerAccess.description ?? "当前钱包没有进入商品详情页的权限。"}
      />
    );
  }

  if (productsQuery.isLoading) {
    return <StatePanel title="正在加载商品详情" description="正在整理当前商品信息，请稍候。" />;
  }

  if (!product) {
    return <StatePanel title="未找到商品" description="当前商品不存在或暂不可查看，请返回首页重新选择。" tone="danger" />;
  }
  return (
    <div className="space-y-3 xl:space-y-4">
      <Link href="/buyer" className="inline-flex items-center gap-2 text-xs font-semibold text-brand-amber md:text-sm">
        <ArrowLeft className="h-4 w-4" />
        返回买家中心
      </Link>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:items-stretch">
        <div className="glass-card relative min-h-[30rem] overflow-hidden bg-[linear-gradient(180deg,_rgba(255,253,248,0.98)_0%,_rgba(245,238,220,0.92)_100%)] xl:min-h-[42rem]">
          <Image
            src={product.imageSrc}
            alt={product.imageAlt}
            fill
            sizes="(max-width: 1280px) 100vw, 40vw"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(30,43,37,0.05)_0%,_rgba(30,43,37,0)_40%,_rgba(30,43,37,0.14)_100%)]" />
          <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
            <StatusBadge tone={product.active ? "success" : "danger"}>
              {product.active ? "在售" : "已下架"}
            </StatusBadge>
            <span className="rounded-full bg-white/88 px-3 py-1 text-xs font-semibold text-brand-green shadow-sm">
              库存 {product.stock}
            </span>
          </div>
        </div>

        <section className="glass-card flex h-full flex-col p-5 lg:p-6">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge tone="neutral">{product.category}</StatusBadge>
              <span className="text-sm text-text-muted">商品详情</span>
            </div>

            <div className="space-y-2.5">
              <h1 className="text-[1.85rem] font-semibold tracking-tight text-brand-green lg:text-[2.15rem]">
                {product.displayName}
              </h1>
              <p className="text-base font-semibold text-brand-amber lg:text-lg">{product.displayPrice}</p>
              <p className="max-w-2xl text-sm leading-6 text-text-muted">{product.description}</p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-[1.05rem] bg-bg-ivory px-3.5 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">品类</p>
                <p className="mt-1 text-sm font-semibold text-brand-green">{product.category}</p>
              </div>
              <div className="rounded-[1.05rem] bg-bg-ivory px-3.5 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">单价</p>
                <p className="mt-1 text-sm font-semibold text-brand-green">{product.displayPrice}</p>
              </div>
              <div className="rounded-[1.05rem] bg-bg-ivory px-3.5 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">购买状态</p>
                <p className="mt-1 text-sm font-semibold text-brand-green">{purchaseStateLabel}</p>
              </div>
              <div className="rounded-[1.05rem] bg-bg-ivory px-3.5 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">当前可购上限</p>
                <p className="mt-1 text-sm font-semibold text-brand-green">{product.stock} 件</p>
              </div>
            </div>
          </div>

          <div className="mt-auto space-y-4 pt-5">
            <div className="h-px bg-brand-green/8" />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-brand-green lg:text-lg">购买条件检查</h2>
                <StatusBadge tone={purchaseBlockedReason ? "warning" : "success"}>
                  {purchaseBlockedReason ? "暂不可购" : "可以购买"}
                </StatusBadge>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-[1.05rem] bg-bg-ivory px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">买家权限</p>
                  <p className="mt-1 text-sm font-semibold text-brand-green">{roleStateLabel}</p>
                </div>
                <div className="rounded-[1.05rem] bg-bg-ivory px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">本地凭证</p>
                  <p className="mt-1 text-sm font-semibold text-brand-green">{credentialStateLabel}</p>
                </div>
                <div className="rounded-[1.05rem] bg-bg-ivory px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">购买资格</p>
                  <p className="mt-1 text-sm font-semibold text-brand-green">{eligibilityStateLabel}</p>
                </div>
                <div className="rounded-[1.05rem] bg-bg-ivory px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">实时库存</p>
                  <p className="mt-1 text-sm font-semibold text-brand-green">{product.stock} 件</p>
                </div>
              </div>

              {purchaseBlockedReason ? (
                <StatePanel
                  title="当前购买被阻断"
                  description={
                    shouldShowClaimAction || shouldShowVerifyAction || shouldShowWaitAction
                      ? `${purchaseBlockedReason} ${claimActionDescription}`
                      : purchaseBlockedReason
                  }
                  tone="warning"
                  className="p-3.5"
                  action={
                    shouldShowClaimAction ? (
                      <button
                        type="button"
                        onClick={() => {
                          void handleCredentialClaim();
                        }}
                        disabled={!canClaimCredential || localCredential.isClaiming}
                        className="btn-outline gap-2"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        {localCredential.isClaiming
                          ? "正在处理中..."
                          : localCredential.hasStoredCredential
                            ? "刷新年龄凭证"
                            : "领取年龄凭证"}
                      </button>
                    ) : shouldShowVerifyAction ? (
                      <Link href="/buyer/verify" className="btn-outline gap-2">
                        <ShieldCheck className="h-4 w-4" />
                        去完成年龄验证
                      </Link>
                    ) : shouldShowWaitAction ? (
                      <Link href="/buyer/verify" className="btn-outline gap-2">
                        <ShieldCheck className="h-4 w-4" />
                        查看可验证日期
                      </Link>
                    ) : null
                  }
                />
              ) : null}
            </div>

            <div className="rounded-[1.4rem] border border-brand-green/10 bg-bg-ivory/70 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">批量购买</p>
                    <h3 className="mt-1 text-lg font-semibold text-brand-green">选择数量并完成单笔购买</h3>
                  </div>

                  <div className="inline-flex items-center overflow-hidden rounded-full border border-brand-green/15 bg-surface shadow-sm">
                    <button
                      type="button"
                      onClick={() => adjustQuantity(-1)}
                      disabled={product.stock === 0 || isPurchasing}
                      className="flex h-11 w-11 items-center justify-center text-brand-green transition hover:bg-brand-green/6 disabled:cursor-not-allowed disabled:text-text-muted/60"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      value={quantityInput}
                      onChange={(event) => handleQuantityChange(event.target.value)}
                      onBlur={() => {
                        if (product.stock === 0) {
                          setQuantityInput("0");
                          return;
                        }
                        if (quantityInput.trim() === "" || selectedQuantity === null) {
                          setQuantityInput("1");
                        }
                      }}
                      inputMode="numeric"
                      aria-label="购买数量"
                      disabled={product.stock === 0 || isPurchasing}
                      className="h-11 w-20 border-x border-brand-green/10 bg-transparent px-3 text-center text-base font-semibold text-brand-green outline-none disabled:text-text-muted/60"
                    />
                    <button
                      type="button"
                      onClick={() => adjustQuantity(1)}
                      disabled={product.stock === 0 || isPurchasing || effectiveQuantity >= product.stock}
                      className="flex h-11 w-11 items-center justify-center text-brand-green transition hover:bg-brand-green/6 disabled:cursor-not-allowed disabled:text-text-muted/60"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="text-xs leading-5 text-text-muted">
                    单价 {product.displayPrice}，当前最多可购买 {product.stock} 件。输入数量超过库存时，系统会自动调整为当前可购上限。
                  </p>
                </div>

                <div className="space-y-1 text-left lg:text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">订单总价</p>
                  <p className="text-2xl font-semibold tracking-tight text-brand-green">
                    {formatEth(totalPriceWei)}
                  </p>
                  <p className="text-sm text-text-muted">
                    {product.stock === 0 ? "当前暂无库存" : `${effectiveQuantity} 件 × ${product.displayPrice}`}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <button
                  disabled={Boolean(purchaseBlockedReason) || isPurchasing || quantityInputInvalid || effectiveQuantity === 0}
                  onClick={async () => {
                    setIsPurchasing(true);
                    try {
                      if (!walletClient) {
                        throw new Error("当前钱包尚未完成授权，请点击右上角重新连接钱包后再试。");
                      }
                      if (!publicClient) {
                        throw new Error("当前页面尚未准备好，请稍后再试。");
                      }
                  if (!selectedQuantity || selectedQuantity < 1) {
                        throw new Error("请先输入有效的购买数量。");
                      }

                      const quantityToPurchase = selectedQuantity;
                      const totalPriceSnapshot = totalPriceWei;
                      purchaseStartedLocallyRef.current = true;

                      const hash = await walletClient.writeContract({
                        abi: alcoholMarketplaceAbi,
                        address: config.marketplaceAddress,
                        functionName: "purchaseProduct",
                        args: [product.productId, quantityToPurchase],
                        value: totalPriceSnapshot,
                        account: walletClient.account
                      });
                      upsertPendingAction({
                        kind: "purchase",
                        txHash: hash,
                        startedAt: Date.now(),
                        ownerAddress: wallet.address,
                        metadata: {
                          productId: product.productIdLabel,
                          productName: product.displayName,
                          quantity: quantityToPurchase,
                          totalPriceEth: formatEth(totalPriceSnapshot)
                        }
                      });

                      await publicClient.waitForTransactionReceipt({ hash });
                      clearPendingAction("purchase");
                      await Promise.all([
                        refetchProducts(),
                        queryClient.invalidateQueries({ queryKey: ["buyer-orders-api"] }),
                        queryClient.invalidateQueries({ queryKey: ["seller-orders-api"] }),
                        queryClient.invalidateQueries({ queryKey: ["seller-balance"] }),
                        queryClient.invalidateQueries({ queryKey: ["marketplace-product-states"] })
                      ]);

                      showSuccess({
                        title: "购买成功",
                        description: `你已成功购买 ${product.displayName} ${quantityToPurchase} 件，总价 ${formatEth(totalPriceSnapshot)}。可以前往订单页查看最新状态。`,
                        primaryAction: {
                          label: "查看订单",
                          href: "/buyer/orders"
                        },
                        secondaryAction: {
                          label: "继续浏览"
                        }
                      });
                    } catch (error) {
                      clearPendingAction("purchase");
                      const message = getFriendlyErrorMessage(error, "purchase-product");

                      failureHistory.append({
                        id: createFailureId(),
                        kind: "purchase",
                        title: "商品购买失败",
                        message,
                        timestamp: Date.now(),
                        productId: product.productIdLabel,
                        quantity: selectedQuantity ?? undefined
                      });
                      showError({
                        title: "下单失败",
                        description: message
                      });
                    } finally {
                      purchaseStartedLocallyRef.current = false;
                      setIsPurchasing(false);
                    }
                  }}
                  className="btn-primary w-full gap-2"
                >
                  <ShoppingCart className="h-4 w-4" />
                  {isPurchasing ? "正在提交订单..." : buildQuantityLabel(effectiveQuantity, totalPriceWei)}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
