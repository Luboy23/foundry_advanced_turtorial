import type { MarketplaceOrder, MarketplaceProduct } from "@/types/domain";
import { formatDateTime, formatEth } from "@/lib/utils";
import { StatePanel } from "@/components/shared/StatePanel";

type OrderListProps = {
  orders: MarketplaceOrder[];
  products: MarketplaceProduct[];
};

export function OrderList({ orders, products }: OrderListProps) {
  if (!orders.length) {
    return <StatePanel title="暂无购买订单" description="完成年龄资格验证并下单后，这里会显示你的购买记录。" />;
  }

  const nameMap = new Map(products.map((product) => [product.productId, product.displayName]));

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <article key={order.orderId} className="glass-card flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-brand-green">{nameMap.get(order.productId) ?? "商品订单"}</p>
            <p className="text-xs font-mono text-text-muted">{order.orderId}</p>
          </div>
          <div className="grid gap-2 text-sm text-text-muted md:text-right">
            <span>{order.quantity} 件 · {formatEth(order.totalPriceWei)}</span>
            <span>{formatDateTime(order.purchasedAt)}</span>
          </div>
        </article>
      ))}
    </div>
  );
}
