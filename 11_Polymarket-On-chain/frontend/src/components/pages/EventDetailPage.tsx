"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount, useChainId } from "wagmi";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useClientMounted } from "@/hooks/useClientMounted";
import { useEventActions } from "@/hooks/useEventActions";
import { useEvent } from "@/hooks/useEvent";
import { useEventMetadata } from "@/hooks/useEventMetadata";
import { useRedeemPreview } from "@/hooks/useRedeemPreview";
import { type ActivityKind, type UserActivityItem, useUserActivity } from "@/hooks/useUserActivity";
import { useUserPosition } from "@/hooks/useUserPosition";
import { copy } from "@/lib/copy";
import { CHAIN_ID } from "@/lib/config";
import { EventState, Outcome, PositionSide, eventStateLabel, outcomeLabel, positionSideLabel } from "@/lib/event-types";
import { resolveMetadataUri } from "@/lib/event-metadata";

const stateBadgeVariant: Record<EventState, "default" | "secondary" | "outline"> = {
  [EventState.Open]: "default",
  [EventState.Closed]: "secondary",
  [EventState.Proposed]: "secondary",
  [EventState.Resolved]: "outline"
};

const activityLabel: Record<ActivityKind, string> = {
  event_created: copy.eventActivityKind.event_created,
  position_bought: copy.eventActivityKind.position_bought,
  resolution_proposed: copy.eventActivityKind.resolution_proposed,
  resolution_finalized: copy.eventActivityKind.resolution_finalized,
  redeemed: copy.eventActivityKind.redeemed
};

const QUICK_BUY_PRESETS = ["0.05", "0.1", "0.5", "1"] as const;

/** 根据奖池计算显示概率；空池固定展示 50/50。 */
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

/** 小数概率格式化为百分比文本。 */
function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

/** 紧凑格式化数值，移除小数尾零。 */
function formatCompactUnits(value: bigint) {
  const raw = formatEther(value);
  if (!raw.includes(".")) {
    return raw;
  }
  return raw.replace(/\.?0+$/, "");
}

/** 计算占比并保留一位小数。 */
function ratioPercent(part: bigint, total: bigint) {
  if (total === 0n) {
    return 0;
  }
  return Number((part * 1000n) / total) / 10;
}

