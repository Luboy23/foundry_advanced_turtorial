"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePublicClient, useWalletClient } from "wagmi";
import { BalanceCard } from "@/components/seller/BalanceCard";
import { PurchaseHistoryTable } from "@/components/seller/PurchaseHistoryTable";
import { ProductEditorCard } from "@/components/seller/ProductEditorCard";
import { WalletBalanceCard } from "@/components/seller/WalletBalanceCard";
import { AccessGuardHero } from "@/components/shared/AccessGuardHero";
import { StatePanel } from "@/components/shared/StatePanel";
import {
  useMarketplaceProductsQuery,
  usePendingBalanceQuery,
  useRoleStatusQuery,
  useSellerOrdersApiQuery,
  useWalletBalanceQuery
} from "@/hooks/useAppQueries";
import { useRuntimeConfig } from "@/hooks/useRuntimeConfig";
import { useWalletStatus } from "@/hooks/useWalletStatus";
import { getDemoRoleAccessState } from "@/lib/access";
import { alcoholMarketplaceAbi } from "@/lib/contracts/abis";
import { usePendingActionStore } from "@/hooks/usePendingActionStore";
import { useActionFeedback } from "@/hooks/useActionFeedback";
import { getFriendlyErrorMessage } from "@/lib/friendly-errors";

