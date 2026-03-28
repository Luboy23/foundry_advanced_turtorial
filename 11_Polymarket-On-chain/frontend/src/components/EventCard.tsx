import Link from "next/link";
import { formatEther } from "viem";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { EventState, eventStateLabel, type EventEntity } from "@/lib/event-types";
import { type EventTag } from "@/lib/event-metadata";

const stateBadgeVariant: Record<EventState, "default" | "secondary" | "outline"> = {
  [EventState.Open]: "default",
  [EventState.Closed]: "secondary",
  [EventState.Proposed]: "secondary",
  [EventState.Resolved]: "outline"
};

/** 事件卡片使用的摘要实体类型。 */
export type EventSummary = EventEntity;

/** 首页卡片展示所需的概率与流动性派生数据。 */
export type EventCardOdds = {
  yesProbability: number | null;
  noProbability: number | null;
  hasLiquidity: boolean;
};

/** 概率展示格式：`0.57 -> 57%`，空值展示占位符。 */
function formatProbabilityLabel(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return copy.common.noData;
  }
  return `${Math.round(value * 100)}%`;
}

/** ETH 数量格式化为可读文本。 */
function formatAmount(value: bigint) {
  return `${formatEther(value)} ETH`;
}

/** 将概率转换为整数百分比，用于中心环形视觉。 */
function formatPercentNumber(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return null;
  }
  return Math.round(value * 100);
}

/** 事件大厅卡片：展示标题、状态、标签、概率、奖池规模与跳转入口。 */
export function EventCard({
  event,
  tag,
  coverImageUrl,
  odds,
  formatAmountLabel = formatAmount
}: {
  event: EventSummary;
  tag: EventTag;
  coverImageUrl: string | null;
  odds: EventCardOdds;
  formatAmountLabel?: (value: bigint) => string;
}) {
  const closeTime = new Date(Number(event.closeTime) * 1000).toLocaleString();
  const yesLabel = formatProbabilityLabel(odds.yesProbability);
  const noLabel = formatProbabilityLabel(odds.noProbability);
  const yesPercent = formatPercentNumber(odds.yesProbability);
  const noPercent = formatPercentNumber(odds.noProbability);
  const dominantIsYes =
    yesPercent === null ? noPercent === null : noPercent === null || yesPercent >= noPercent;
  const centerTextColorClass = dominantIsYes ? "text-emerald-700" : "text-rose-700";
  const yesRingPercent = yesPercent ?? 50;
  const yesRingStyle = {
    background:
      yesPercent === null
        ? "conic-gradient(#e5e7eb 100%, #e5e7eb 100%)"
        : `conic-gradient(#10b981 ${yesRingPercent}%, #f43f5e ${yesRingPercent}% 100%)`
  } as const;
  const yesBarWidth = yesPercent === null ? 50 : Math.max(8, Math.min(92, yesPercent));

  return (
    <Card className="group relative overflow-hidden rounded-2xl border border-black/15 bg-white/95 p-0 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:border-black/30 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-black/25 to-transparent" />
      <div className="space-y-3 p-3.5 sm:p-4">
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex min-w-0 items-start gap-2.5">
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-black/10 bg-neutral-100 shadow-sm">
              {coverImageUrl ? (
                // 封面图使用普通 img，避免 next/image 对动态来源地址的额外域名配置依赖。
                <img src={coverImageUrl} alt={copy.eventCard.coverAlt(event.question)} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500">{copy.eventCard.noCover}</div>
              )}
            </div>
            <div className="min-w-0 space-y-1.5">
              <h3 className="line-clamp-2 text-base font-semibold leading-snug text-neutral-900 sm:text-lg">{event.question}</h3>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500">
                <Badge variant={stateBadgeVariant[event.state]} className="rounded-md px-1.5 py-0 text-[11px]">
                  {eventStateLabel[event.state]}
                </Badge>
                <Badge variant="outline" className="rounded-md px-1.5 py-0 text-[11px]">
                  {tag}
                </Badge>
                <span>{copy.common.eventNumber(event.id.toString())}</span>
              </div>
              <div className="text-[11px] text-neutral-500">{copy.eventCard.closeTime(closeTime)}</div>
            </div>
          </div>

          <div className="relative h-14 w-14 shrink-0 rounded-full p-[4px] sm:h-16 sm:w-16" style={yesRingStyle}>
            <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white shadow-inner">
              <span className={`text-base font-semibold leading-none sm:text-lg ${centerTextColorClass}`}>
                {yesPercent === null ? copy.common.noData : `${yesPercent}%`}
              </span>
              <span className={`mt-0.5 text-[10px] font-medium ${centerTextColorClass}`}>{copy.common.yes}</span>
            </div>
          </div>
        </div>

        <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200/90">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: `${yesBarWidth}%` }} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link
            href={`/events/${event.id.toString()}`}
            className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/80 px-2.5 py-2 text-sm transition-colors hover:bg-emerald-100/70"
          >
            <span className="text-sm font-semibold leading-none text-emerald-700">{copy.common.yes}</span>
            <span className="text-xs font-semibold text-emerald-700">{yesLabel}</span>
          </Link>
          <Link
            href={`/events/${event.id.toString()}`}
            className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50/80 px-2.5 py-2 text-sm transition-colors hover:bg-rose-100/70"
          >
            <span className="text-sm font-semibold leading-none text-rose-700">{copy.common.no}</span>
            <span className="text-xs font-semibold text-rose-700">{noLabel}</span>
          </Link>
        </div>

        <div className="flex items-center justify-between border-t border-black/10 pt-1 text-xs text-neutral-500 sm:text-sm">
          <span>{copy.eventCard.poolSize(formatAmountLabel(event.totalCollateral))}</span>
          <Button asChild variant="ghost" size="sm" className="h-7 rounded-md px-2 text-xs text-neutral-700" data-testid="event-card-open-detail">
            <Link href={`/events/${event.id.toString()}`}>{copy.eventCard.openEvent}</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
