"use client";

import Link from "next/link";
import { useAccount, useChainId } from "wagmi";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useClientMounted } from "@/hooks/useClientMounted";
import { useEventOwner } from "@/hooks/useEventOwner";
import { useEvents } from "@/hooks/useEvents";
import { copy } from "@/lib/copy";
import { CHAIN_ID } from "@/lib/config";
import { EventState, Outcome, eventStateLabel, outcomeLabel } from "@/lib/event-types";

const stateBadgeVariant: Record<EventState, "default" | "secondary" | "outline"> = {
  [EventState.Open]: "default",
  [EventState.Closed]: "secondary",
  [EventState.Proposed]: "secondary",
  [EventState.Resolved]: "outline"
};

/** 地址缩写展示：`0x1234...abcd`。 */
function shortAddr(address: `0x${string}` | null) {
  if (!address) {
    return copy.common.noData;
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/** 结算列表页：展示可进入结算流程的事件与当前钱包/裁定员信息。 */
export function EventResolveListPage() {
  const mounted = useClientMounted();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const connected = mounted && isConnected;
  const wrongNetwork = connected && chainId !== CHAIN_ID;
  const viewerAddress = mounted ? address : undefined;

  const { data: authorities } = useEventOwner();
  const { data: events = [], isLoading } = useEvents();

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-wide">{copy.resolveList.title}</h1>
        <p className="text-sm text-neutral-600">{copy.resolveList.subtitle}</p>
      </section>

      <Card className="border-black/20">
        <CardHeader>
          <CardTitle className="text-lg">{copy.resolveList.guideTitle}</CardTitle>
          <CardDescription>{copy.resolveList.guideDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-neutral-700">
          <p>{copy.common.currentWallet(shortAddr((viewerAddress as `0x${string}` | undefined) ?? null))}</p>
          <p>{copy.common.resolverAddress(shortAddr(authorities.resolver))}</p>
          <p>{copy.resolveList.guideTail}</p>
        </CardContent>
      </Card>

      {!mounted && (
        <Card className="border-black/20">
          <CardContent className="py-6 text-sm">{copy.common.loadingWalletState}</CardContent>
        </Card>
      )}

      {mounted && !isConnected && (
        <Card className="border-black/20">
          <CardContent className="py-6 text-sm">{copy.resolveList.noConnect}</CardContent>
        </Card>
      )}

      {wrongNetwork && (
        <Card className="border-black/20 bg-black text-white">
          <CardContent className="py-3 text-sm">{copy.resolveList.wrongNetworkBanner}</CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card className="border-black/20">
          <CardContent className="py-6 text-sm text-neutral-500">{copy.common.loadingEvents}</CardContent>
        </Card>
      ) : events.length === 0 ? (
        <Card className="border-black/20">
          <CardContent className="py-6 text-sm text-neutral-500">{copy.resolveList.emptyEvents}</CardContent>
        </Card>
      ) : (
        <section className="grid gap-4 md:grid-cols-2">
          {events.map((event) => (
            <Card key={event.id.toString()} className="border-black/20">
              <CardHeader className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="line-clamp-2 text-base">{event.question}</CardTitle>
                  <Badge variant={stateBadgeVariant[event.state]}>{eventStateLabel[event.state]}</Badge>
                </div>
                <CardDescription>{copy.common.eventNumber(event.id.toString())}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-neutral-700">
                <div className="flex justify-between">
                  <span className="text-neutral-500">{copy.common.closeTimeLabel}</span>
                  <span className="font-mono">{new Date(Number(event.closeTime) * 1000).toLocaleString()}</span>
                </div>
                {event.state === EventState.Resolved && event.finalOutcome !== Outcome.Unresolved && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500">{copy.resolveList.finalOutcome}</span>
                    <span className="font-mono">{outcomeLabel[event.finalOutcome]}</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button asChild className="flex-1">
                    <Link href={`/events/${event.id.toString()}/resolve`}>{copy.resolveList.openResolvePage}</Link>
                  </Button>
                  <Button asChild variant="outline" className="flex-1">
                    <Link href={`/events/${event.id.toString()}`}>{copy.resolveList.viewDetail}</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
