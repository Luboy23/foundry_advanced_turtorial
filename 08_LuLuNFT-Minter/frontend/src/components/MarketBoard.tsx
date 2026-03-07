"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useAccount, useChainId } from "wagmi";
import { formatEther } from "viem";

import { ActivityPanel } from "@/components/ActivityPanel";
import { ConnectWalletDialog } from "@/components/ConnectWalletDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useMarketListings, type MarketListing } from "@/hooks/useMarketListings";
import { resolveImage } from "@/hooks/useGalleryData";
import { shortAddress } from "@/lib/format";

const CHAIN_ID = 31337;
const PAGE_SIZE = 12;

const formatEth = (value: bigint) => {
  const num = Number(formatEther(value));
  if (!Number.isFinite(num)) return "0";
  return num.toLocaleString("zh-CN", {
    maximumFractionDigits: 6
  });
};

const parseEthInput = (value: string) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return NaN;
  return n;
};

const BuyConfirmDialog = ({
  open,
  listing,
  onClose,
  onConfirm,
  loading
}: {
  open: boolean;
  listing: MarketListing | null;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) => {
  const mounted = typeof document !== "undefined";
  if (!open || !mounted || !listing) return null;

  // 使用 portal 挂载到 body，避免被父容器 overflow 裁剪
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="u-stack-2">
          <p className="u-text-mini font-semibold uppercase tracking-[0.28em] text-slate-400">
            购买确认
          </p>
          <h3 className="text-lg font-semibold text-slate-900">
            确认购买 NFT #{listing.tokenId.toString()}
          </h3>
          <p className="u-text-body text-slate-600">
            卖家：{shortAddress(listing.seller)}
          </p>
          <p className="u-text-body font-semibold text-slate-900">
            价格：{formatEth(listing.price)} ETH
          </p>
        </div>
        <div className="mt-5 flex items-center justify-end u-gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button type="button" onClick={onConfirm} disabled={loading}>
            {loading ? "购买中" : "确认购买"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export const MarketBoard = () => {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const {
    listings,
    loading,
    error,
    pendingActionKey,
    lastUpdated,
    isReady,
    loadListings,
    cancelListing,
    invalidateListing,
    buyListing
  } = useMarketListings();

  const [tab, setTab] = useState<"all" | "mine">("all");
  const [query, setQuery] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy, setSortBy] = useState<"latest" | "priceAsc" | "priceDesc">(
    "latest"
  );
  const [visibleCountByFilter, setVisibleCountByFilter] = useState<
    Record<string, number>
  >({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [buyTarget, setBuyTarget] = useState<MarketListing | null>(null);

  const chainMismatch = chainId !== CHAIN_ID;
  const addressLower = address?.toLowerCase();
  const filterKey = `${tab}|${query.trim().toLowerCase()}|${minPrice.trim()}|${maxPrice.trim()}|${sortBy}`;
  const visibleCount = visibleCountByFilter[filterKey] ?? PAGE_SIZE;

  const setVisibleCount = (
    next: number | ((prev: number) => number)
  ) => {
    // 分筛选条件保存分页进度，切换筛选时不互相污染
    setVisibleCountByFilter((prev) => {
      const current = prev[filterKey] ?? PAGE_SIZE;
      const resolved = typeof next === "function" ? next(current) : next;
      return {
        ...prev,
        [filterKey]: Math.max(PAGE_SIZE, resolved)
      };
    });
  };

  const baseListings = useMemo(() => {
    // all：全站有效挂单；mine：当前钱包的有效挂单
    if (tab === "all") {
      return listings.filter((item) => item.active && item.valid);
    }
    if (!addressLower) return [];
    return listings.filter(
      (item) => item.active && item.seller.toLowerCase() === addressLower
    );
  }, [listings, tab, addressLower]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const min = minPrice.trim() ? parseEthInput(minPrice) : NaN;
    const max = maxPrice.trim() ? parseEthInput(maxPrice) : NaN;

    let next = baseListings.filter((item) => {
      if (keyword) {
        const tokenMatched = item.tokenId.toString().includes(keyword);
        const nameMatched =
          item.metadata.name?.toLowerCase().includes(keyword) ?? false;
        if (!tokenMatched && !nameMatched) return false;
      }

      const eth = Number(formatEther(item.price));
      if (!Number.isNaN(min) && eth < min) return false;
      if (!Number.isNaN(max) && eth > max) return false;
      return true;
    });

    if (sortBy === "priceAsc") {
      next = [...next].sort((a, b) => (a.price < b.price ? -1 : 1));
    } else if (sortBy === "priceDesc") {
      next = [...next].sort((a, b) => (a.price > b.price ? -1 : 1));
    }

    return next;
  }, [baseListings, query, minPrice, maxPrice, sortBy]);

  const visibleListings = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );
  const hasMore = filtered.length > visibleCount;

  const handleBuyClick = (listing: MarketListing) => {
    setActionError(null);
    if (!isConnected) {
      setShowConnectDialog(true);
      return;
    }
    if (chainMismatch) {
      setActionError("请切换到 Anvil 31337 网络后再购买");
      return;
    }
    setBuyTarget(listing);
  };

  const handleBuyConfirm = async () => {
    if (!buyTarget) return;
    setActionError(null);
    try {
      await buyListing(buyTarget);
      setBuyTarget(null);
      // 成交后跳转“我的藏品”，引导用户继续二次操作
      router.push("/collection");
    } catch (actionErr) {
      setActionError(
        actionErr instanceof Error ? actionErr.message : "购买失败"
      );
    }
  };

  const handleCancel = async (listing: MarketListing) => {
    setActionError(null);
    if (chainMismatch) {
      setActionError("请切换到 Anvil 31337 网络后再操作");
      return;
    }
    try {
      await cancelListing(listing.listingId);
    } catch (actionErr) {
      setActionError(
        actionErr instanceof Error ? actionErr.message : "取消上架失败"
      );
    }
  };

  const handleInvalidate = async (listing: MarketListing) => {
    setActionError(null);
    if (chainMismatch) {
      setActionError("请切换到 Anvil 31337 网络后再操作");
      return;
    }
    try {
      await invalidateListing(listing.listingId);
    } catch (actionErr) {
      setActionError(
        actionErr instanceof Error ? actionErr.message : "清理失效挂单失败"
      );
    }
  };

  if (!isReady) {
    return (
      <Card className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle>市场暂不可用</CardTitle>
          <p className="u-text-meta mt-1 text-slate-500">
            请配置 NEXT_PUBLIC_MARKET_ADDRESS 后重试
          </p>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="u-stack-6">
      <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between u-gap-3">
          <div>
            <CardTitle>NFT 市场</CardTitle>
            <p className="u-text-meta mt-1 text-slate-500">
              固定价买卖，默认展示有效挂单
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => loadListings()}
            disabled={loading}
            className="rounded-full"
          >
            {loading ? "刷新中" : "刷新列表"}
          </Button>
        </CardHeader>
        <CardContent className="u-stack-4">
          <div className="flex flex-wrap items-center u-gap-2">
            <Button
              type="button"
              variant={tab === "all" ? "primary" : "secondary"}
              className="rounded-full"
              onClick={() => setTab("all")}
            >
              全部挂单
            </Button>
            <Button
              type="button"
              variant={tab === "mine" ? "primary" : "secondary"}
              className="rounded-full"
              onClick={() => setTab("mine")}
            >
              我的上架
            </Button>
          </div>

          <div className="grid u-gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              placeholder="搜索 TokenId / 名称"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <Input
              placeholder="最低价 ETH"
              value={minPrice}
              onChange={(event) => setMinPrice(event.target.value)}
            />
            <Input
              placeholder="最高价 ETH"
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
            />
            <select
              className="u-text-body h-10 rounded-md border border-slate-200 bg-white px-3 text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200"
              value={sortBy}
              onChange={(event) =>
                setSortBy(event.target.value as "latest" | "priceAsc" | "priceDesc")
              }
            >
              <option value="latest">最新上架优先</option>
              <option value="priceAsc">价格从低到高</option>
              <option value="priceDesc">价格从高到低</option>
            </select>
          </div>

          {chainMismatch ? (
            <p className="u-text-body rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">
              当前网络非 31337，交易按钮已禁用
            </p>
          ) : null}

          {error ? (
            <p className="u-text-body text-rose-600">{error}</p>
          ) : actionError ? (
            <p className="u-text-body text-rose-600">{actionError}</p>
          ) : null}

          {filtered.length === 0 ? (
            <p className="u-text-body text-slate-500">暂无符合条件的挂单</p>
          ) : (
            <div className="grid u-gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleListings.map((item) => {
                const image = resolveImage(item.metadata.image);
                const isMine =
                  addressLower &&
                  item.seller.toLowerCase() === addressLower;
                const cardKey = `listing-${item.listingId.toString()}`;
                const pending =
                  pendingActionKey === `buy-${item.listingId.toString()}` ||
                  pendingActionKey === `cancel-${item.listingId.toString()}` ||
                  pendingActionKey === `invalidate-${item.listingId.toString()}`;

                return (
                  <div
                    key={cardKey}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="relative aspect-square bg-slate-50">
                      {image ? (
                        <img
                          src={image}
                          alt={item.metadata.name ?? "NFT"}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center u-text-meta text-slate-400">
                          暂无预览
                        </div>
                      )}
                      <span className="u-text-mini absolute left-2 top-2 rounded-full border border-slate-200 bg-white/90 px-2 py-0.5 font-semibold text-slate-700">
                        #{item.tokenId.toString()}
                      </span>
                    </div>
                    <div className="u-stack-2 border-t border-slate-200 px-3 pb-3 pt-2">
                      <p className="u-text-body font-semibold text-slate-900">
                        {item.metadata.name ?? `NFT #${item.tokenId.toString()}`}
                      </p>
                      <p className="u-text-meta text-slate-500">
                        卖家 {shortAddress(item.seller)}
                      </p>
                      <p className="u-text-body font-semibold text-slate-900">
                        {formatEth(item.price)} ETH
                      </p>
                      {!item.valid ? (
                        <p className="u-text-meta text-amber-700">
                          当前挂单已失效，可手动清理
                        </p>
                      ) : null}
                      {tab === "all" && item.valid ? (
                        <Button
                          type="button"
                          onClick={() => handleBuyClick(item)}
                          disabled={pending || chainMismatch || Boolean(isMine)}
                          className="h-8 rounded-full"
                        >
                          {isMine ? "我的挂单" : pending ? "处理中" : "购买"}
                        </Button>
                      ) : null}
                      {tab === "mine" ? (
                        item.valid ? (
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => handleCancel(item)}
                            disabled={pending || chainMismatch}
                            className="h-8 rounded-full"
                          >
                            {pending ? "处理中" : "取消上架"}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => handleInvalidate(item)}
                            disabled={pending || chainMismatch}
                            className="h-8 rounded-full"
                          >
                            {pending ? "处理中" : "清理失效挂单"}
                          </Button>
                        )
                      ) : null}
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
                className="rounded-full"
                onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
              >
                加载更多
              </Button>
            </div>
          ) : null}

          {lastUpdated ? (
            <p className="u-text-mini text-slate-500">
              更新 {new Date(lastUpdated).toLocaleTimeString("zh-CN")}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <ActivityPanel sticky={false} mode="market_trades" />

      <ConnectWalletDialog
        open={showConnectDialog}
        onClose={() => setShowConnectDialog(false)}
        description="连接钱包后可购买 NFT"
      />
      <BuyConfirmDialog
        open={Boolean(buyTarget)}
        listing={buyTarget}
        onClose={() => setBuyTarget(null)}
        onConfirm={handleBuyConfirm}
        loading={Boolean(
          buyTarget &&
            pendingActionKey === `buy-${buyTarget.listingId.toString()}`
        )}
      />
    </div>
  );
};
