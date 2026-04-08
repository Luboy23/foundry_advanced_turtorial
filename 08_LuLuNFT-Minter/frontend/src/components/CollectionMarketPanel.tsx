"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { useChainId } from "wagmi";
import { formatEther } from "viem";

import { ConnectWalletDialog } from "@/components/ConnectWalletDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useGalleryData, resolveImage } from "@/hooks/useGalleryData";
import { useMarketListings } from "@/hooks/useMarketListings";
import { shortAddress } from "@/lib/format";

const CHAIN_ID = 31337;

export const CollectionMarketPanel = () => {
  const chainId = useChainId();
  const {
    filtered,
    visibleItems,
    hasMore,
    pageSize,
    setVisibleCount,
    loading,
    error,
    actionError: galleryActionError,
    pendingTokenId,
    isConnected,
    loadItems,
    ensureMetadata,
    handleBurn
  } = useGalleryData({ mode: "mine" });
  const {
    activeTokenListingMap,
    pendingActionKey,
    isReady,
    approveAndList,
    cancelListing,
    invalidateListing,
    loadListings
  } = useMarketListings();

  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});

  const chainMismatch = chainId !== CHAIN_ID;

  useEffect(() => {
    // 我的藏品页卡片进入可见后补拉 metadata，减少首屏 RPC 与 HTTP 压力
    visibleItems.forEach((item) => {
      if (
        item.metadata.name ||
        item.metadata.symbol ||
        item.metadata.description ||
        item.metadata.image
      ) {
        return;
      }
      ensureMetadata(item.tokenId, item.tokenUri);
    });
  }, [visibleItems, ensureMetadata]);

  const syncRefresh = async () => {
    // 交易动作后同时刷新“藏品所有权”和“市场挂单状态”
    await Promise.all([loadItems(), loadListings()]);
  };

  const handleList = async (tokenId: bigint) => {
    setActionError(null);
    if (!isConnected) {
      setShowConnectDialog(true);
      return;
    }
    if (chainMismatch) {
      setActionError("请切换到 Anvil 31337 网络后再操作");
      return;
    }
    const key = tokenId.toString();
    const price = (priceInputs[key] ?? "").trim();
    try {
      await approveAndList(tokenId, price);
      setPriceInputs((prev) => ({ ...prev, [key]: "" }));
      await syncRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "上架失败");
    }
  };

  const handleCancel = async (tokenId: bigint) => {
    setActionError(null);
    if (chainMismatch) {
      setActionError("请切换到 Anvil 31337 网络后再操作");
      return;
    }
    const listing = activeTokenListingMap.get(tokenId.toString());
    if (!listing) return;
    try {
      await cancelListing(listing.listingId);
      await syncRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "取消上架失败");
    }
  };

  const handleInvalidate = async (tokenId: bigint) => {
    setActionError(null);
    if (chainMismatch) {
      setActionError("请切换到 Anvil 31337 网络后再操作");
      return;
    }
    const listing = activeTokenListingMap.get(tokenId.toString());
    if (!listing) return;
    try {
      await invalidateListing(listing.listingId);
      await syncRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "清理失效挂单失败");
    }
  };

  const mergedError = useMemo(
    // 优先展示业务动作错误，其次展示图库/列表加载错误
    () => actionError ?? galleryActionError ?? error,
    [actionError, galleryActionError, error]
  );

  if (!isReady) {
    return (
      <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle>藏品交易操作</CardTitle>
          <p className="u-text-meta mt-1 text-slate-500">
            请先配置 NEXT_PUBLIC_MARKET_ADDRESS
          </p>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between u-gap-3">
        <div>
          <CardTitle>藏品交易操作</CardTitle>
          <p className="u-text-meta mt-1 text-slate-500">
            一键上架（自动授权）/ 取消上架 / 清理失效挂单 / 销毁
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => syncRefresh()}
          disabled={loading}
          className="rounded-full"
        >
          {loading ? "刷新中" : "刷新列表"}
        </Button>
      </CardHeader>
      <CardContent className="u-stack-4">
        {chainMismatch ? (
          <p className="u-text-body rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">
            当前网络非 31337，交易按钮已禁用
          </p>
        ) : null}
        {mergedError ? (
          <p className="u-text-body text-rose-600">{mergedError}</p>
        ) : null}

        {filtered.length === 0 ? (
          <p className="u-text-body text-slate-500">
            {isConnected ? "暂无藏品，先去铸造吧" : "连接钱包后查看藏品"}
          </p>
        ) : (
          <div className="grid u-gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleItems.map((item) => {
              const key = item.tokenId.toString();
              const listing = activeTokenListingMap.get(key);
              const pendingList = pendingActionKey === `list-${key}`;
              const pendingApprove = pendingActionKey === `approve-${key}`;
              const pendingCancel =
                listing &&
                pendingActionKey === `cancel-${listing.listingId.toString()}`;
              const pendingInvalidate =
                listing &&
                pendingActionKey ===
                  `invalidate-${listing.listingId.toString()}`;
              const image = resolveImage(item.metadata.image);
              const burnPending = pendingTokenId === item.tokenId;
              const listed = Boolean(listing);

              return (
                <div
                  key={key}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="relative aspect-square bg-slate-50">
                    {image ? (
                      <img
                        src={image}
                        alt={item.metadata.name ?? `NFT #${key}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center u-text-meta text-slate-400">
                        暂无预览
                      </div>
                    )}
                    <span className="u-text-mini absolute left-2 top-2 rounded-full border border-slate-200 bg-white/90 px-2 py-0.5 font-semibold text-slate-700">
                      #{key}
                    </span>
                  </div>
                  <div className="u-stack-2 border-t border-slate-200 px-3 pb-3 pt-2">
                    <p className="u-text-body font-semibold text-slate-900">
                      {item.metadata.name ?? `NFT #${key}`}
                    </p>
                    <p className="u-text-meta text-slate-500">
                      持有人 {shortAddress(item.owner)}
                    </p>

                    {listing ? (
                      listing.valid ? (
                        <>
                          <p className="u-text-meta text-slate-600">
                            已上架 · {Number(formatEther(listing.price)).toLocaleString("zh-CN", {
                              maximumFractionDigits: 6
                            })} ETH
                          </p>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => handleCancel(item.tokenId)}
                            disabled={chainMismatch || Boolean(pendingCancel)}
                            className="h-8 rounded-full"
                          >
                            {pendingCancel ? "处理中" : "取消上架"}
                          </Button>
                        </>
                      ) : (
                        <>
                          <p className="u-text-meta text-amber-700">
                            挂单已失效，可清理后重新上架
                          </p>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => handleInvalidate(item.tokenId)}
                            disabled={chainMismatch || Boolean(pendingInvalidate)}
                            className="h-8 rounded-full"
                          >
                            {pendingInvalidate ? "处理中" : "清理失效挂单"}
                          </Button>
                        </>
                      )
                    ) : (
                      <>
                        <Input
                          placeholder="输入上架价格（ETH）"
                          value={priceInputs[key] ?? ""}
                          onChange={(event) =>
                            setPriceInputs((prev) => ({
                              ...prev,
                              [key]: event.target.value
                            }))
                          }
                        />
                        <Button
                          type="button"
                          onClick={() => handleList(item.tokenId)}
                          disabled={
                            chainMismatch ||
                            pendingList ||
                            pendingApprove ||
                            Boolean(burnPending)
                          }
                          className="h-8 rounded-full"
                        >
                          {pendingApprove
                            ? "授权中"
                            : pendingList
                              ? "上架中"
                              : "一键上架"}
                        </Button>
                      </>
                    )}

                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleBurn(item.tokenId)}
                      disabled={burnPending || listed}
                      className="h-8 rounded-full"
                    >
                      {burnPending
                        ? "销毁中"
                        : listed
                          ? "先下架再销毁"
                          : "销毁 NFT"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {hasMore ? (
          <div className="flex justify-center">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setVisibleCount((prev) => prev + pageSize)}
              className="rounded-full"
            >
              加载更多
            </Button>
          </div>
        ) : null}
      </CardContent>
      <ConnectWalletDialog
        open={showConnectDialog}
        onClose={() => setShowConnectDialog(false)}
        description="连接钱包后可上架你的 NFT"
      />
    </Card>
  );
};
