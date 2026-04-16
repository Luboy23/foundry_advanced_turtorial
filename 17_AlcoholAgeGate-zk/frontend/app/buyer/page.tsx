"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { ShieldCheck, ShoppingBag } from "lucide-react";
import { CredentialCard } from "@/components/buyer/CredentialCard";
import { EligibilityCard } from "@/components/buyer/EligibilityCard";
import { OrderList } from "@/components/buyer/OrderList";
import { ProductCard } from "@/components/product/ProductCard";
import { AccessGuardHero } from "@/components/shared/AccessGuardHero";
import { StatePanel } from "@/components/shared/StatePanel";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useActionFeedback } from "@/hooks/useActionFeedback";
import {
  useBuyerOrdersApiQuery,
  useCurrentCredentialSetQuery,
  useCurrentUtcDateYmdQuery,
  useEligibilityStatusQuery,
  useMarketplaceProductsQuery,
  useRoleStatusQuery
} from "@/hooks/useAppQueries";
import { useBuyerFlowState } from "@/hooks/useBuyerFlowState";
import { useLocalCredential } from "@/hooks/useLocalCredential";
import { warmProofArtifacts } from "@/hooks/useProofGenerator";
import { useRuntimeConfig } from "@/hooks/useRuntimeConfig";
import { useWalletStatus } from "@/hooks/useWalletStatus";
import { getBuyerRoleAccessState } from "@/lib/access";
import { formatYmdDate, isEligibleOnYmd } from "@/lib/domain/age-eligibility";
import { isCredentialCurrent } from "@/lib/domain/credentials";
import { getPreferredPurchasableProduct } from "@/lib/domain/products";
import { getFriendlyErrorMessage } from "@/lib/friendly-errors";

