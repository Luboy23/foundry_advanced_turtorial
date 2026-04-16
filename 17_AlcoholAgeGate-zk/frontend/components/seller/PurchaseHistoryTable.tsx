"use client";

import { useMemo, useState } from "react";
import type { MarketplaceOrder, MarketplaceProduct } from "@/types/domain";
import { formatDateTime, formatEth } from "@/lib/utils";
import { StatePanel } from "@/components/shared/StatePanel";

const PAGE_SIZE = 10;

type PurchaseHistoryTableProps = {
  orders: MarketplaceOrder[];
  products: MarketplaceProduct[];
};

export function PurchaseHistoryTable({ orders, products }: PurchaseHistoryTableProps) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const currentOrders = useMemo(
    () => orders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [currentPage, orders]
  );

  if (!orders.length) {
    return (
      <StatePanel
        title="暂无购买历史"
        description="当买家完成购买后，这里会显示买家地址、下单时间、数量和金额。"
      />
    );
  }

  const productNameMap = new Map(products.map((product) => [product.productId, product.displayName]));

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[1.8rem] border border-brand-green/10 bg-surface shadow-sm">
        <div className="grid min-w-[840px] grid-cols-[2.2fr_1.1fr_0.7fr_1fr_1.2fr] gap-3 bg-bg-ivory px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
          <span>买家地址</span>
          <span>商品</span>
          <span>数量</span>
          <span>金额</span>
          <span>下单时间</span>
        </div>
        <div className="overflow-x-auto">
          <div className="max-h-[20.5rem] min-w-[840px] overflow-y-auto">
            {currentOrders.map((order) => (
              <div
                key={order.orderId}
                className="grid grid-cols-[2.2fr_1.1fr_0.7fr_1fr_1.2fr] gap-3 border-t border-brand-green/8 px-5 py-4 text-sm"
              >
                <div className="overflow-x-auto whitespace-nowrap font-mono text-[13px] leading-5 text-brand-green">
                  {order.buyer}
                </div>
                <div className="text-text-muted">{productNameMap.get(order.productId) ?? "商品订单"}</div>
                <div className="text-text-muted">{order.quantity}</div>
                <div className="font-semibold text-brand-green">{formatEth(order.totalPriceWei)}</div>
                <div className="text-text-muted">{formatDateTime(order.purchasedAt)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm leading-6 text-text-muted">
          当前共 {orders.length} 条记录。每页最多 10 条，表格固定显示 5 条高度，超过后可在表格内继续滚动查看。
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={currentPage === 1}
            className="btn-outline px-4 py-2 disabled:opacity-50"
          >
            上一页
          </button>
          <span className="text-sm font-semibold text-brand-green">
            第 {currentPage} / {totalPages} 页
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={currentPage === totalPages}
            className="btn-outline px-4 py-2 disabled:opacity-50"
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  );
}
