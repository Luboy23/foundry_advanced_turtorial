import { NextResponse } from "next/server";
import { isAddress } from "viem";
import type { Address } from "@/types/contract-config";
import type { MarketplaceOrder } from "@/types/domain";
import { getServerPublicClient, getServerRuntimeConfig } from "@/lib/server/public-client";
import { readBuyerOrdersSnapshot } from "@/lib/server/order-snapshots";

export const runtime = "nodejs";

function serializeOrders(orders: MarketplaceOrder[]) {
  return orders.map((order) => ({
    ...order,
    totalPriceWei: order.totalPriceWei.toString()
  }));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");

    if (!address || !isAddress(address)) {
      return NextResponse.json({ error: "请提供有效的钱包地址。" }, { status: 400 });
    }

    const publicClient = getServerPublicClient();
    const config = getServerRuntimeConfig();
    const orders = await readBuyerOrdersSnapshot(publicClient, config, address as Address);
    return NextResponse.json({ orders: serializeOrders(orders) });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "当前未能读取买家订单，请稍后重试。"
      },
      { status: 500 }
    );
  }
}