export default function BuyerPage() {
  const config = useRuntimeConfig();
  const wallet = useWalletStatus(config.chainId);
  const { showError, showSuccess } = useActionFeedback();
  const localCredential = useLocalCredential(wallet.address);
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

  const credentialSetQuery = useCurrentCredentialSetQuery({
    enabled: buyerAccess.allowed
  });

  const eligibilityQuery = useEligibilityStatusQuery(wallet.address, {
    enabled: buyerAccess.allowed
  });
  const currentDateQuery = useCurrentUtcDateYmdQuery({
    enabled: buyerAccess.allowed
  });

  const ordersQuery = useBuyerOrdersApiQuery(wallet.address, {
    enabled: buyerAccess.allowed
  });

  const products = useMemo(() => (productsQuery.data ?? []).slice(0, 2), [productsQuery.data]);
  const preferredProduct = useMemo(
    () => getPreferredPurchasableProduct(productsQuery.data ?? []),
    [productsQuery.data]
  );
  const preferredProductHref = preferredProduct ? `/products/${preferredProduct.productIdLabel}` : null;

  const currentSet = credentialSetQuery.data ?? null;
  const credential = localCredential.credential;
  const credentialStale = Boolean(credential && currentSet && !isCredentialCurrent(credential, currentSet));
  const credentialReady = Boolean(credential && !credentialStale);
  const currentDateYmd = currentDateQuery.data ?? null;
  const waitingForAdultDate = Boolean(
    credentialReady &&
      credential?.eligibleFromYmd &&
      currentDateYmd &&
      !isEligibleOnYmd(credential.eligibleFromYmd, currentDateYmd)
  );
  const recentOrders = (ordersQuery.data ?? []).slice(0, 3);
  const availableProductCount = useMemo(
    () => (productsQuery.data ?? []).filter((product) => product.active && product.stock > 0).length,
    [productsQuery.data]
  );
  const flowState = useBuyerFlowState({
    wallet,
    roleStatus: roleQuery.data,
    localCredential,
    currentSet,
    eligibility: eligibilityQuery.data ?? null,
    currentDateYmd
  });

  useEffect(() => {
    if (!buyerAccess.allowed || !localCredential.hasStoredCredential || wallet.wrongChain) {
      return;
    }

    const warm = () => {
      warmProofArtifacts({
        wasmUrl: config.zkArtifactPaths.wasm,
        zkeyUrl: config.zkArtifactPaths.zkey,
        artifactVersion: config.deploymentId
      });
    };

    const browserWindow = window as Window & typeof globalThis;

    if ("requestIdleCallback" in browserWindow) {
      const handle = browserWindow.requestIdleCallback(() => {
        warm();
      });
      return () => {
        browserWindow.cancelIdleCallback(handle);
      };
    }

    const timeoutId = globalThis.setTimeout(() => {
      warm();
    }, 250);
    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, [buyerAccess.allowed, config.deploymentId, config.zkArtifactPaths.wasm, config.zkArtifactPaths.zkey, localCredential.hasStoredCredential, wallet.wrongChain]);

  const credentialLabel = flowState.status === "missing-credential"
    ? "未领取"
    : flowState.status === "credential-mismatch"
      ? "账户不匹配"
      : localCredential.isClaiming || localCredential.status === "loading"
        ? "处理中"
        : credentialStale
          ? "需刷新"
          : localCredential.status === "ready"
            ? "已准备"
            : "需重领";

  const eligibilityLabel = flowState.status === "waiting-for-adult-date"
    ? "待成年"
    : !eligibilityQuery.data?.active
    ? "待验证"
    : eligibilityQuery.data.isCurrent
      ? "当前有效"
      : "需要重验";

  const eligibilityTone = flowState.status === "waiting-for-adult-date"
    ? "warning"
    : !eligibilityQuery.data?.active
    ? "warning"
    : eligibilityQuery.data.isCurrent
      ? "success"
      : "danger";

  const canClaimCredential = wallet.isConnected && !wallet.wrongChain && (!roleQuery.data || roleQuery.data.isBuyer);
  const showClaimPrimaryAction = !credentialReady;
  const showVerifyPrimaryAction = credentialReady && !waitingForAdultDate && !eligibilityQuery.data?.isCurrent;
  const showWaitPrimaryAction = credentialReady && waitingForAdultDate;

  async function handleCredentialClaim() {
    const isRefreshing = localCredential.hasStoredCredential;

    try {
      await localCredential.claimCredential();
      await Promise.all([
        credentialSetQuery.refetch(),
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
        pageLabel="买家中心"
        title="当前不能进入买家页面"
        reason={buyerAccess.description ?? "当前钱包没有进入买家页面的权限。"}
      />
    );
  }

  return (
    <div className="space-y-12">
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="glass-card relative overflow-hidden p-8 lg:p-10">
          <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top_left,_rgba(191,132,48,0.2),_transparent_55%)]" />
          <div className="relative space-y-6">
            <StatusBadge tone={eligibilityTone}>买家工作台</StatusBadge>
            <div className="space-y-3">
              <h1 className="text-4xl font-semibold tracking-tight text-brand-green lg:text-5xl">买家中心</h1>
              <p className="max-w-2xl text-base leading-7 text-text-muted">
                首次领取年龄凭证后，后续只需完成年龄验证即可继续浏览商品并完成购买。页面信息会按“凭证状态、推荐商品、购买订单”的顺序组织。
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              {showClaimPrimaryAction ? (
                <button
                  type="button"
                  onClick={() => {
                    void handleCredentialClaim();
                  }}
                  disabled={!canClaimCredential || localCredential.isClaiming}
                  className="btn-primary gap-2"
                >
                  <ShieldCheck className="h-4 w-4" />
                  {localCredential.isClaiming ? "正在领取..." : credentialStale ? "刷新年龄凭证" : "领取年龄凭证"}
                </button>
              ) : showVerifyPrimaryAction ? (
                <Link href="/buyer/verify" className="btn-primary gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  进行年龄验证
                </Link>
              ) : showWaitPrimaryAction ? (
                <Link href="/buyer/verify" className="btn-outline gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  查看可验证日期
                </Link>
              ) : preferredProductHref ? (
                <Link href={preferredProductHref} className="btn-primary gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  前往购买商品
                </Link>
              ) : (
                <button type="button" disabled className="btn-primary gap-2 cursor-not-allowed opacity-50">
                  <ShoppingBag className="h-4 w-4" />
                  当前暂无可购商品
                </button>
              )}
              <Link href="/buyer/orders" className="btn-outline">
                查看订单记录
              </Link>
            </div>
          </div>
        </div>

        <aside className="glass-card p-6 lg:p-8">
          <div className="mb-5 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-amber">Overview</p>
            <h2 className="text-2xl font-semibold text-brand-green">当前概览</h2>
            <p className="text-sm leading-6 text-text-muted">当前账户在买家流程中的关键信息会集中展示在这里。</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
            <div className="rounded-[1.75rem] bg-bg-ivory p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-text-muted">本地凭证</p>
              <p className="mt-3 text-2xl font-semibold text-brand-green">{credentialLabel}</p>
            </div>
            <div className="rounded-[1.75rem] bg-bg-ivory p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-text-muted">年龄资格</p>
              <p className="mt-3 text-2xl font-semibold text-brand-green">{eligibilityLabel}</p>
            </div>
            <div className="rounded-[1.75rem] bg-bg-ivory p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-text-muted">可购商品</p>
              <p className="mt-3 text-2xl font-semibold text-brand-green">{availableProductCount}</p>
            </div>
            <div className="rounded-[1.75rem] bg-bg-ivory p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-text-muted">购买订单</p>
              <p className="mt-3 text-2xl font-semibold text-brand-green">{recentOrders.length}</p>
            </div>
          </div>
        </aside>
      </section>

      <section className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-amber">Status</p>
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-brand-green">凭证与资格状态</h2>
              <p className="mt-1 text-sm leading-6 text-text-muted">
                先确认当前私有凭证与购买资格状态，这是进入商品购买流程前的第一步。
              </p>
            </div>
            <StatusBadge tone={eligibilityTone}>{eligibilityLabel}</StatusBadge>
          </div>
        </div>

        {!localCredential.hasStoredCredential ? (
          <StatePanel
            title="先领取年龄凭证"
            description="当前账户还没有本地年龄凭证。领取完成后，后续就可以直接进行年龄验证与商品购买。"
            tone="warning"
            action={
              <button
                type="button"
                onClick={() => {
                  void handleCredentialClaim();
                }}
                disabled={!canClaimCredential || localCredential.isClaiming}
                className="btn-primary"
              >
                {localCredential.isClaiming ? "正在领取..." : "领取年龄凭证"}
              </button>
            }
          />
        ) : null}

        {localCredential.status === "mismatch" ? (
          <StatePanel
            title="当前本地凭证属于其他账户"
            description="请切换到对应买家账户，或清除当前本地凭证后重新领取。"
            tone="warning"
            action={
              <button
                type="button"
                onClick={() => {
                  void localCredential.clearCredential();
                }}
                className="btn-outline"
              >
                清除本地凭证
              </button>
            }
          />
        ) : null}

        {credentialStale ? (
          <StatePanel
            title="当前凭证需要刷新"
            description="当前本地年龄凭证对应的资格集合已更新，请先刷新年龄凭证，再继续完成年龄验证。"
            tone="warning"
            action={
              <button
                type="button"
                onClick={() => {
                  void handleCredentialClaim();
                }}
                disabled={!canClaimCredential || localCredential.isClaiming}
                className="btn-primary"
              >
                {localCredential.isClaiming ? "正在刷新..." : "刷新年龄凭证"}
              </button>
            }
          />
        ) : null}

        {waitingForAdultDate ? (
          <StatePanel
            title="当前账户已在身份集合中"
            description={`当前本地凭证已准备完成，但将在 ${formatYmdDate(credential?.eligibleFromYmd)} 达到法定购酒年龄。届时无需重新领取凭证，只需重新完成一次年龄验证。`}
            tone="warning"
            action={
              <Link href="/buyer/verify" className="btn-outline">
                去查看验证状态
              </Link>
            }
          />
        ) : null}

        {localCredential.error && !credentialStale ? (
          <StatePanel
            title="当前本地凭证暂不可用"
            description={localCredential.error}
            tone="danger"
            action={
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    void handleCredentialClaim();
                  }}
                  disabled={!canClaimCredential || localCredential.isClaiming}
                  className="btn-primary"
                >
                  {localCredential.isClaiming ? "正在重新领取..." : "重新领取年龄凭证"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void localCredential.clearCredential();
                  }}
                  className="btn-outline"
                >
                  清除本地凭证
                </button>
              </div>
            }
          />
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <CredentialCard credential={credential} address={wallet.address} />
          <EligibilityCard
            eligibility={eligibilityQuery.data ?? null}
            currentSet={currentSet}
            eligibleFromYmd={credential?.eligibleFromYmd ?? null}
            currentDateYmd={currentDateYmd}
          />
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-amber">Products</p>
            <h2 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-brand-green">
              <ShoppingBag className="h-5 w-5" />
              推荐商品
            </h2>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              商品卡片会展示价格、库存和在售状态，便于你从资格确认直接过渡到详情页购买。
            </p>
          </div>
          <Link href="/buyer/orders" className="text-sm font-semibold text-brand-amber">
            查看全部订单
          </Link>
        </div>

        {productsQuery.isLoading ? (
          <StatePanel title="正在读取商品信息" description="正在整理当前可购商品，请稍候。" />
        ) : productsQuery.isError ? (
          <StatePanel
            title="商品摘要读取失败"
            description="当前暂时无法读取商品数据，请稍后刷新重试。"
            tone="danger"
          />
        ) : (
          <div className="grid max-w-[40rem] gap-3 justify-items-start sm:grid-cols-2">
            {products.map((product) => (
              <ProductCard key={product.productId} product={product} variant="compact" />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-amber">Orders</p>
            <h2 className="mt-1 text-2xl font-semibold text-brand-green">最近购买订单</h2>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              这里展示你最近完成的购买记录，方便快速确认最新订单状态。
            </p>
          </div>
          <StatusBadge tone={recentOrders.length ? "success" : "neutral"}>
            {recentOrders.length ? `${recentOrders.length} 条购买记录` : "暂无购买记录"}
          </StatusBadge>
        </div>
        <OrderList orders={recentOrders} products={products} />
      </section>
    </div>
  );
}
