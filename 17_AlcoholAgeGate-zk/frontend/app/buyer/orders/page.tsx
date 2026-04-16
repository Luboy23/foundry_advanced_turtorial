"use client";

import { useMemo } from "react";
import { FailureHistoryList } from "@/components/buyer/FailureHistoryList";
import { OrderList } from "@/components/buyer/OrderList";
import { AccessGuardHero } from "@/components/shared/AccessGuardHero";
import { StatePanel } from "@/components/shared/StatePanel";
import { useBuyerOrdersApiQuery, useRoleStatusQuery, useSampleProductsQuery } from "@/hooks/useAppQueries";
import { getBuyerRoleAccessState } from "@/lib/access";
import { useFailureHistory } from "@/hooks/useFailureHistory";
import { useRuntimeConfig } from "@/hooks/useRuntimeConfig";
import { useWalletStatus } from "@/hooks/useWalletStatus";
import { buildMarketplaceProduct } from "@/lib/domain/products";

export default function BuyerOrdersPage() {
  const config = useRuntimeConfig();
  const wallet = useWalletStatus(config.chainId);
  const failureHistory = useFailureHistory();
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
  const productsQuery = useSampleProductsQuery();
  const ordersQuery = useBuyerOrdersApiQuery(wallet.address, {
    enabled: buyerAccess.allowed
  });

  const products = useMemo(
    () => (productsQuery.data ?? []).map((item) => buildMarketplaceProduct(item)),
    [productsQuery.data]
  );

  if (!buyerAccess.allowed) {
    return (
      <AccessGuardHero
        pageLabel="买家订单"
        title="当前不能进入买家订单页"
        reason={buyerAccess.description ?? "当前钱包没有进入买家订单页的权限。"}
      />
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-brand-green">订单记录</h1>
        <p className="mt-2 text-sm text-text-muted">这里集中查看你的购买订单和最近的异常记录。</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-brand-green">购买订单</h2>
        {ordersQuery.isLoading ? (
          <StatePanel title="正在读取订单记录" description="系统正在整理你的购买记录，请稍候。" />
        ) : ordersQuery.isError ? (
          <StatePanel title="读取订单失败" description="当前暂时无法读取订单记录，请检查网络后重试。" tone="danger" />
        ) : (
          <OrderList orders={ordersQuery.data ?? []} products={products} />
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-brand-green">异常记录</h2>
        <FailureHistoryList entries={failureHistory.entries} />
      </section>
    </div>
  );
}
