"use client";

import { useMemo, useState, type ReactNode } from "react";
import { formatEther } from "viem";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTimestamp, shortAddress } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  useChainActivity,
  type ChainActivityItem,
  type ChainActivityScope
} from "@/hooks/useChainActivity";

type TradeTab = "all" | "buy" | "sell";

// 业务类型到中文标签映射，保证列表和筛选语义一致
const kindLabels: Record<ChainActivityItem["kind"], string> = {
  mint: "铸造",
  burn: "销毁",
  approve: "授权",
  approve_all: "全局授权",
  listed: "上架",
  cancelled: "取消",
  bought: "成交",
  invalidated: "失效清理"
};

const toneClasses: Record<
  ChainActivityItem["tone"],
  { bar: string; tag: string; panel: string }
> = {
  emerald: {
    bar: "bg-emerald-500",
    tag: "border-emerald-200 bg-emerald-50 text-emerald-700",
    panel: "border-emerald-100 bg-emerald-50/40"
  },
  rose: {
    bar: "bg-rose-500",
    tag: "border-rose-200 bg-rose-50 text-rose-700",
    panel: "border-rose-100 bg-rose-50/40"
  },
  amber: {
    bar: "bg-amber-500",
    tag: "border-amber-200 bg-amber-50 text-amber-700",
    panel: "border-amber-100 bg-amber-50/40"
  },
  sky: {
    bar: "bg-sky-500",
    tag: "border-sky-200 bg-sky-50 text-sky-700",
    panel: "border-sky-100 bg-sky-50/40"
  }
};

const sideClasses: Record<Exclude<TradeTab, "all">, string> = {
  buy: "border-emerald-200 bg-emerald-50 text-emerald-700",
  sell: "border-rose-200 bg-rose-50 text-rose-700"
};

const formatPrice = (value?: bigint) => {
  if (value === undefined) return "-";
  const amount = Number(formatEther(value));
  if (!Number.isFinite(amount)) return "-";
  return `${amount.toLocaleString("zh-CN", { maximumFractionDigits: 6 })} ETH`;
};

const hasMeaningfulValue = (value: ReactNode) => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "" && value !== "-";
  return true;
};

const ActivityDataField = ({
  label,
  value,
  valueClassName,
  fullWidth = false
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
  fullWidth?: boolean;
}) => (
  <div
    className={cn(
      "rounded-lg border border-slate-200/80 bg-gradient-to-br from-white to-slate-50 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]",
      fullWidth && "sm:col-span-2"
    )}
  >
    <p className="u-text-mini font-semibold uppercase tracking-[0.16em] text-slate-500">
      {label}
    </p>
    <p className={cn("u-text-body mt-1 font-semibold text-slate-900", valueClassName)}>
      {value}
    </p>
  </div>
);

