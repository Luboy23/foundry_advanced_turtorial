"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type SyntheticEvent
} from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectWalletDialog } from "@/components/ConnectWalletDialog";
import { EmptyState } from "@/components/EmptyState";
import { CONTRACTS_READY } from "@/lib/contracts";
import { formatTimestamp, shortAddress } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  resolveImage,
  resolveIpfsFallback,
  useGalleryData,
  type GalleryMode,
  type NftItem,
  type NftMetadata
} from "@/hooks/useGalleryData";

const hasMetadata = (metadata: NftMetadata) =>
  Boolean(
    metadata.name ||
      metadata.symbol ||
      metadata.description ||
      metadata.image ||
      metadata.collection
  );

// 简易 in-view hook：进入视口后只触发一次
const useInView = (options?: IntersectionObserverInit) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        observer.disconnect();
      }
    }, options);
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [options]);

  return { ref, inView };
};

const GalleryCard = ({
  item,
  mode,
  isDark,
  onBurn,
  pendingTokenId,
  onImageError,
  onNeedMetadata,
  observerOptions
}: {
  item: NftItem;
  mode: GalleryMode;
  isDark: boolean;
  onBurn: (tokenId: bigint) => void;
  pendingTokenId: bigint | null;
  onImageError: (
    event: SyntheticEvent<HTMLImageElement>,
    uri?: string
  ) => void;
  onNeedMetadata: (tokenId: bigint, tokenUri: string) => void;
  observerOptions: IntersectionObserverInit;
}) => {
  const { ref, inView } = useInView(observerOptions);
  const requestedRef = useRef(false);
  const metadataReady = hasMetadata(item.metadata);

  useEffect(() => {
    if (!inView || metadataReady || requestedRef.current) return;
    requestedRef.current = true;
    // 进入视口后再请求 metadata，减少首屏压力
    onNeedMetadata(item.tokenId, item.tokenUri);
  }, [inView, metadataReady, onNeedMetadata, item.tokenId, item.tokenUri]);

  const image = resolveImage(item.metadata.image);
  const title = metadataReady
    ? item.metadata.name ?? `NFT #${item.tokenId}`
    : "加载中";
  const collectionName = metadataReady
    ? item.metadata.collection ?? item.metadata.symbol ?? "未命名"
    : "正在读取";
  const mintedTime = item.mintedTimestamp
    ? formatTimestamp(item.mintedTimestamp)
    : "-";

  if (mode === "community") {
    return (
      <div
        ref={ref}
        className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="relative aspect-square bg-slate-50">
          {metadataReady ? (
            image ? (
              <img
                src={image}
                alt={item.metadata.name ?? "NFT"}
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
                onError={(event) =>
                  onImageError(event, item.metadata.image ?? "")
                }
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center u-text-meta text-slate-400">
                暂无预览
              </div>
            )
          ) : (
            <div className="h-full w-full animate-pulse bg-gradient-to-br from-slate-100 via-slate-200/70 to-slate-100" />
          )}
          <div className="u-text-mini absolute bottom-2 right-2 rounded-full border border-slate-200 bg-white/90 px-2 py-0.5 font-semibold text-slate-600">
            #{item.tokenId.toString()}
          </div>
        </div>
        <div className="u-stack-2 border-t border-slate-200 bg-white px-3 pb-3 pt-2">
          <div>
            {metadataReady ? (
              <>
                <p className="u-text-body font-semibold text-slate-900">
                  {title}
                </p>
                <p className="u-text-meta text-slate-500">
                  {collectionName}
                </p>
              </>
            ) : (
              <div className="u-stack-2">
                <div className="h-3 w-28 rounded-full bg-gradient-to-r from-slate-100 via-slate-200/70 to-slate-100 animate-pulse" />
                <div className="h-2 w-16 rounded-full bg-gradient-to-r from-slate-100 via-slate-200/70 to-slate-100 animate-pulse" />
              </div>
            )}
          </div>
          <div className="flex items-center justify-between u-text-meta text-slate-500">
            <span>铸造时间</span>
            <span className="text-slate-700">{mintedTime}</span>
          </div>
          <div className="flex items-center justify-between u-text-meta text-slate-500">
            <span>持有人</span>
            <span className="text-slate-700">
              {shortAddress(item.owner)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const cardClass = cn(
    "group overflow-hidden rounded-3xl border shadow-sm transition hover:-translate-y-0.5",
    isDark
      ? "border-white/10 bg-neutral-900/95 shadow-[0_18px_40px_rgba(0,0,0,0.35)] hover:border-rose-300/30"
      : "border-slate-200 bg-white shadow-sm hover:border-slate-300"
  );
  const mediaClass = cn(
    "relative aspect-[4/3] overflow-hidden",
    isDark ? "bg-neutral-800" : "bg-slate-50"
  );
  const placeholderClass = cn(
    "flex h-full w-full items-center justify-center u-text-meta",
    isDark ? "bg-neutral-800 text-neutral-400" : "bg-slate-50 text-slate-400"
  );
  const badgeClass = cn(
    "u-text-mini rounded-md px-2 py-1 font-semibold",
    isDark
      ? "bg-white/10 text-white/80"
      : "border border-slate-200 bg-slate-50 text-slate-600"
  );
  const metaWrapClass = cn(
    "u-stack-3 border-t px-4 pb-4 pt-3",
    isDark
      ? "border-white/10 bg-neutral-900/90"
      : "border-slate-200 bg-white"
  );
  const titleClass = cn(
    "u-text-body font-semibold",
    isDark ? "text-white" : "text-slate-900"
  );
  const subClass = cn(
    "u-text-meta mt-1",
    isDark ? "text-neutral-400" : "text-slate-500"
  );
  const descClass = cn(
    "u-text-meta",
    isDark ? "text-neutral-400" : "text-slate-500"
  );
  const infoRowClass = cn(
    "flex items-center justify-between u-text-meta",
    isDark ? "text-neutral-500" : "text-slate-500"
  );
  const infoValueClass = cn(
    "u-text-meta",
    isDark ? "text-neutral-300" : "text-slate-700"
  );

  return (
    <div ref={ref} className={cardClass}>
      <div className={mediaClass}>
        {metadataReady ? (
          image ? (
            <img
              src={image}
              alt={item.metadata.name ?? "NFT"}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
              loading="lazy"
              decoding="async"
              onError={(event) =>
                onImageError(event, item.metadata.image ?? "")
              }
            />
          ) : (
            <div className={placeholderClass}>暂无预览</div>
          )
        ) : (
          <div className="h-full w-full animate-pulse bg-gradient-to-br from-slate-100 via-slate-200/70 to-slate-100" />
        )}
        <div
          className={cn(
            "absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full shadow-sm",
            isDark
              ? "bg-black/60 text-white"
              : "border border-slate-200 bg-white/90 text-slate-700"
          )}
        >
          <svg
            viewBox="0 0 256 417"
            width="14"
            height="14"
            aria-hidden="true"
            className="opacity-90"
          >
            <path
              fill="currentColor"
              d="M127.6 0l-2.8 9.5v273.6l2.8 2.8 127.6-75.3L127.6 0z"
            />
            <path
              fill="currentColor"
              d="M127.6 0L0 210.6l127.6 75.3V0z"
            />
            <path
              fill="currentColor"
              d="M127.6 312.9l-1.6 2v99.9l1.6 4.6 127.7-180.2-127.7 73.7z"
            />
            <path
              fill="currentColor"
              d="M127.6 419.4V312.9L0 239.2l127.6 180.2z"
            />
          </svg>
        </div>
      </div>
      <div className={metaWrapClass}>
        <div className="flex items-start justify-between u-gap-3">
          <div>
            {metadataReady ? (
              <>
                <p className={titleClass}>{title}</p>
                <p className={subClass}>{collectionName}</p>
              </>
            ) : (
              <div className="u-stack-2">
                <div className="h-3 w-24 rounded-full bg-gradient-to-r from-slate-200/70 via-slate-200/40 to-slate-200/70 animate-pulse" />
                <div className="h-2 w-16 rounded-full bg-gradient-to-r from-slate-200/70 via-slate-200/40 to-slate-200/70 animate-pulse" />
              </div>
            )}
          </div>
          <div className="flex items-center u-gap-2">
            <span className={badgeClass}>#{item.tokenId.toString()}</span>
          </div>
        </div>
        {item.metadata.description ? (
          <p className={descClass}>{item.metadata.description}</p>
        ) : null}
        <div className={infoRowClass}>
          <span>持有人</span>
          <span className={infoValueClass}>
            {shortAddress(item.owner)}
          </span>
        </div>
        {mode === "mine" ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => onBurn(item.tokenId)}
            disabled={pendingTokenId === item.tokenId}
            className={cn(
              "u-text-meta mt-2 h-8 w-full rounded-full",
              isDark
                ? "border-white/10 bg-white/10 text-white/80 hover:bg-white/20"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            )}
          >
            {pendingTokenId === item.tokenId ? "销毁中" : "销毁 NFT"}
          </Button>
        ) : null}
      </div>
    </div>
  );
};

export const NftGallery = ({
  mode,
  title,
  description,
  tone = "light"
}: {
  mode: GalleryMode;
  title: string;
  description?: string;
  tone?: "light" | "dark";
}) => {
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const isDark = tone === "dark";
  const observerOptions = useMemo(
    () => ({ rootMargin: "200px" }),
    []
  );

  const {
    filtered,
    visibleItems,
    hasMore,
    pageSize,
    setVisibleCount,
    loading,
    error,
    actionError,
    pendingTokenId,
    lastUpdated,
    isConnected,
    loadItems,
    ensureMetadata,
    handleBurn
  } = useGalleryData({
    mode,
    onRequireConnect: () => setShowConnectDialog(true)
  });

  const handleImageError = (
    event: SyntheticEvent<HTMLImageElement>,
    uri?: string
  ) => {
    if (!uri) return;
    const target = event.currentTarget;
    if (target.dataset.fallback === "1") return;
    const fallback = resolveIpfsFallback(uri);
    if (fallback === target.src) return;
    target.dataset.fallback = "1";
    target.src = fallback;
  };

  const gridClass =
    mode === "community"
      ? "grid u-gap-4 sm:grid-cols-3 lg:grid-cols-4"
      : "grid u-gap-4 sm:grid-cols-2 lg:grid-cols-3";
  const emptyState = useMemo(() => {
    if (mode === "mine") {
      if (!isConnected) {
        return {
          title: "未连接钱包",
          description: "连接后查看你的藏品",
          actionLabel: "连接钱包",
          actionHref: undefined,
          action: () => setShowConnectDialog(true)
        };
      }
      return {
        title: "还没有藏品",
        description: "去铸造一些吧",
        actionLabel: "去铸造",
        actionHref: "/#mint",
        action: undefined
      };
    }
    return {
      title: "暂无作品",
      description: "去铸造第一件",
      actionLabel: "去铸造",
      actionHref: "/#mint",
      action: undefined
    };
  }, [isConnected, mode, setShowConnectDialog]);

  if (!CONTRACTS_READY) {
    return (
      <Card
        className={cn(
          "mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm",
          isDark && "border-white/10 bg-neutral-950/90 text-white"
        )}
      >
        <CardHeader>
          <CardTitle className={cn(isDark && "text-white")}>
            {title}
          </CardTitle>
          <p
            className={cn(
              "u-text-meta mt-1",
              isDark ? "text-neutral-400" : "text-slate-500"
            )}
          >
            请配置合约地址
          </p>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm",
        isDark &&
          "border-white/10 bg-neutral-950/90 text-white shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between u-gap-3">
        <div>
          <CardTitle className={cn(isDark && "text-white")}>
            {title}
          </CardTitle>
          {description ? (
            <p
              className={cn(
                "u-text-meta mt-1",
                isDark ? "text-neutral-400" : "text-slate-500"
              )}
            >
              {description}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            if (!isConnected) {
              setShowConnectDialog(true);
              return;
            }
            setVisibleCount(pageSize);
            loadItems();
          }}
          disabled={loading}
          className={cn(
            "rounded-full",
            isDark &&
              "border-white/10 bg-white/10 text-white/80 hover:bg-white/20"
          )}
        >
          {loading ? "刷新中" : "刷新列表"}
        </Button>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className={cn("u-text-body", isDark ? "text-rose-200" : "text-rose-600")}>
            {error}
          </p>
        ) : actionError ? (
          <p className={cn("u-text-body", isDark ? "text-rose-200" : "text-rose-600")}>
            {actionError}
          </p>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={emptyState.title}
            description={emptyState.description}
            actionLabel={emptyState.actionLabel}
            actionHref={emptyState.actionHref}
            onAction={emptyState.action}
            tone={tone}
          />
        ) : (
          <div className={gridClass}>
            {visibleItems.map((item) => (
              <GalleryCard
                key={item.tokenId.toString()}
                item={item}
                mode={mode}
                isDark={isDark}
                onBurn={handleBurn}
                pendingTokenId={pendingTokenId}
                onImageError={handleImageError}
                onNeedMetadata={ensureMetadata}
                observerOptions={observerOptions}
              />
            ))}
          </div>
        )}
        {!error && !actionError && filtered.length > 0 && hasMore ? (
          <div className="mt-6 flex justify-center">
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setVisibleCount((prev) => prev + pageSize)
              }
              className="rounded-full"
            >
              加载更多
            </Button>
          </div>
        ) : null}
        {lastUpdated ? (
          <p
            className={cn(
              "u-text-mini mt-3",
              isDark ? "text-neutral-500" : "text-slate-500"
            )}
          >
            更新 {new Date(lastUpdated).toLocaleTimeString("zh-CN")}
          </p>
        ) : null}
      </CardContent>
      <ConnectWalletDialog
        open={showConnectDialog}
        onClose={() => setShowConnectDialog(false)}
        description="连接后可查看"
      />
    </Card>
  );
};
