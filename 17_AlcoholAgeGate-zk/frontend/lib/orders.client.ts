import type { Address } from "@/types/contract-config";
import type { MarketplaceOrder } from "@/types/domain";

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as { error?: string } & T | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "当前未能读取订单数据，请稍后重试。");
  }

  if (!payload) {
    throw new Error("当前未能读取订单响应，请稍后重试。");
  }

  return payload as T;
}

type ApiMarketplaceOrder = Omit<MarketplaceOrder, "totalPriceWei"> & {
  totalPriceWei: string;
};

function hydrateOrders(orders: ApiMarketplaceOrder[]): MarketplaceOrder[] {
  return orders.map((order) => ({
    ...order,
    totalPriceWei: BigInt(order.totalPriceWei)
  }));
}

export function fetchBuyerOrders(address: Address) {
  return fetch(`/api/buyer/orders?address=${address}`, {
    cache: "no-store"
  }).then(async (response) => {
    const payload = await parseJsonResponse<{ orders: ApiMarketplaceOrder[] }>(response);
    return {
      orders: hydrateOrders(payload.orders)
    };
  });
}

export function fetchSellerOrders(address: Address) {
  return fetch(`/api/seller/orders?address=${address}`, {
    cache: "no-store"
  }).then(async (response) => {
    const payload = await parseJsonResponse<{ orders: ApiMarketplaceOrder[] }>(response);
    return {
      orders: hydrateOrders(payload.orders)
    };
  });
}