export const ActivityPanel = ({
  sticky = true,
  className,
  defaultOpen = true,
  mode = "mint_ops"
}: {
  sticky?: boolean;
  className?: string;
  defaultOpen?: boolean;
  mode?: ChainActivityScope;
}) => {
  const { items, loading, error, lastUpdated, loadActivity } = useChainActivity(mode);
  const [open, setOpen] = useState(defaultOpen);
  const [tradeTab, setTradeTab] = useState<TradeTab>("all");

  const isMarketMode = mode === "market_trades";
  const title = isMarketMode ? "交易记录" : "操作记录";
  const subtitle = isMarketMode
    ? "链上交易事件索引（刷新后可回放）"
    : "链上操作事件索引（刷新后可回放）";

  const filteredItems = useMemo(() => {
    // 市场模式支持按“买入/售卖”二级筛选；铸造模式直接全量展示
    if (!isMarketMode || tradeTab === "all") return items;
    return items.filter((item) => item.tradeSides?.includes(tradeTab));
  }, [isMarketMode, items, tradeTab]);

  return (
    <Card
      className={cn(
        "rounded-2xl border-0 bg-transparent shadow-none",
        sticky && "sticky top-6",
        className
      )}
    >
      <CardHeader className="u-stack-3">
        <div className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <p className="u-text-meta mt-1 text-slate-500">{subtitle}</p>
          </div>
          <div className="flex items-center u-gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => loadActivity()}
              disabled={loading}
              className="u-text-meta h-8 px-3"
            >
              {loading ? "刷新中" : "刷新"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen((prev) => !prev)}
              className="u-text-meta h-8 px-3"
            >
              {open ? "收起" : "展开"}
            </Button>
          </div>
        </div>

        {isMarketMode ? (
          <div className="flex flex-wrap items-center u-gap-2">
            <Button
              type="button"
              variant={tradeTab === "all" ? "primary" : "secondary"}
              className="u-text-mini h-7 rounded-full px-3"
              onClick={() => setTradeTab("all")}
            >
              全部
            </Button>
            <Button
              type="button"
              variant={tradeTab === "buy" ? "primary" : "secondary"}
              className="u-text-mini h-7 rounded-full px-3"
              onClick={() => setTradeTab("buy")}
            >
              买入
            </Button>
            <Button
              type="button"
              variant={tradeTab === "sell" ? "primary" : "secondary"}
              className="u-text-mini h-7 rounded-full px-3"
              onClick={() => setTradeTab("sell")}
            >
              售卖
            </Button>
          </div>
        ) : null}
      </CardHeader>
      {open ? (
        <CardContent>
          {error ? (
            <p className="u-text-body text-rose-600">{error}</p>
          ) : filteredItems.length === 0 ? (
            <p className="u-text-body text-slate-500">
              {loading
                ? "索引链上事件中..."
                : isMarketMode
                  ? "暂无交易记录"
                  : "暂无操作记录"}
            </p>
          ) : (
            <div className="u-stack-3">
              {filteredItems.map((entry) => {
                const tone = toneClasses[entry.tone];
                const allSides = isMarketMode
                  ? (entry.tradeSides ?? []).filter(
                      (side): side is "buy" | "sell" =>
                        side === "buy" || side === "sell"
                    )
                  : [];
                const sides =
                  isMarketMode && tradeTab !== "all"
                    ? allSides.filter((side) => side === tradeTab)
                    : allSides;
                const displayDetail =
                  isMarketMode &&
                  tradeTab === "sell" &&
                  entry.kind === "bought" &&
                  entry.listingId !== undefined
                    // 在“售卖”视图下，成交记录优先突出挂单语义，避免与买入视图重复信息
                    ? `挂单 #${entry.listingId.toString()}`
                    : entry.detail;
                const marketFields: Array<{
                  label: string;
                  value: ReactNode;
                  valueClassName?: string;
                  fullWidth?: boolean;
                }> = [];

                if (entry.tokenId !== undefined) {
                  marketFields.push({
                    label: "Token ID",
                    value: `#${entry.tokenId.toString()}`
                  });
                }
                if (entry.price !== undefined) {
                  marketFields.push({
                    label: "价格",
                    value: formatPrice(entry.price),
                    valueClassName: "font-bold tabular-nums text-rose-600"
                  });
                }
                if (tradeTab !== "sell" && entry.buyer) {
                  marketFields.push({
                    label: "买家",
                    value: shortAddress(entry.buyer),
                    valueClassName: "font-mono u-text-meta text-slate-700"
                  });
                }
                if (entry.seller) {
                  marketFields.push({
                    label: tradeTab === "buy" ? "卖家" : "卖家",
                    value: shortAddress(entry.seller),
                    valueClassName: "font-mono u-text-meta text-slate-700"
                  });
                }
                if (entry.listingId !== undefined) {
                  marketFields.push({
                    label: "挂单 ID",
                    value: `#${entry.listingId.toString()}`
                  });
                }
                if (entry.txHash) {
                  marketFields.push({
                    label: "交易哈希",
                    value: shortAddress(entry.txHash),
                    valueClassName: "font-mono u-text-meta text-slate-700"
                  });
                }
                const visibleMarketFields = marketFields.filter((field) =>
                  hasMeaningfulValue(field.value)
                );
                // 自动隐藏无数据字段，避免面板出现大量占位“—”

                return (
                  <div
                    key={entry.id}
                    className={cn(
                      "relative overflow-hidden rounded-xl border p-3 pl-4",
                      tone.panel
                    )}
                  >
                    <span className={cn("absolute inset-y-0 left-0 w-1", tone.bar)} />

                    <div className="flex items-start justify-between u-gap-2">
                      <div className="u-stack-1">
                        <div className="flex flex-wrap items-center u-gap-2">
                          <span
                            className={cn(
                              "u-text-mini rounded-full border px-2 py-0.5 font-semibold",
                              tone.tag
                            )}
                          >
                            {kindLabels[entry.kind]}
                          </span>
                          {sides.map((side) => (
                            <span
                              key={`${entry.id}-${side}`}
                              className={cn(
                                "u-text-mini rounded-full border px-2 py-0.5 font-semibold",
                                sideClasses[side]
                              )}
                            >
                              {side === "buy" ? "买入" : "售卖"}
                            </span>
                          ))}
                        </div>
                        <p className="u-text-body font-semibold text-slate-900">
                          {entry.label}
                        </p>
                      </div>
                      <span className="u-text-mini text-slate-500">
                        {formatTimestamp(entry.timestamp)}
                      </span>
                    </div>

                    {displayDetail ? (
                      <p className="u-text-meta mt-1 text-slate-600">{displayDetail}</p>
                    ) : null}

                    {isMarketMode && visibleMarketFields.length > 0 ? (
                      <div className="mt-2 grid u-gap-2 sm:grid-cols-2">
                        {visibleMarketFields.map((field, index) => (
                          <ActivityDataField
                            key={`${entry.id}-field-${field.label}-${index}`}
                            label={field.label}
                            value={field.value}
                            valueClassName={field.valueClassName}
                            fullWidth={field.fullWidth}
                          />
                        ))}
                      </div>
                    ) : null}

                    {entry.txHash && !isMarketMode ? (
                      <div className="mt-2 rounded-lg border border-slate-200/80 bg-white/70 px-3 py-2">
                        <p className="u-text-mini font-semibold uppercase tracking-[0.16em] text-slate-500">
                          交易哈希
                        </p>
                        <p className="u-text-meta mt-1 font-mono text-slate-700">
                          {shortAddress(entry.txHash)}
                        </p>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
          {lastUpdated ? (
            <p className="u-text-mini mt-3 text-slate-500">
              更新 {new Date(lastUpdated).toLocaleTimeString("zh-CN")}
            </p>
          ) : null}
        </CardContent>
      ) : (
        <CardContent>
          <p className="u-text-meta text-slate-500">折叠</p>
        </CardContent>
      )}
    </Card>
  );
};