/** 解析交易模拟输入金额，非法时返回 `null`。 */
function parseSimulationAmount(value: string): bigint | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  try {
    const parsed = parseEther(normalized);
    if (parsed < 0n) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** 地址缩写展示：`0x1234...abcd`。 */
function shortAddr(address: `0x${string}` | null) {
  if (!address) {
    return copy.common.noData;
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/** 交易哈希缩写展示。 */
function shortHash(hash: `0x${string}`) {
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

/** 概率变化量展示为“百分点(pp)”。 */
function formatDeltaPoints(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return copy.common.noData;
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}pp`;
}

/** 时间戳格式化，0 值视为空态。 */
function formatTimestamp(value: bigint) {
  if (value <= 0n) {
    return copy.common.noData;
  }
  return new Date(Number(value) * 1000).toLocaleString();
}

/** 按活动类型返回对应的颜色主题。 */
function getActivityTheme(item: UserActivityItem) {
  if (item.kind === "position_bought") {
    if (item.side === PositionSide.Yes) {
      return {
        card: "border-emerald-200 bg-gradient-to-br from-emerald-50/90 via-emerald-50/60 to-white",
        dot: "bg-emerald-500",
        tag: "border-emerald-200 bg-emerald-100 text-emerald-800"
      };
    }
    if (item.side === PositionSide.No) {
      return {
        card: "border-rose-200 bg-gradient-to-br from-rose-50/90 via-rose-50/60 to-white",
        dot: "bg-rose-500",
        tag: "border-rose-200 bg-rose-100 text-rose-800"
      };
    }
  }

  if (item.kind === "event_created") {
    return {
      card: "border-sky-200 bg-gradient-to-br from-sky-50/85 via-sky-50/50 to-white",
      dot: "bg-sky-500",
      tag: "border-sky-200 bg-sky-100 text-sky-800"
    };
  }
  if (item.kind === "resolution_proposed") {
    return {
      card: "border-amber-200 bg-gradient-to-br from-amber-50/90 via-amber-50/55 to-white",
      dot: "bg-amber-500",
      tag: "border-amber-200 bg-amber-100 text-amber-800"
    };
  }
  if (item.kind === "resolution_finalized") {
    return {
      card: "border-cyan-200 bg-gradient-to-br from-cyan-50/90 via-cyan-50/55 to-white",
      dot: "bg-cyan-500",
      tag: "border-cyan-200 bg-cyan-100 text-cyan-800"
    };
  }
  if (item.kind === "redeemed") {
    return {
      card: "border-lime-200 bg-gradient-to-br from-lime-50/90 via-lime-50/55 to-white",
      dot: "bg-lime-500",
      tag: "border-lime-200 bg-lime-100 text-lime-800"
    };
  }

  return {
    card: "border-black/15 bg-neutral-50",
    dot: "bg-neutral-500",
    tag: "border-black/10 bg-white text-neutral-700"
  };
}

/** 事件详情页：整合交易、结算、持仓与活动展示。 */
export function EventDetailPage({ eventIdParam }: { eventIdParam: string }) {
  const eventId = useMemo(() => {
    try {
      return BigInt(eventIdParam);
    } catch {
      return null;
    }
  }, [eventIdParam]);

  const mounted = useClientMounted();
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const connected = mounted && isConnected;
  const wrongNetwork = connected && chainId !== CHAIN_ID;

  const { data: detail, isLoading, refetch: refetchEventDetail } = useEvent(eventId);
  const { data: position, refetch: refetchUserPosition } = useUserPosition(eventId);
  const { data: activities, refetch: refetchActivities } = useUserActivity({ eventId, limit: 20, cursor: 0 });
  const { data: metadataResult } = useEventMetadata(detail?.event.metadataURI);

  const { buyYes, buyNo, redeemToETH, isPending, error: actionError } = useEventActions(eventId);

  const [buyAmountInput, setBuyAmountInput] = useState("0.1");
  const [redeemYesInput, setRedeemYesInput] = useState("");
  const [redeemNoInput, setRedeemNoInput] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const redeemPreviewYesAmount = useMemo(() => {
    const currentEvent = detail?.event;
    if (!currentEvent || currentEvent.state !== EventState.Resolved) {
      return "0";
    }
    if (currentEvent.finalOutcome === Outcome.Yes) {
      return redeemYesInput;
    }
    if (currentEvent.finalOutcome === Outcome.Invalid) {
      return formatCompactUnits(position?.yesBalance ?? 0n);
    }
    return "0";
  }, [detail?.event?.state, detail?.event?.finalOutcome, position?.yesBalance, redeemYesInput]);

  const redeemPreviewNoAmount = useMemo(() => {
    const currentEvent = detail?.event;
    if (!currentEvent || currentEvent.state !== EventState.Resolved) {
      return "0";
    }
    if (currentEvent.finalOutcome === Outcome.No) {
      return redeemNoInput;
    }
    if (currentEvent.finalOutcome === Outcome.Invalid) {
      return formatCompactUnits(position?.noBalance ?? 0n);
    }
    return "0";
  }, [detail?.event?.state, detail?.event?.finalOutcome, position?.noBalance, redeemNoInput]);

  const { data: redeemPreview } = useRedeemPreview({
    eventId,
    yesAmount: redeemPreviewYesAmount,
    noAmount: redeemPreviewNoAmount
  });

  useEffect(() => {
    const currentEvent = detail?.event;
    if (!currentEvent || currentEvent.state !== EventState.Resolved || !position) {
      return;
    }
    // 结果驱动输入默认值：Yes/No 仅预填赢家方向，Invalid 改为一键全赎回模式。
    if (currentEvent.finalOutcome === Outcome.Yes) {
      setRedeemYesInput(formatCompactUnits(position.yesBalance));
      setRedeemNoInput("0");
      return;
    }
    if (currentEvent.finalOutcome === Outcome.No) {
      setRedeemYesInput("0");
      setRedeemNoInput(formatCompactUnits(position.noBalance));
      return;
    }
    if (currentEvent.finalOutcome === Outcome.Invalid) {
      setRedeemYesInput("");
      setRedeemNoInput("");
    }
  }, [detail?.event?.id, detail?.event?.state, detail?.event?.finalOutcome, position?.yesBalance, position?.noBalance]);

  if (!eventId) {
    return (
      <Card className="border-black/20">
        <CardContent className="py-6">{copy.common.eventIdInvalid}</CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="border-black/20">
        <CardContent className="py-6">{copy.common.loadingEventData}</CardContent>
      </Card>
    );
  }

  const event = detail?.event;
  const resolution = detail?.resolution;

  if (!event || !resolution || !position) {
    return (
      <Card className="border-black/20">
        <CardContent className="py-6">{copy.common.eventNotFound}</CardContent>
      </Card>
    );
  }

  const probs = probabilityFromPools(event.yesPool, event.noPool);
  const canBuyNow = event.state === EventState.Open;
  const coverImage = resolveMetadataUri(metadataResult?.teaching?.coverImage ?? null);
  const totalPosition = position.yesBalance + position.noBalance;
  const hasPosition = totalPosition > 0n;
  const yesPositionPercent = hasPosition ? ratioPercent(position.yesBalance, totalPosition) : 0;
  const noPositionPercent = hasPosition ? ratioPercent(position.noBalance, totalPosition) : 0;
  const yesPoolPercent = probs.yesProbability * 100;
  const noPoolPercent = probs.noProbability * 100;
  const dominantHoldingIsYes = yesPositionPercent >= noPositionPercent;
  const dominantHoldingPercent = dominantHoldingIsYes ? yesPositionPercent : noPositionPercent;
  const dominantHoldingLabel = dominantHoldingIsYes ? copy.common.yes : copy.common.no;
  const dominantHoldingTextClass = dominantHoldingIsYes ? "text-emerald-700" : "text-rose-700";

  // 交易影响模拟：以当前奖池为基线，静态估算“买是/买否”后的池子与概率变化。
  const simulationAmountWei = parseSimulationAmount(buyAmountInput);
  const hasSimulationInput = simulationAmountWei !== null;
  const buyYesAfterYesPool = hasSimulationInput ? event.yesPool + simulationAmountWei : null;
  const buyYesAfterNoPool = hasSimulationInput ? event.noPool : null;
  const buyNoAfterYesPool = hasSimulationInput ? event.yesPool : null;
  const buyNoAfterNoPool = hasSimulationInput ? event.noPool + simulationAmountWei : null;
  const buyYesAfterProbs =
    buyYesAfterYesPool !== null && buyYesAfterNoPool !== null ? probabilityFromPools(buyYesAfterYesPool, buyYesAfterNoPool) : null;
  const buyNoAfterProbs =
    buyNoAfterYesPool !== null && buyNoAfterNoPool !== null ? probabilityFromPools(buyNoAfterYesPool, buyNoAfterNoPool) : null;
  const buyYesDeltaYesPp = buyYesAfterProbs ? (buyYesAfterProbs.yesProbability - probs.yesProbability) * 100 : null;
  const buyYesDeltaNoPp = buyYesAfterProbs ? (buyYesAfterProbs.noProbability - probs.noProbability) * 100 : null;
  const buyNoDeltaYesPp = buyNoAfterProbs ? (buyNoAfterProbs.yesProbability - probs.yesProbability) * 100 : null;
  const buyNoDeltaNoPp = buyNoAfterProbs ? (buyNoAfterProbs.noProbability - probs.noProbability) * 100 : null;
  const positionDonutStyle = {
    background: hasPosition
      ? `conic-gradient(#10b981 0 ${yesPositionPercent}%, #e11d48 ${yesPositionPercent}% 100%)`
      : "conic-gradient(#d4d4d8 0 100%)"
  } as const;
  const outcomeIsYes = event.finalOutcome === Outcome.Yes;
  const outcomeIsNo = event.finalOutcome === Outcome.No;
  const outcomeIsInvalid = event.finalOutcome === Outcome.Invalid;
  const redeemableYes = outcomeIsYes || outcomeIsInvalid ? position.yesBalance : 0n;
  const redeemableNo = outcomeIsNo || outcomeIsInvalid ? position.noBalance : 0n;
  const totalRedeemable = redeemableYes + redeemableNo;
  const hasRedeemable = totalRedeemable > 0n;
  const hasWinnerRedeemable = (outcomeIsYes && redeemableYes > 0n) || (outcomeIsNo && redeemableNo > 0n);
  const winnerLabel = outcomeIsYes ? copy.common.yes : outcomeIsNo ? copy.common.no : copy.eventDetail.winnerFallback;
  const winnerInputValue = outcomeIsYes ? redeemYesInput : redeemNoInput;
  const outcomeBadgeClass = outcomeIsYes
    ? "border-emerald-200 bg-emerald-100 text-emerald-800"
    : outcomeIsNo
      ? "border-rose-200 bg-rose-100 text-rose-800"
      : "border-amber-200 bg-amber-100 text-amber-800";

  const onBuyYes = async () => {
    setFeedback(null);
    const ok = await buyYes(buyAmountInput);
    if (ok) {
      // 买入成功后刷新关键查询，确保概率、持仓与活动流同步更新。
      await Promise.allSettled([refetchEventDetail(), refetchUserPosition(), refetchActivities()]);
      setFeedback(copy.eventDetail.buySuccessYes(buyAmountInput));
    }
  };

  const onBuyNo = async () => {
    setFeedback(null);
    const ok = await buyNo(buyAmountInput);
    if (ok) {
      // 买入成功后刷新关键查询，确保概率、持仓与活动流同步更新。
      await Promise.allSettled([refetchEventDetail(), refetchUserPosition(), refetchActivities()]);
      setFeedback(copy.eventDetail.buySuccessNo(buyAmountInput));
    }
  };

  const onRedeem = async () => {
    setFeedback(null);
    let yesAmount = redeemYesInput;
    let noAmount = redeemNoInput;

    // 赎回参数按最终结果约束：Yes/No 仅允许赢家方向，Invalid 全量赎回。
    if (event.finalOutcome === Outcome.Yes) {
      noAmount = "0";
    } else if (event.finalOutcome === Outcome.No) {
      yesAmount = "0";
    } else if (event.finalOutcome === Outcome.Invalid) {
      yesAmount = formatCompactUnits(position.yesBalance);
      noAmount = formatCompactUnits(position.noBalance);
    }

    const ok = await redeemToETH(yesAmount, noAmount);
    if (ok) {
      await Promise.allSettled([refetchEventDetail(), refetchUserPosition(), refetchActivities()]);
      setFeedback(copy.eventDetail.redeemSubmitted);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-black/20">
        <div className={coverImage ? "grid gap-0 lg:grid-cols-[minmax(0,1fr)_240px]" : "grid gap-0"}>
          <div>
            <CardHeader className="pb-3">
              <div className="space-y-2">
                <CardTitle className="text-2xl leading-tight">{event.question}</CardTitle>
                <CardDescription>{copy.common.eventNumber(event.id.toString())}</CardDescription>
                <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                  <Badge variant={stateBadgeVariant[event.state]}>{eventStateLabel[event.state]}</Badge>
                  <span>{copy.resolvePage.closeTime(new Date(Number(event.closeTime) * 1000).toLocaleString())}</span>
                  {event.state === EventState.Resolved && (
                    <span>
                      {copy.eventDetail.finalOutcome(outcomeLabel[event.finalOutcome])}
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pb-5 text-sm text-neutral-700">
              <div>{copy.common.currentWallet(shortAddr((address as `0x${string}` | undefined) ?? null))}</div>
              <div>{copy.common.totalPool}：{formatEther(event.totalCollateral)} ETH</div>
              {event.state === EventState.Resolved && (
                <div>{copy.eventDetail.eventSnapshot(formatEther(event.totalPoolSnapshot), formatEther(event.winningPoolSnapshot))}</div>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/events">{copy.eventDetail.backToHall}</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/events/${event.id.toString()}/resolve`}>{copy.eventDetail.openResolvePage}</Link>
                </Button>
              </div>
            </CardContent>
          </div>

          {coverImage ? (
            <div className="px-6 pb-6 lg:p-4 lg:pl-0">
              <div className="relative h-full min-h-[180px] overflow-hidden rounded-2xl border border-black/10 bg-neutral-100">
                {/* metadata 图片来源可能是动态地址，使用 img 避免 next/image 额外域名白名单配置。 */}
                <img src={coverImage} alt={copy.eventCard.coverAlt(event.question)} className="absolute inset-0 h-full w-full object-cover" />
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      <Card className="gap-4 border-black/20 py-5" data-testid="detail-trade-panel">
        <CardHeader className="px-5 pb-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">{copy.eventDetail.tradeDesk}</CardTitle>
              <CardDescription>{copy.eventDetail.tradeDeskDesc}</CardDescription>
            </div>
            <div className="rounded-lg border border-black/10 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
              {copy.common.totalPool}：<span className="font-semibold text-neutral-900">{formatCompactUnits(event.totalCollateral)} ETH</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-5 pt-0">
          {wrongNetwork && <div className="text-sm text-red-600">{copy.common.networkNot31337}</div>}
          {!connected && <div className="text-sm text-neutral-600">{copy.createPage.needConnect}</div>}
          {connected && !canBuyNow && (
            <div className="text-sm text-amber-700">{copy.eventDetail.cannotBuy(eventStateLabel[event.state])}</div>
          )}

          <section className="grid gap-3 lg:grid-cols-[640px_minmax(0,1fr)] lg:items-stretch">
            <div className="grid h-full w-full max-w-[640px] gap-3 md:grid-cols-2 md:grid-rows-1 md:items-stretch">
              <div className="flex h-full min-h-0 flex-col rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/30 p-4">
                <div className="flex items-center justify-between text-sm text-emerald-800">
                  <span className="font-semibold">{copy.common.yes}</span>
                  <span className="text-xs">{formatCompactUnits(event.yesPool)} ETH</span>
                </div>
                <div className="mt-2 text-4xl font-semibold leading-none text-emerald-800">{formatPercent(probs.yesProbability)}</div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-emerald-200/80">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(8, Math.min(92, yesPoolPercent))}%` }} />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-emerald-800/90">
                  <span>{copy.eventDetail.myYes}</span>
                  <span>{formatCompactUnits(position.yesBalance)} {copy.common.shareUnit}</span>
                </div>
              </div>

              <div className="flex h-full min-h-0 flex-col rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50 to-rose-100/30 p-4">
                <div className="flex items-center justify-between text-sm text-rose-800">
                  <span className="font-semibold">{copy.common.no}</span>
                  <span className="text-xs">{formatCompactUnits(event.noPool)} ETH</span>
                </div>
                <div className="mt-2 text-4xl font-semibold leading-none text-rose-800">{formatPercent(probs.noProbability)}</div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-rose-200/80">
                  <div className="h-full rounded-full bg-rose-500" style={{ width: `${Math.max(8, Math.min(92, noPoolPercent))}%` }} />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-rose-800/90">
                  <span>{copy.eventDetail.myNo}</span>
                  <span>{formatCompactUnits(position.noBalance)} {copy.common.shareUnit}</span>
                </div>
              </div>
            </div>

            <div className="flex h-full flex-col rounded-xl border border-black/10 bg-neutral-50 p-3.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-neutral-800">{copy.eventDetail.holdingOverview}</span>
                <span className="text-xs text-neutral-500">{copy.eventDetail.totalShares(formatCompactUnits(totalPosition))}</span>
              </div>

              <div className="mt-3 grid flex-1 gap-3 sm:grid-cols-[132px_minmax(0,1fr)] sm:items-center">
                <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full p-[7px]" style={positionDonutStyle}>
                  <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white">
                    <div className="text-[10px] text-neutral-500">{copy.eventDetail.holdingRatio}</div>
                    <div className={`text-lg font-semibold leading-none ${dominantHoldingTextClass}`}>
                      {hasPosition ? `${dominantHoldingPercent.toFixed(1)}%` : "0.0%"}
                    </div>
                    <div className={`mt-0.5 text-[10px] font-medium ${dominantHoldingTextClass}`}>{dominantHoldingLabel}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="rounded-lg border border-emerald-200/90 bg-emerald-50 px-3 py-2">
                    <div className="flex items-center justify-between text-xs text-emerald-800">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span className="font-medium">{copy.common.yes}</span>
                      </div>
                      <span>{formatCompactUnits(position.yesBalance)} {copy.common.shareUnit}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-emerald-700/90">{yesPositionPercent.toFixed(1)}%</div>
                  </div>

                  <div className="rounded-lg border border-rose-200/90 bg-rose-50 px-3 py-2">
                    <div className="flex items-center justify-between text-xs text-rose-800">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-rose-600" />
                        <span className="font-medium">{copy.common.no}</span>
                      </div>
                      <span>{formatCompactUnits(position.noBalance)} {copy.common.shareUnit}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-rose-700/90">{noPositionPercent.toFixed(1)}%</div>
                  </div>
                </div>
              </div>

              <div className="mt-3 text-xs text-neutral-500">{probs.hasLiquidity ? copy.eventDetail.poolRatioNote : copy.eventDetail.emptyPoolRatioNote}</div>
            </div>
          </section>

          <section className="grid gap-3 lg:grid-cols-[640px_minmax(0,1fr)] lg:items-stretch">
            <div className="flex h-full min-h-[168px] w-full max-w-[640px] flex-col rounded-xl border border-black/10 bg-gradient-to-br from-neutral-50 via-white to-neutral-50 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-neutral-800">{copy.eventDetail.impactSim}</div>
                  <div className="text-[11px] text-neutral-500">{copy.eventDetail.impactSimDesc}</div>
                </div>
                <span className="rounded-full border border-black/10 bg-white/70 px-2 py-0.5 text-[10px] text-neutral-500">{copy.eventDetail.realtime}</span>
              </div>

              <div className="mt-2 rounded-lg border border-black/10 bg-white/80 px-2.5 py-2 text-[11px]">
                <div className="text-neutral-500">{copy.eventDetail.baseline}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-md border border-emerald-200 bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">
                    {copy.common.yes} {formatPercent(probs.yesProbability)}
                  </span>
                  <span className="rounded-md border border-rose-200 bg-rose-100 px-2 py-0.5 font-semibold text-rose-800">
                    {copy.common.no} {formatPercent(probs.noProbability)}
                  </span>
                </div>
              </div>

              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-2.5 py-2 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-emerald-800">{copy.eventDetail.ifBuyYes}</span>
                    <span className="rounded-md border border-emerald-200 bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-800">
                      {copy.common.yes} {formatDeltaPoints(buyYesDeltaYesPp)}
                    </span>
                  </div>
                  <div className="mt-1 text-emerald-800/90">
                    {copy.eventDetail.afterBuyPool}：{copy.common.yes} {buyYesAfterYesPool !== null ? `${formatCompactUnits(buyYesAfterYesPool)} ETH` : copy.common.noData} ·{" "}
                    {copy.common.no} {buyYesAfterNoPool !== null ? `${formatCompactUnits(buyYesAfterNoPool)} ETH` : copy.common.noData}
                  </div>
                  <div className="mt-1 text-emerald-800/90">
                    {copy.eventDetail.afterBuyProb}：{copy.common.yes} {buyYesAfterProbs ? formatPercent(buyYesAfterProbs.yesProbability) : copy.common.noData} ·{" "}
                    {copy.common.no} {buyYesAfterProbs ? formatPercent(buyYesAfterProbs.noProbability) : copy.common.noData}
                  </div>
                  <div className="mt-1 text-emerald-800/80">
                    {copy.eventDetail.change}：{copy.common.yes} {formatDeltaPoints(buyYesDeltaYesPp)} · {copy.common.no} {formatDeltaPoints(buyYesDeltaNoPp)}
                  </div>
                </div>

                <div className="rounded-lg border border-rose-200 bg-rose-50/80 px-2.5 py-2 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-rose-800">{copy.eventDetail.ifBuyNo}</span>
                    <span className="rounded-md border border-rose-200 bg-rose-100 px-1.5 py-0.5 text-[10px] text-rose-800">
                      {copy.common.no} {formatDeltaPoints(buyNoDeltaNoPp)}
                    </span>
                  </div>
                  <div className="mt-1 text-rose-800/90">
                    {copy.eventDetail.afterBuyPool}：{copy.common.yes} {buyNoAfterYesPool !== null ? `${formatCompactUnits(buyNoAfterYesPool)} ETH` : copy.common.noData} ·{" "}
                    {copy.common.no} {buyNoAfterNoPool !== null ? `${formatCompactUnits(buyNoAfterNoPool)} ETH` : copy.common.noData}
                  </div>
                  <div className="mt-1 text-rose-800/90">
                    {copy.eventDetail.afterBuyProb}：{copy.common.yes} {buyNoAfterProbs ? formatPercent(buyNoAfterProbs.yesProbability) : copy.common.noData} ·{" "}
                    {copy.common.no} {buyNoAfterProbs ? formatPercent(buyNoAfterProbs.noProbability) : copy.common.noData}
                  </div>
                  <div className="mt-1 text-rose-800/80">
                    {copy.eventDetail.change}：{copy.common.yes} {formatDeltaPoints(buyNoDeltaYesPp)} · {copy.common.no} {formatDeltaPoints(buyNoDeltaNoPp)}
                  </div>
                </div>
              </div>

              {!hasSimulationInput && (
                <div className="mt-2 rounded-lg border border-dashed border-black/20 bg-white/80 px-2.5 py-2 text-[11px] text-neutral-500">
                  {copy.eventDetail.simulationHint}
                </div>
              )}
            </div>

            <div className="flex h-full min-h-[168px] w-full flex-col rounded-xl border border-black/10 bg-white p-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">{copy.eventDetail.buyAmount}</label>
                <Input
                  value={buyAmountInput}
                  onChange={(event) => setBuyAmountInput(event.target.value)}
                  placeholder={copy.eventDetail.buyAmountPlaceholder}
                  data-testid="detail-buy-amount"
                />
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
                {QUICK_BUY_PRESETS.map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    size="sm"
                    variant={buyAmountInput.trim() === preset ? "default" : "outline"}
                    className="h-8 w-full rounded-md px-2 text-sm"
                    onClick={() => setBuyAmountInput(preset)}
                  >
                    {preset} ETH
                  </Button>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  className="h-9 w-full min-w-0 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                  disabled={!connected || wrongNetwork || !canBuyNow || isPending}
                  onClick={onBuyYes}
                  data-testid="detail-buy-yes"
                >
                  {isPending ? copy.common.submitting : copy.eventDetail.buyYes}
                </Button>
                <Button
                  size="sm"
                  className="h-9 w-full min-w-0 rounded-lg bg-rose-600 text-white hover:bg-rose-700"
                  disabled={!connected || wrongNetwork || !canBuyNow || isPending}
                  onClick={onBuyNo}
                  data-testid="detail-buy-no"
                >
                  {isPending ? copy.common.submitting : copy.eventDetail.buyNo}
                </Button>
              </div>
            </div>
          </section>
        </CardContent>
      </Card>

      {event.state === EventState.Resolved && (
        <Card className="border-black/20" data-testid="detail-redeem-panel">
          <CardHeader>
            <CardTitle className="text-lg">{copy.eventDetail.redeemTitle}</CardTitle>
            <CardDescription>
              {copy.eventDetail.redeemDesc}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <div className="rounded-xl border border-black/10 bg-neutral-50 p-3">
                <div className="text-xs font-semibold text-neutral-700">{copy.eventDetail.settlementInfo}</div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-black/10 bg-white px-2.5 py-2">
                    <div className="text-[11px] text-neutral-500">{copy.resolveList.finalOutcome}</div>
                    <div className="mt-1">
                      <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${outcomeBadgeClass}`}>
                        {outcomeLabel[event.finalOutcome]}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-lg border border-black/10 bg-white px-2.5 py-2">
                    <div className="text-[11px] text-neutral-500">{copy.eventDetail.proposedOutcome}</div>
                    <div className="mt-1 text-xs font-semibold text-neutral-800">
                      {resolution.proposed ? outcomeLabel[resolution.proposedOutcome] : copy.common.noData}
                    </div>
                  </div>
                  <div className="rounded-lg border border-black/10 bg-white px-2.5 py-2">
                    <div className="text-[11px] text-neutral-500">{copy.eventDetail.proposer}</div>
                    <div className="mt-1 font-mono text-xs text-neutral-800">{shortAddr(resolution.proposer)}</div>
                  </div>
                  <div className="rounded-lg border border-black/10 bg-white px-2.5 py-2">
                    <div className="text-[11px] text-neutral-500">{copy.eventDetail.finalizedState}</div>
                    <div className="mt-1 text-xs font-semibold text-neutral-800">
                      {resolution.finalized ? copy.resolvePage.finalized : copy.resolvePage.notFinalized}
                    </div>
                  </div>
                  <div className="rounded-lg border border-black/10 bg-white px-2.5 py-2">
                    <div className="text-[11px] text-neutral-500">{copy.eventDetail.proposedAt}</div>
                    <div className="mt-1 text-xs text-neutral-800">{formatTimestamp(resolution.proposedAt)}</div>
                  </div>
                  <div className="rounded-lg border border-black/10 bg-white px-2.5 py-2">
                    <div className="text-[11px] text-neutral-500">{copy.eventDetail.canFinalizeAt}</div>
                    <div className="mt-1 text-xs text-neutral-800">{formatTimestamp(resolution.canFinalizeAt)}</div>
                  </div>
                  <div className="rounded-lg border border-black/10 bg-white px-2.5 py-2">
                    <div className="text-[11px] text-neutral-500">{copy.eventDetail.totalSnapshot}</div>
                    <div className="mt-1 text-xs font-semibold text-neutral-800">{formatCompactUnits(event.totalPoolSnapshot)} ETH</div>
                  </div>
                  <div className="rounded-lg border border-black/10 bg-white px-2.5 py-2">
                    <div className="text-[11px] text-neutral-500">{copy.eventDetail.winningSnapshot}</div>
                    <div className="mt-1 text-xs font-semibold text-neutral-800">{formatCompactUnits(event.winningPoolSnapshot)} ETH</div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-black/10 bg-white p-3">
                <div className="text-xs font-semibold text-neutral-700">{copy.eventDetail.myPositionRedeemable}</div>
                <div className="mt-2 space-y-2">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2">
                    <div className="flex items-center justify-between text-xs text-emerald-800">
                      <span className="font-medium">{copy.eventDetail.positionYes}</span>
                      <span>{formatCompactUnits(position.yesBalance)} {copy.common.shareUnit}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-emerald-800/90">{copy.eventDetail.redeemable(formatCompactUnits(redeemableYes))}</div>
                  </div>
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2">
                    <div className="flex items-center justify-between text-xs text-rose-800">
                      <span className="font-medium">{copy.eventDetail.positionNo}</span>
                      <span>{formatCompactUnits(position.noBalance)} {copy.common.shareUnit}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-rose-800/90">{copy.eventDetail.redeemable(formatCompactUnits(redeemableNo))}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-black/20 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
              {copy.eventDetail.redeemPreview(formatEther(redeemPreview))}
            </div>

            {outcomeIsInvalid ? (
              hasRedeemable ? (
                <Button disabled={!connected || wrongNetwork || isPending} onClick={onRedeem} data-testid="redeem-submit">
                  {isPending ? copy.common.submitting : copy.eventDetail.oneClickRedeem}
                </Button>
              ) : (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {copy.eventDetail.noRedeemableForOutcome(outcomeLabel[event.finalOutcome])}
                </div>
              )
            ) : hasWinnerRedeemable ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">{copy.eventDetail.redeemWinningShares(winnerLabel)}</label>
                  <Input
                    value={winnerInputValue}
                    onChange={(event) => {
                      if (outcomeIsYes) {
                        setRedeemYesInput(event.target.value);
                        return;
                      }
                      setRedeemNoInput(event.target.value);
                    }}
                    placeholder={copy.eventDetail.redeemPlaceholder(formatCompactUnits(outcomeIsYes ? redeemableYes : redeemableNo))}
                    data-testid={outcomeIsYes ? "redeem-yes-input" : "redeem-no-input"}
                  />
                </div>
                <Button disabled={!connected || wrongNetwork || isPending} onClick={onRedeem} data-testid="redeem-submit">
                  {isPending ? copy.common.submitting : copy.eventDetail.redeemEth}
                </Button>
              </div>
            ) : (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {copy.eventDetail.noWinnerShares(outcomeLabel[event.finalOutcome], winnerLabel)}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(feedback || actionError) && (
        <Card className="border-black/20">
          <CardContent className="space-y-2 py-4 text-sm">
            {feedback && <div className="text-emerald-700">{feedback}</div>}
            {actionError && <div className="text-red-600">{actionError}</div>}
          </CardContent>
        </Card>
      )}

      <Card className="border-black/20">
        <CardHeader>
          <CardTitle className="text-lg">{copy.eventDetail.recentActivity}</CardTitle>
          <CardDescription>{copy.eventDetail.recentActivityDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          {activities.items.length === 0 ? (
            <div className="text-sm text-neutral-500">{copy.eventDetail.noActivity}</div>
          ) : (
            <div className="space-y-2.5">
              {activities.items.map((item) => {
                const theme = getActivityTheme(item);
                const sidePillClass =
                  item.side === PositionSide.Yes
                    ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                    : item.side === PositionSide.No
                      ? "border-rose-200 bg-rose-100 text-rose-800"
                      : "border-black/10 bg-white text-neutral-700";

                return (
                  <div key={`${item.txHash}:${item.logIndex}`} className={`overflow-hidden rounded-xl border ${theme.card}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${theme.dot}`} />
                        <span className="text-sm font-semibold text-neutral-800">{activityLabel[item.kind]}</span>
                        {item.eventId !== null ? (
                          <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${theme.tag}`}>
                            {copy.common.eventNumber(item.eventId.toString())}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="rounded-md border border-black/10 bg-white/80 px-1.5 py-0.5 text-neutral-600">
                          {copy.eventDetail.blockNumber(item.blockNumber.toString())}
                        </span>
                        <span className="rounded-md border border-black/10 bg-white/80 px-1.5 py-0.5 font-mono text-neutral-500">{shortHash(item.txHash)}</span>
                      </div>
                    </div>

                    {item.kind === "position_bought" ? (
                      <div className="grid gap-2 p-3 text-xs sm:grid-cols-2">
                        <div className="rounded-lg border border-black/10 bg-white/75 px-2.5 py-2">
                          <div className="text-[11px] text-neutral-500">{copy.eventDetail.boughtUser}</div>
                          <div className="mt-1 font-medium text-neutral-800">{shortAddr(item.account)}</div>
                        </div>
                        <div className="rounded-lg border border-black/10 bg-white/75 px-2.5 py-2">
                          <div className="text-[11px] text-neutral-500">{copy.eventDetail.boughtSide}</div>
                          <div className="mt-1">
                            <span className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${sidePillClass}`}>
                              {item.side !== null ? `${copy.eventDetail.buyPrefix}${positionSideLabel[item.side]}` : copy.common.unknown}
                            </span>
                          </div>
                        </div>
                        <div className="rounded-lg border border-black/10 bg-white/75 px-2.5 py-2">
                          <div className="text-[11px] text-neutral-500">{copy.eventDetail.spentAmount}</div>
                          <div className="mt-1 font-semibold text-neutral-800">{item.amount !== null ? `${formatEther(item.amount)} ETH` : copy.common.noData}</div>
                        </div>
                        <div className="rounded-lg border border-black/10 bg-white/75 px-2.5 py-2">
                          <div className="text-[11px] text-neutral-500">{copy.eventDetail.mintedShares}</div>
                          <div className="mt-1 font-semibold text-neutral-800">
                            {item.tokenAmount !== null ? `${formatEther(item.tokenAmount)} ${copy.common.shareUnit}` : copy.common.noData}
                          </div>
                        </div>
                        {(item.eventYesPool !== null || item.eventNoPool !== null) && (
                          <div className="sm:col-span-2 rounded-lg border border-black/10 bg-white/80 px-2.5 py-2">
                            <div className="text-[11px] text-neutral-500">{copy.eventDetail.poolSnapshotAfterBuy}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                              <span className="rounded-md border border-emerald-200 bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">
                                {copy.common.yes} {item.eventYesPool !== null ? `${formatEther(item.eventYesPool)} ETH` : copy.common.noData}
                              </span>
                              <span className="rounded-md border border-rose-200 bg-rose-100 px-2 py-0.5 font-semibold text-rose-800">
                                {copy.common.no} {item.eventNoPool !== null ? `${formatEther(item.eventNoPool)} ETH` : copy.common.noData}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5 p-3 text-[11px]">
                        <span className="rounded-md border border-black/10 bg-white/80 px-2 py-1 text-neutral-700">
                          {copy.eventDetail.account(shortAddr(item.account))}
                        </span>
                        {item.amount !== null ? (
                          <span className="rounded-md border border-black/10 bg-white/80 px-2 py-1 text-neutral-700">
                            {copy.eventDetail.amount(formatEther(item.amount))}
                          </span>
                        ) : null}
                        {item.outcome !== null ? (
                          <span className="rounded-md border border-black/10 bg-white/80 px-2 py-1 text-neutral-700">
                            {copy.eventDetail.result(outcomeLabel[item.outcome])}
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
