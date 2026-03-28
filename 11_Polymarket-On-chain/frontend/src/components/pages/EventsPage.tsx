"use client";

import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { formatEther } from "viem";
import { useAccount, useBalance } from "wagmi";

import { EventCard } from "@/components/EventCard";
import { WalletButton } from "@/components/WalletButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useClientMounted } from "@/hooks/useClientMounted";
import { useEvents } from "@/hooks/useEvents";
import { useUserPortfolio } from "@/hooks/useUserPortfolio";
import { copy } from "@/lib/copy";
import { CHAIN_ID } from "@/lib/config";
import { EventState } from "@/lib/event-types";
import {
  extractEventTagFromUnknown,
  EVENT_TAGS,
  parseEventMetadata,
  resolveMetadataUri,
  type EventTag
} from "@/lib/event-metadata";

type AllTag = typeof copy.eventsPage.allTag;

/** 事件大厅固定标签栏配置（全部/金融/体育）。 */
const EVENT_FILTER_TAGS: Array<{ label: AllTag | EventTag; value: AllTag | EventTag; testId: "all" | "finance" | "sports" }> = [
  { label: copy.eventsPage.allTag, value: copy.eventsPage.allTag, testId: "all" },
  { label: EVENT_TAGS[0], value: EVENT_TAGS[0], testId: "finance" },
  { label: EVENT_TAGS[1], value: EVENT_TAGS[1], testId: "sports" }
];

/** 事件卡片渲染所需的轻量 metadata 数据。 */
type EventMetadataLite = {
  coverImageUrl: string | null;
  tag: EventTag | null;
};

const EMPTY_METADATA: EventMetadataLite = {
  coverImageUrl: null,
  tag: null
};

/** ETH 数值格式化（移除小数尾零）。 */
function formatCompactEth(value: bigint) {
  const raw = formatEther(value);
  return raw.includes(".") ? raw.replace(/\.?0+$/, "") : raw;
}

/** 根据 YES/NO 奖池计算前端展示概率，空池固定 50/50。 */
function probabilityFromPools(yesPool: bigint, noPool: bigint) {
  const total = yesPool + noPool;
  if (total === 0n) {
    return {
      yesProbability: 0.5,
      noProbability: 0.5,
      hasLiquidity: false
    };
  }
  return {
    yesProbability: Number(yesPool) / Number(total),
    noProbability: Number(noPool) / Number(total),
    hasLiquidity: true
  };
}

/** 兜底读取原始 metadata 中的 `coverImage` 字段。 */
function extractCoverImageFromRawMetadata(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const candidate = (raw as { coverImage?: unknown }).coverImage;
  if (typeof candidate !== "string") {
    return null;
  }
  const normalized = candidate.trim();
  return normalized.length > 0 ? normalized : null;
}

