"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAccount, useChainId, usePublicClient } from "wagmi";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useClientMounted } from "@/hooks/useClientMounted";
import { useEvent } from "@/hooks/useEvent";
import { useEventActions } from "@/hooks/useEventActions";
import { useEventOwner } from "@/hooks/useEventOwner";
import { copy } from "@/lib/copy";
import { CHAIN_ID } from "@/lib/config";
import { EventState, Outcome, eventStateLabel, outcomeLabel } from "@/lib/event-types";

const RESOLUTION_LIVENESS_SEC = 30n;

/** 地址缩写展示：`0x1234...abcd`。 */
function shortAddr(address: `0x${string}` | null) {
  if (!address) {
    return copy.common.noData;
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/** 时间戳格式化：0 或空值返回占位符。 */
function formatTimestamp(value: bigint | number | null) {
  if (value === null) {
    return copy.common.noData;
  }
  const normalized = typeof value === "bigint" ? Number(value) : value;
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return copy.common.noData;
  }
  return new Date(normalized * 1000).toLocaleString();
}

/** 单事件结算页：仅 resolver 可执行提案与最终化操作。 */
export function EventResolvePage({ eventIdParam }: { eventIdParam: string }) {
  const eventId = useMemo(() => {
    try {
      return BigInt(eventIdParam);
    } catch {
      return null;
    }
  }, [eventIdParam]);

  const mounted = useClientMounted();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const connected = mounted && isConnected;
  const viewerAddress = mounted ? address : undefined;
  const wrongNetwork = connected && chainId !== CHAIN_ID;

  const { data: authorities, isFetching } = useEventOwner();
  const { data: detail, isLoading } = useEvent(eventId);
  const {
    proposeResolution,
    finalizeResolution,
    isPending,
    error: actionError
  } = useEventActions(eventId);

  const [clockNowSec, setClockNowSec] = useState(0);

  useEffect(() => {
    if (!mounted) {
      return;
    }
    let stopped = false;
    const syncNow = async () => {
      if (stopped) {
        return;
      }
      const wallClockSec = Math.floor(Date.now() / 1000);
      if (publicClient) {
        try {
          const block = await publicClient.getBlock({ blockTag: "latest" });
          if (!stopped) {
            // 本地开发链在无新交易时区块时间可能停止推进，这里取链上与本地时间较大值，
            // 以保证“冷静期倒计时”在无新块场景下仍能连续更新。
            setClockNowSec(Math.max(Number(block.timestamp), wallClockSec));
          }
          return;
        } catch {
          // 链上时间读取失败时回退到本地时间，避免页面倒计时进入不可用状态。
        }
      }
      if (!stopped) {
        setClockNowSec(wallClockSec);
      }
    };

    void syncNow();
    const timer = window.setInterval(() => {
      void syncNow();
    }, 1000);

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [mounted, publicClient]);

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

  if (!event || !resolution) {
    return (
      <Card className="border-black/20">
        <CardContent className="py-6">{copy.common.eventNotFound}</CardContent>
      </Card>
    );
  }

  const resolver = authorities.resolver;
  const isResolver = !!viewerAddress && !!resolver && viewerAddress.toLowerCase() === resolver.toLowerCase();
  const hasClock = clockNowSec > 0;
  const closeTime = Number(event.closeTime);

  const canPropose = hasClock && event.state === EventState.Open && clockNowSec >= closeTime;
  // 优先展示链上记录的 canFinalizeAt；若历史/异常数据为 0，但已存在 proposedAt，则按冷静期推导兜底。
  const chainCanFinalizeAtSec =
    resolution.canFinalizeAt > 0n
      ? resolution.canFinalizeAt
      : resolution.proposedAt > 0n
        ? resolution.proposedAt + RESOLUTION_LIVENESS_SEC
        : 0n;
  const cooldownSeconds = hasClock ? Math.max(0, Number(chainCanFinalizeAtSec) - clockNowSec) : null;
  const cooldownReady = resolution.proposed && !resolution.finalized && cooldownSeconds === 0;
  const canFinalizeAtLabel = formatTimestamp(chainCanFinalizeAtSec);
  const actionDisabled = !connected || wrongNetwork || isPending;

  const resolverReady = connected && isResolver && !wrongNetwork;
  const canProposeReady = resolverReady && canPropose;
  const canFinalizeReady = resolverReady && cooldownReady;

  const finalOutcomeLabel =
    event.state === EventState.Resolved
      ? outcomeLabel[event.finalOutcome]
      : copy.labels.outcomeUnresolved;
  const proposedOutcomeValue = resolution.proposed
    ? outcomeLabel[resolution.proposedOutcome]
    : copy.resolvePage.notProposed;
  const proposedAtValue = resolution.proposed ? formatTimestamp(resolution.proposedAt) : copy.common.noData;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-black/20 bg-gradient-to-br from-cyan-50/70 via-white to-emerald-50/40 py-0">
        <CardHeader className="px-5 pb-3 pt-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">{copy.resolvePage.cockpitTitle}</CardTitle>
              <CardDescription>{copy.resolvePage.cockpitDesc}</CardDescription>
              <div className="mt-1 text-xs text-neutral-500">{copy.common.eventNumber(eventId.toString())}</div>
            </div>
            <Badge className={resolverReady ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"}>
              {resolverReady ? copy.resolvePage.ready : copy.resolvePage.pending}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 px-5 pb-4 text-sm text-neutral-700">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <InfoCell label={copy.resolvePage.eventQuestionLabel} value={event.question} />
            <InfoCell label={copy.resolvePage.currentState(eventStateLabel[event.state])} value={copy.resolvePage.closeTime(formatTimestamp(closeTime))} />
            <InfoCell label={copy.common.currentWallet(shortAddr((viewerAddress as `0x${string}` | undefined) ?? null))} value={copy.common.resolverAddress(shortAddr(resolver))} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/events/${eventId.toString()}`}>{copy.resolvePage.backToDetail}</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/events/resolve">{copy.resolvePage.backToResolveList}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {!mounted && (
        <Card className="border-black/20">
          <CardContent className="py-6 text-sm">{copy.common.loadingWalletState}</CardContent>
        </Card>
      )}

      {mounted && !connected && (
        <Card className="border-black/20">
          <CardContent className="py-6 text-sm">{copy.resolvePage.needConnect}</CardContent>
        </Card>
      )}

      {connected && isFetching && !resolver && (
        <Card className="border-black/20">
          <CardContent className="py-6 text-sm">{copy.resolvePage.checkingResolver}</CardContent>
        </Card>
      )}

      {connected && !isFetching && !resolver && (
        <Card className="border-black/20">
          <CardContent className="py-6 text-sm">{copy.resolvePage.resolverReadFailed}</CardContent>
        </Card>
      )}

      {connected && resolver && !isResolver && (
        <Card className="border-black/20 bg-amber-50/70" data-testid="resolve-no-permission-card">
          <CardHeader>
            <CardTitle className="text-lg">{copy.resolvePage.noPermission}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-neutral-700">
            <p>{copy.resolvePage.noPermissionBody}</p>
            <p>{copy.resolvePage.resolverPermissionLabel}：{copy.resolvePage.resolverPermissionDenied}</p>
          </CardContent>
        </Card>
      )}

      {connected && resolver && isResolver && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,640px)_minmax(0,1fr)] xl:items-start">
          <div className="space-y-4">
            <Card className="border-black/20 py-4" data-testid="resolve-actions-card">
              <CardHeader className="px-5 pb-2">
                <CardTitle className="text-base">{copy.resolvePage.actionsTitle}</CardTitle>
                <CardDescription>{copy.resolvePage.actionsDesc}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 px-5">
                {wrongNetwork && <div className="text-sm text-red-600">{copy.common.networkNot31337}</div>}

                <div className="grid gap-3 md:grid-cols-2">
                  <InfoCell
                    label={copy.resolvePage.proposalStatus}
                    value={resolution.proposed ? copy.resolvePage.proposed(outcomeLabel[resolution.proposedOutcome]) : copy.resolvePage.notProposed}
                  />
                  <InfoCell
                    label={copy.resolvePage.finalizedStatus}
                    value={resolution.finalized ? copy.resolvePage.finalized : cooldownReady ? copy.resolvePage.readyToFinalize : copy.resolvePage.notFinalized}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <InfoCell label={copy.resolvePage.canFinalizeAt} value={canFinalizeAtLabel} />
                  <InfoCell
                    label={copy.resolvePage.cooldown}
                    value={
                      resolution.proposed && !resolution.finalized
                        ? cooldownSeconds === null
                          ? copy.resolvePage.counting
                          : copy.resolvePage.cooldownSeconds(cooldownSeconds)
                        : copy.common.noData
                    }
                  />
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                    disabled={!canPropose || actionDisabled}
                    onClick={() => proposeResolution(Outcome.Yes)}
                    data-testid="resolve-propose-yes"
                  >
                    {copy.resolvePage.submitYes}
                  </Button>
                  <Button
                    className="bg-rose-600 text-white hover:bg-rose-700"
                    disabled={!canPropose || actionDisabled}
                    onClick={() => proposeResolution(Outcome.No)}
                    data-testid="resolve-propose-no"
                  >
                    {copy.resolvePage.submitNo}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!canPropose || actionDisabled}
                    onClick={() => proposeResolution(Outcome.Invalid)}
                    data-testid="resolve-propose-invalid"
                  >
                    {copy.resolvePage.submitInvalid}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={!cooldownReady || actionDisabled}
                    onClick={finalizeResolution}
                    data-testid="resolve-finalize"
                  >
                    {copy.resolvePage.finalize}
                  </Button>
                </div>

                {actionError && <div className="text-sm text-red-600">{actionError}</div>}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="border-black/20 bg-gradient-to-br from-neutral-50 via-white to-cyan-50/40 py-4" data-testid="resolve-overview-card">
              <CardHeader className="px-5 pb-2">
                <CardTitle className="text-base">{copy.resolvePage.overviewTitle}</CardTitle>
                <CardDescription>{copy.resolvePage.overviewDesc}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 px-5 text-sm sm:grid-cols-2">
                <InfoCell label={copy.resolvePage.proposedOutcomeLabel} value={proposedOutcomeValue} />
                <InfoCell label={copy.resolvePage.proposedAtLabel} value={proposedAtValue} />
                <InfoCell label={copy.resolvePage.finalizedStatus} value={resolution.finalized ? copy.resolvePage.finalized : copy.resolvePage.notFinalized} />
                <InfoCell label={copy.resolvePage.finalOutcomeLabel} value={finalOutcomeLabel} />
                <InfoCell label={copy.resolvePage.resolverPermissionLabel} value={resolverReady ? copy.resolvePage.resolverPermissionGranted : copy.resolvePage.resolverPermissionDenied} />
                <InfoCell label={copy.resolvePage.canFinalizeAt} value={canFinalizeAtLabel} />
              </CardContent>
            </Card>

            <Card className="border-black/20 bg-gradient-to-br from-neutral-50 via-white to-emerald-50/40 py-4" data-testid="resolve-timeline-card">
              <CardHeader className="px-5 pb-2">
                <CardTitle className="text-base">{copy.resolvePage.timelineTitle}</CardTitle>
                <CardDescription>{copy.resolvePage.timelineDesc}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 px-5 text-sm">
                <div className="space-y-2 rounded-lg border border-black/10 bg-white p-3">
                  <TimelineRow label={copy.resolvePage.timelineNow} value={formatTimestamp(hasClock ? clockNowSec : null)} accentClass="bg-neutral-700" />
                  <TimelineRow label={copy.resolvePage.timelineClose} value={formatTimestamp(closeTime)} accentClass={canPropose ? "bg-emerald-500" : "bg-neutral-300"} />
                  <TimelineRow label={copy.resolvePage.timelineProposedAt} value={proposedAtValue} accentClass={resolution.proposed ? "bg-cyan-500" : "bg-neutral-300"} />
                  <TimelineRow label={copy.resolvePage.timelineCanFinalizeAt} value={canFinalizeAtLabel} accentClass={cooldownReady ? "bg-rose-500" : "bg-neutral-300"} />
                </div>

                <div className="space-y-2 rounded-lg border border-black/10 bg-white p-3">
                  <div className="text-xs text-neutral-500">{copy.resolvePage.checksTitle}</div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <CheckCell label={copy.resolvePage.checkResolver} ready={resolverReady} />
                    <CheckCell label={copy.resolvePage.checkCanPropose} ready={canProposeReady} />
                    <CheckCell label={copy.resolvePage.checkCanFinalize} ready={canFinalizeReady} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

/** 结算状态信息单元：统一展示标题和值。 */
function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white px-3 py-2">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 break-words font-medium text-neutral-900">{value}</div>
    </div>
  );
}

/** 时间轴节点行。 */
function TimelineRow({ label, value, accentClass }: { label: string; value: string; accentClass: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${accentClass}`} />
      <div className="min-w-0">
        <div className="text-xs text-neutral-500">{label}</div>
        <div className="text-xs font-semibold text-neutral-900">{value}</div>
      </div>
    </div>
  );
}

/** 操作就绪度单元。 */
function CheckCell({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="rounded-md border border-black/10 bg-neutral-50 px-2 py-1.5 text-xs">
      <div className="text-neutral-500">{label}</div>
      <div className={`mt-1 font-semibold ${ready ? "text-emerald-700" : "text-amber-700"}`}>
        {ready ? copy.resolvePage.ready : copy.resolvePage.pending}
      </div>
    </div>
  );
}
