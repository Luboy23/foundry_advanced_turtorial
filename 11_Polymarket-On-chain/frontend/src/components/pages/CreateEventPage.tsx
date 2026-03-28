"use client";

import { useAccount, useChainId } from "wagmi";

import { CreateEventFormCard } from "@/components/create-event/CreateEventFormCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useClientMounted } from "@/hooks/useClientMounted";
import { useEventOwner } from "@/hooks/useEventOwner";
import { copy } from "@/lib/copy";
import { CHAIN_ID } from "@/lib/config";

/** 地址缩写展示：`0x1234...abcd`。 */
function shortAddr(address: `0x${string}` | null) {
  if (!address) {
    return copy.common.noData;
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/** 创建事件页面：负责权限门禁与创建表单挂载。 */
export function CreateEventPage() {
  const mounted = useClientMounted();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: authorities, isFetching } = useEventOwner();

  const owner = authorities.owner;
  const resolver = authorities.resolver;
  const isWrongNetwork = isConnected && chainId !== CHAIN_ID;
  const isOwner = !!address && !!owner && address.toLowerCase() === owner.toLowerCase();

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-wide">{copy.createPage.title}</h1>
        <p className="text-sm text-neutral-600">{copy.createPage.subtitle}</p>
      </section>

      {!mounted && (
        <Card className="border-black/20">
          <CardContent className="py-6 text-sm">{copy.common.loadingWalletState}</CardContent>
        </Card>
      )}

      {mounted && !isConnected && (
        <Card className="border-black/20">
          <CardContent className="py-6 text-sm">{copy.createPage.needConnect}</CardContent>
        </Card>
      )}

      {mounted && isConnected && isFetching && !owner && (
        <Card className="border-black/20">
          <CardContent className="py-6 text-sm">{copy.createPage.checkingOwner}</CardContent>
        </Card>
      )}

      {mounted && isConnected && !isFetching && !owner && (
        <Card className="border-black/20">
          <CardHeader>
            <CardTitle className="text-lg">{copy.createPage.checkFailed}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-neutral-700">
            <p>{copy.createPage.cannotReadOwner}</p>
            <p>{copy.common.currentWallet(shortAddr((address as `0x${string}` | undefined) ?? null))}</p>
          </CardContent>
        </Card>
      )}

      {mounted && isConnected && owner && !isOwner && (
        <Card className="border-black/20" data-testid="create-no-permission-card">
          <CardHeader>
            <CardTitle className="text-lg">{copy.createPage.noPermission}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-neutral-700">
            <p>{copy.createPage.ownerOnly}</p>
            <p>{copy.common.currentWallet(shortAddr((address as `0x${string}` | undefined) ?? null))}</p>
            <p>{copy.createPage.ownerAddress(shortAddr(owner))}</p>
          </CardContent>
        </Card>
      )}

      {mounted && isConnected && owner && isOwner && (
        <CreateEventFormCard owner={owner} resolver={resolver} isConnected={isConnected} isWrongNetwork={isWrongNetwork} />
      )}
    </div>
  );
}
