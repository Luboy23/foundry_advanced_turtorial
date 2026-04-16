"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { useRuntimeConfig } from "@/hooks/useRuntimeConfig";
import { readCurrentCredentialSet, readCurrentUtcDateYmd, readEligibilityStatus, readPendingBalance, readProduct, readRoleStatus, readWalletBalance } from "@/lib/contracts/query";
import { loadSampleProducts } from "@/lib/domain/examples";
import { buildMarketplaceProduct } from "@/lib/domain/products";
import { fetchBuyerOrders, fetchSellerOrders } from "@/lib/orders.client";
import { hasConfiguredContracts } from "@/lib/runtime-config";
import type { Address } from "@/types/contract-config";

// 这些缓存时间不是随意写的：
// 静态样例数据尽量常驻；角色/当前集合属于慢变链上状态；资格、商品状态和余额则需要更快刷新。
const STATIC_STALE_TIME = Number.POSITIVE_INFINITY;
const MEDIUM_STALE_TIME = 15_000;
const FAST_STALE_TIME = 10_000;

export function useRoleStatusQuery(address?: Address, options?: { enabled?: boolean }) {
  const config = useRuntimeConfig();
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ["role-status", address ?? "disconnected"],
    enabled: Boolean(publicClient && address && hasConfiguredContracts(config) && (options?.enabled ?? true)),
    staleTime: MEDIUM_STALE_TIME,
    queryFn: () => readRoleStatus(publicClient!, config, address!)
  });
}

// 当前资格集合是全局慢变真值，买家/年龄验证方/卖家多个页面都会依赖它。
export function useCurrentCredentialSetQuery(options?: { enabled?: boolean }) {
  const config = useRuntimeConfig();
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ["current-credential-set"],
    enabled: Boolean(publicClient && hasConfiguredContracts(config) && (options?.enabled ?? true)),
    staleTime: MEDIUM_STALE_TIME,
    queryFn: () => readCurrentCredentialSet(publicClient!, config)
  });
}

export function useEligibilityStatusQuery(address?: Address, options?: { enabled?: boolean }) {
  const config = useRuntimeConfig();
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ["eligibility", address ?? "disconnected"],
    enabled: Boolean(publicClient && address && hasConfiguredContracts(config) && (options?.enabled ?? true)),
    staleTime: FAST_STALE_TIME,
    queryFn: () => readEligibilityStatus(publicClient!, config, address!)
  });
}

export function useCurrentUtcDateYmdQuery(options?: { enabled?: boolean }) {
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ["current-date-ymd"],
    enabled: Boolean(publicClient && (options?.enabled ?? true)),
    staleTime: MEDIUM_STALE_TIME,
    queryFn: () => readCurrentUtcDateYmd(publicClient!)
  });
}

export function useSampleProductsQuery() {
  return useQuery({
    queryKey: ["sample-products"],
    staleTime: STATIC_STALE_TIME,
    queryFn: loadSampleProducts
  });
}

export function useMarketplaceProductsQuery(options?: { enabled?: boolean }) {
  const config = useRuntimeConfig();
  const publicClient = usePublicClient();
  const sampleProductsQuery = useSampleProductsQuery();

  const productStatesQuery = useQuery({
    queryKey: [
      "marketplace-product-states",
      sampleProductsQuery.data?.map((product) => product.productIdBytes32).join(",") ?? "empty"
    ],
    enabled: Boolean(
      publicClient &&
        sampleProductsQuery.data &&
        hasConfiguredContracts(config) &&
        (options?.enabled ?? true)
    ),
    staleTime: FAST_STALE_TIME,
    queryFn: async () =>
      Promise.all(
        sampleProductsQuery.data!.map(async (product) => {
          try {
            return await readProduct(publicClient!, config, product.productIdBytes32);
          } catch {
            return undefined;
          }
        })
      )
  });

  const data = useMemo(
    // 商品目录本身来自静态样例，链上只补当前价格、库存和在售状态；
    // 这里负责把“静态展示数据”和“链上真值”并成页面真正消费的 MarketplaceProduct。
    () =>
      (sampleProductsQuery.data ?? []).map((item, index) =>
        buildMarketplaceProduct(item, productStatesQuery.data?.[index])
      ),
    [productStatesQuery.data, sampleProductsQuery.data]
  );

  return {
    data,
    sampleProducts: sampleProductsQuery.data ?? [],
    chainStates: productStatesQuery.data ?? [],
    isLoading: sampleProductsQuery.isLoading || productStatesQuery.isLoading,
    isError: sampleProductsQuery.isError || productStatesQuery.isError,
    refetch: async () => {
      await Promise.all([sampleProductsQuery.refetch(), productStatesQuery.refetch()]);
    }
  };
}

// 订单不再由前端每次全量扫链，这里读的是服务端增量同步后的快照 API。
export function useBuyerOrdersApiQuery(address?: Address, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["buyer-orders-api", address ?? "disconnected"],
    enabled: Boolean(address && (options?.enabled ?? true)),
    staleTime: FAST_STALE_TIME,
    queryFn: async () => {
      const response = await fetchBuyerOrders(address!);
      return response.orders;
    }
  });
}

export function useSellerOrdersApiQuery(address?: Address, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["seller-orders-api", address ?? "disconnected"],
    enabled: Boolean(address && (options?.enabled ?? true)),
    staleTime: FAST_STALE_TIME,
    queryFn: async () => {
      const response = await fetchSellerOrders(address!);
      return response.orders;
    }
  });
}

export function usePendingBalanceQuery(address?: Address, options?: { enabled?: boolean }) {
  const config = useRuntimeConfig();
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ["seller-balance", address ?? "disconnected"],
    enabled: Boolean(publicClient && address && hasConfiguredContracts(config) && (options?.enabled ?? true)),
    staleTime: FAST_STALE_TIME,
    queryFn: () => readPendingBalance(publicClient!, config, address!)
  });
}

export function useWalletBalanceQuery(address?: Address, options?: { enabled?: boolean }) {
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ["wallet-balance", address ?? "disconnected"],
    enabled: Boolean(publicClient && address && (options?.enabled ?? true)),
    staleTime: FAST_STALE_TIME,
    queryFn: () => readWalletBalance(publicClient!, address!)
  });
}