export default function SellerPage() {
  const config = useRuntimeConfig();
  const wallet = useWalletStatus(config.chainId);
  const sellerAccess = getDemoRoleAccessState({ role: "seller", isConnected: wallet.isConnected, wrongChain: wallet.wrongChain, address: wallet.address, config });
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { showError, showSuccess } = useActionFeedback();
  const { upsert: upsertPendingAction, clear: clearPendingAction, findByKind } = usePendingActionStore();
  const [withdrawStatus, setWithdrawStatus] = useState<"idle" | "confirming">("idle");

  const roleQuery = useRoleStatusQuery(wallet.address, {
    enabled: sellerAccess.allowed
  });

  const productsQuery = useMarketplaceProductsQuery({
    enabled: sellerAccess.allowed
  });

  const balanceQuery = usePendingBalanceQuery(wallet.address, {
    enabled: sellerAccess.allowed
  });

  const walletBalanceQuery = useWalletBalanceQuery(wallet.address, {
    enabled: sellerAccess.allowed
  });

  const sellerOrdersQuery = useSellerOrdersApiQuery(wallet.address, {
    enabled: sellerAccess.allowed
  });

  const products = useMemo(() => (productsQuery.data ?? []).map((product) => ({ product })), [productsQuery.data]);
  const pendingWithdrawAction = findByKind("withdraw");
  const refetchPendingBalance = balanceQuery.refetch;
  const refetchWalletBalance = walletBalanceQuery.refetch;
  const refetchProducts = productsQuery.refetch;
  const withdrawStartedLocallyRef = useRef(false);

  const blocked =
    !wallet.isConnected
      ? "请先连接卖家钱包。"
      : wallet.wrongChain
        ? "当前网络不正确，请切换到项目链。"
        : !wallet.hasWalletClient
          ? "当前钱包尚未完成授权，请点击右上角重新连接钱包后再试。"
          : roleQuery.data && !roleQuery.data.isSeller
            ? "当前钱包没有卖家权限，无法操作商品和提现。"
            : null;

  useEffect(() => {
    if (
      withdrawStartedLocallyRef.current ||
      !pendingWithdrawAction ||
      pendingWithdrawAction.ownerAddress?.toLowerCase() !== wallet.address?.toLowerCase() ||
      !publicClient
    ) {
      return;
    }

    let active = true;
    setWithdrawStatus("confirming");

    void (async () => {
      try {
        await publicClient.waitForTransactionReceipt({ hash: pendingWithdrawAction.txHash });
        clearPendingAction("withdraw");
        if (!active) {
          return;
        }
        await Promise.all([refetchPendingBalance(), refetchWalletBalance()]);
        showSuccess({
          title: "提现已完成",
          description: "待提现余额已经完成链上确认，并转入当前卖家钱包。"
        });
      } catch (error) {
        clearPendingAction("withdraw");
        if (!active) {
          return;
        }
        showError({
          title: "提现失败",
          description: getFriendlyErrorMessage(error, "seller-withdraw")
        });
      } finally {
        if (active) {
          setWithdrawStatus("idle");
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [clearPendingAction, pendingWithdrawAction, publicClient, refetchPendingBalance, refetchWalletBalance, showError, showSuccess, wallet.address]);

  if (!sellerAccess.allowed) {
    return (
      <AccessGuardHero
        pageLabel="卖家中心"
        title="当前不能进入卖家页面"
        reason={sellerAccess.description ?? "当前钱包没有进入卖家页面的权限。"}
      />
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-brand-green">卖家中心</h1>
        <p className="mt-2 text-sm text-text-muted">管理商品、库存、价格与待结算货款。</p>
      </div>

      {blocked ? <StatePanel title="当前不能执行卖家操作" description={blocked} tone="warning" /> : null}

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-brand-green">资金概览</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <BalanceCard
            pendingBalance={balanceQuery.data ?? 0n}
            disabled={Boolean(blocked) || (balanceQuery.data ?? 0n) === 0n}
            pendingAction={pendingWithdrawAction}
            onWithdraw={async () => {
              if (!walletClient) {
                throw new Error("当前钱包尚未完成授权，请点击右上角重新连接钱包后再试。");
              }
              if (!publicClient) {
                throw new Error("当前页面尚未准备好，请稍后再试。");
              }

              try {
                setWithdrawStatus("confirming");
                withdrawStartedLocallyRef.current = true;
                const hash = await walletClient.writeContract({
                  abi: alcoholMarketplaceAbi,
                  address: config.marketplaceAddress,
                  functionName: "withdraw",
                  account: walletClient.account
                });
                upsertPendingAction({
                  kind: "withdraw",
                  txHash: hash,
                  startedAt: Date.now(),
                  ownerAddress: wallet.address
                });
                await publicClient.waitForTransactionReceipt({ hash });
                clearPendingAction("withdraw");
                await Promise.all([refetchPendingBalance(), refetchWalletBalance()]);
                showSuccess({
                  title: "提现已完成",
                  description: "待提现余额已经完成链上确认，并转入当前卖家钱包。"
                });
              } catch (error) {
                clearPendingAction("withdraw");
                showError({
                  title: "提现失败",
                  description: getFriendlyErrorMessage(error, "seller-withdraw")
                });
                throw error;
              } finally {
                withdrawStartedLocallyRef.current = false;
                setWithdrawStatus("idle");
              }
            }}
          />
          <WalletBalanceCard
            address={wallet.address}
            balance={walletBalanceQuery.data ?? 0n}
            loading={walletBalanceQuery.isLoading}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-brand-green">商品管理</h2>
        {productsQuery.isLoading ? (
          <StatePanel title="正在读取商品状态" description="正在整理当前商品信息，请稍候。" />
        ) : productsQuery.isError ? (
          <StatePanel title="商品读取失败" description="当前暂时无法读取商品信息，请检查网络后重试。" tone="danger" />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {products.map(({ product }) => (
              <ProductEditorCard
                key={product.productId}
                product={product}
                onUpdate={async (next) => {
                  if (!walletClient) {
                    throw new Error("当前钱包尚未完成授权，请点击右上角重新连接钱包后再试。");
                  }
                  if (!publicClient) {
                    throw new Error("当前页面尚未准备好，请稍后再试。");
                  }

                  const hash = await walletClient.writeContract({
                    abi: alcoholMarketplaceAbi,
                    address: config.marketplaceAddress,
                    functionName: "setProduct",
                    args: [product.productId, next.priceWei, next.stock, next.active, product.metadataURI],
                    account: walletClient.account
                  });

                  await publicClient.waitForTransactionReceipt({ hash });
                  await refetchProducts();
                  await refetchPendingBalance();
                }}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-brand-green">购买历史</h2>
        {sellerOrdersQuery.isLoading ? (
          <StatePanel title="正在整理购买历史" description="正在汇总历史购买记录，请稍候。" />
        ) : sellerOrdersQuery.isError ? (
          <StatePanel title="购买历史读取失败" description="当前暂时无法读取购买历史，请检查网络后重试。" tone="danger" />
        ) : (
          <PurchaseHistoryTable
            orders={sellerOrdersQuery.data ?? []}
            products={products.map(({ product }) => product)}
          />
        )}
      </section>
    </div>
  );
}