/** 事件大厅：标签筛选 + 事件卡片墙。 */
export function EventsPage() {
  const mounted = useClientMounted();
  const { address, isConnected } = useAccount();
  const connected = mounted && isConnected && !!address;
  const { data: events = [], isLoading, isError, error, refetch } = useEvents();
  const { data: portfolio = { totalPosition: 0n, totalClaimable: 0n, positions: [] } } = useUserPortfolio();
  const [activeTag, setActiveTag] = useState<AllTag | EventTag>(copy.eventsPage.allTag);
  const { data: balance, isError: isBalanceError } = useBalance({
    address: connected ? address : undefined,
    chainId: CHAIN_ID
  });

  const metadataQueries = useQueries({
    queries: events.map((event) => {
      const normalizedUri = (event.metadataURI ?? "").trim();
      return {
        queryKey: ["event-metadata-lite", normalizedUri || "none"],
        queryFn: async (): Promise<EventMetadataLite> => {
          const resolvedUrl = resolveMetadataUri(normalizedUri);
          if (!resolvedUrl) {
            return EMPTY_METADATA;
          }

          const response = await fetch(resolvedUrl, {
            method: "GET",
            cache: "no-store"
          });
          if (!response.ok) {
            return EMPTY_METADATA;
          }

          // 兼容两种 metadata 形态：优先读取规范结构，失败时回退原始字段。
          const raw = (await response.json()) as unknown;
          const teaching = parseEventMetadata(raw);
          const coverImageUri = teaching?.coverImage ?? extractCoverImageFromRawMetadata(raw);
          return {
            coverImageUrl: resolveMetadataUri(coverImageUri),
            tag: extractEventTagFromUnknown(raw)
          };
        },
        initialData: EMPTY_METADATA
      };
    })
  });

  const typedEvents = useMemo(
    () =>
      events
        .map((event, index) => ({
          event,
          tag: metadataQueries[index]?.data.tag ?? null,
          coverImageUrl: metadataQueries[index]?.data.coverImageUrl ?? null
        }))
        .filter((item): item is { event: (typeof events)[number]; tag: EventTag; coverImageUrl: string | null } => item.tag !== null),
    [events, metadataQueries]
  );

  const visibleEvents =
    activeTag === copy.eventsPage.allTag ? typedEvents : typedEvents.filter((item) => item.tag === activeTag);

  const isMetadataLoading = metadataQueries.length > 0 && metadataQueries.some((query) => query.fetchStatus === "fetching");
  const openEventCount = useMemo(() => events.filter((event) => event.state === EventState.Open).length, [events]);
  const totalEventCount = events.length;
  const eventStatsDisplay =
    isLoading || isError ? copy.common.noData : copy.eventsPage.eventStatsValue(openEventCount, totalEventCount);
  const balanceDisplay =
    connected && !isBalanceError && balance?.value !== undefined
      ? `${formatCompactEth(balance.value)} ETH`
      : copy.common.noData;
  const participatedDisplay = connected ? `${portfolio.positions.length} 个` : copy.common.noData;
  const claimableDisplay = connected ? `${formatCompactEth(portfolio.totalClaimable)} ETH` : copy.common.noData;

  return (
    <div className="space-y-6">
      <Card className="border-black/20 bg-gradient-to-br from-emerald-50/80 via-white to-cyan-50/70" data-testid="hall-overview-card">
        <CardContent className="space-y-4 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">{copy.eventsPage.overviewTitle}</h2>
              <p className="mt-1 text-sm text-neutral-600">{copy.eventsPage.overviewSubtitle}</p>
            </div>
            {!connected && (
              <div className="space-y-1 text-right" data-testid="hall-overview-connect">
                <WalletButton />
                <p className="text-xs text-neutral-500">{copy.eventsPage.connectHint}</p>
              </div>
            )}
          </div>

          <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <div className="rounded-xl border border-black/10 bg-white/85 p-3" data-testid="hall-overview-balance">
              <div className="text-[11px] text-neutral-500">{copy.eventsPage.balanceLabel}</div>
              <div className="mt-1 text-base font-semibold text-neutral-900">{balanceDisplay}</div>
            </div>
            <div className="rounded-xl border border-black/10 bg-white/85 p-3" data-testid="hall-overview-participated">
              <div className="text-[11px] text-neutral-500">{copy.eventsPage.participatedLabel}</div>
              <div className="mt-1 text-base font-semibold text-neutral-900">{participatedDisplay}</div>
            </div>
            <div className="rounded-xl border border-black/10 bg-white/85 p-3" data-testid="hall-overview-claimable">
              <div className="text-[11px] text-neutral-500">{copy.eventsPage.claimableLabel}</div>
              <div className="mt-1 text-base font-semibold text-neutral-900">{claimableDisplay}</div>
            </div>
            <div className="rounded-xl border border-black/10 bg-white/85 p-3" data-testid="hall-overview-event-stats">
              <div className="text-[11px] text-neutral-500">{copy.eventsPage.eventStatsLabel}</div>
              <div className="mt-1 text-base font-semibold text-neutral-900">{eventStatsDisplay}</div>
            </div>
          </section>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-wide">{copy.eventsPage.title}</h1>
        <div className="flex flex-wrap items-center gap-2" data-testid="event-tag-bar">
          {EVENT_FILTER_TAGS.map((tag) => (
            <Button
              key={tag.value}
              type="button"
              size="sm"
              variant={activeTag === tag.value ? "default" : "outline"}
              onClick={() => setActiveTag(tag.value)}
              data-testid={`event-tag-filter-${tag.testId}`}
            >
              {tag.label}
            </Button>
          ))}
        </div>
      </section>

      {isLoading || isMetadataLoading ? (
        <Card className="border-black/20">
          <CardContent className="py-6 text-sm text-neutral-500">{copy.common.loadingEvents}</CardContent>
        </Card>
      ) : isError ? (
        <Card className="border-black/20">
          <CardContent className="space-y-3 py-6 text-sm text-red-700">
            <div>{copy.eventsPage.loadFailed(error instanceof Error ? error.message : copy.common.retryLater)}</div>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              {copy.common.retry}
            </Button>
          </CardContent>
        </Card>
      ) : visibleEvents.length === 0 ? (
        <Card className="border-black/20">
          <CardContent className="py-6 text-sm text-neutral-500">
            {activeTag === copy.eventsPage.allTag ? copy.eventsPage.emptyAll : copy.eventsPage.emptyByTag(activeTag)}
          </CardContent>
        </Card>
      ) : (
        <section className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleEvents.map(({ event, tag, coverImageUrl }) => {
            const odds = probabilityFromPools(event.yesPool, event.noPool);
            return (
              <EventCard
                key={event.id.toString()}
                event={event}
                tag={tag}
                coverImageUrl={coverImageUrl}
                odds={{
                  yesProbability: odds.yesProbability,
                  noProbability: odds.noProbability,
                  hasLiquidity: odds.hasLiquidity
                }}
              />
            );
          })}
        </section>
      )}
    </div>
  );
}
