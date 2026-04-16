"use client";

import { useEffect, useMemo, useState } from "react";
import { parseEther } from "viem";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useActionFeedback } from "@/hooks/useActionFeedback";
import { getFriendlyErrorMessage } from "@/lib/friendly-errors";
import { cn, formatEth } from "@/lib/utils";
import type { MarketplaceProduct } from "@/types/domain";

type ProductEditorCardProps = {
  product: MarketplaceProduct;
  onUpdate: (next: { priceWei: bigint; stock: number; active: boolean }) => Promise<void>;
};

type DraftValidation<T> = {
  error: string | null;
  value: T | null;
};

function normalizePriceDraft(value: string) {
  return value.startsWith(".") ? `0${value}` : value;
}

function validatePriceDraft(priceEth: string): DraftValidation<bigint> {
  const trimmed = priceEth.trim();

  if (!trimmed) {
    return {
      error: "请输入商品售价。",
      value: null
    };
  }

  if (!/^\d*\.?\d*$/.test(trimmed)) {
    return {
      error: "价格只能输入数字和一个小数点。",
      value: null
    };
  }

  if (trimmed === "." || trimmed.endsWith(".")) {
    return {
      error: "请输入有效的 ETH 价格。",
      value: null
    };
  }

  const normalized = normalizePriceDraft(trimmed);
  const fraction = normalized.split(".")[1] ?? "";
  if (fraction.length > 18) {
    return {
      error: "价格最多支持 18 位小数。",
      value: null
    };
  }

  try {
    const priceWei = parseEther(normalized);
    if (priceWei <= 0n) {
      return {
        error: "价格必须大于 0 ETH。",
        value: null
      };
    }

    return {
      error: null,
      value: priceWei
    };
  } catch {
    return {
      error: "请输入有效的 ETH 价格。",
      value: null
    };
  }
}

function validateStockDraft(stock: string): DraftValidation<number> {
  const trimmed = stock.trim();

  if (!trimmed) {
    return {
      error: "请输入库存数量。",
      value: null
    };
  }

  if (!/^\d+$/.test(trimmed)) {
    return {
      error: "库存必须是非负整数。",
      value: null
    };
  }

  const stockValue = Number(trimmed);
  if (!Number.isSafeInteger(stockValue)) {
    return {
      error: "库存数量超出可支持范围。",
      value: null
    };
  }

  return {
    error: null,
    value: stockValue
  };
}

export function ProductEditorCard({ product, onUpdate }: ProductEditorCardProps) {
  const { showError, showSuccess } = useActionFeedback();
  const currentPriceDraft = formatEth(product.priceWei).replace(" ETH", "");
  const currentStockDraft = String(product.stock);
  const [priceEth, setPriceEth] = useState(currentPriceDraft);
  const [stock, setStock] = useState(currentStockDraft);
  const [active, setActive] = useState(product.active);
  const [saving, setSaving] = useState(false);
  const [priceRejectedError, setPriceRejectedError] = useState<string | null>(null);
  const [stockRejectedError, setStockRejectedError] = useState<string | null>(null);
  const currentPrice = formatEth(product.priceWei);
  const currentStock = `${product.stock} 件`;

  useEffect(() => {
    setPriceEth(currentPriceDraft);
    setStock(currentStockDraft);
    setActive(product.active);
    setPriceRejectedError(null);
    setStockRejectedError(null);
  }, [currentPriceDraft, currentStockDraft, product.active]);

  const priceValidation = useMemo(() => validatePriceDraft(priceEth), [priceEth]);
  const stockValidation = useMemo(() => validateStockDraft(stock), [stock]);
  const priceError = priceRejectedError ?? priceValidation.error;
  const stockError = stockRejectedError ?? stockValidation.error;
  const blockingError = priceError ?? stockError;
  const hasBlockingErrors = Boolean(priceError || stockError);
  const hasSemanticChanges = Boolean(
    active !== product.active ||
      (priceValidation.value !== null && priceValidation.value !== product.priceWei) ||
      (stockValidation.value !== null && stockValidation.value !== product.stock)
  );
  const saveButtonLabel = saving
    ? "保存中..."
    : hasBlockingErrors
      ? "请先修正输入"
      : hasSemanticChanges
        ? "保存商品变更"
        : "当前已是最新设置";

  function handlePriceChange(nextValue: string) {
    if (nextValue === "" || /^\d*\.?\d*$/.test(nextValue)) {
      setPriceEth(nextValue);
      setPriceRejectedError(null);
      return;
    }

    setPriceRejectedError("价格只能输入数字和一个小数点。");
  }

  function handleStockChange(nextValue: string) {
    if (nextValue === "" || /^\d+$/.test(nextValue)) {
      setStock(nextValue);
      setStockRejectedError(null);
      return;
    }

    setStockRejectedError("库存必须是非负整数。");
  }

  return (
    <article className="glass-card space-y-5 p-5 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1 space-y-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone="neutral">{product.category}</StatusBadge>
              <StatusBadge tone={product.active ? "success" : "danger"}>{product.active ? "在售中" : "已下架"}</StatusBadge>
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-brand-green">{product.displayName}</h3>
              <p className="text-sm text-text-muted">当前链上设置如下，可直接在下方调整售价、库存与上架状态。</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.35rem] border border-brand-green/10 bg-white/85 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">当前售价</p>
              <p className="mt-2 text-base font-semibold text-brand-green">{currentPrice}</p>
            </div>
            <div className="rounded-[1.35rem] border border-brand-green/10 bg-white/85 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">当前库存</p>
              <p className="mt-2 text-base font-semibold text-brand-green">{currentStock}</p>
            </div>
          </div>
        </div>

        <div className="flex w-full items-center justify-between gap-3 rounded-[1.35rem] border border-brand-green/10 bg-bg-ivory/80 px-3 py-2.5 sm:w-auto sm:flex-none sm:justify-start">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] whitespace-nowrap text-text-muted">修改在售状态</p>
          <div className="flex rounded-full bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setActive(true)}
              aria-pressed={active}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition sm:px-3.5",
                active ? "bg-brand-green text-paper-white" : "text-text-muted"
              )}
            >
              在售
            </button>
            <button
              type="button"
              onClick={() => setActive(false)}
              aria-pressed={!active}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition sm:px-3.5",
                !active ? "bg-brand-green text-paper-white" : "text-text-muted"
              )}
            >
              下架
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-text-muted">
          <span>修改售价 ETH</span>
          <input
            value={priceEth}
            onChange={(event) => handlePriceChange(event.target.value)}
            aria-invalid={Boolean(priceError)}
            className={cn(
              "w-full rounded-2xl border bg-white px-4 py-3 text-brand-green outline-none ring-0 transition",
              priceError ? "border-rose-300 bg-rose-50/60" : "border-brand-green/10"
            )}
            inputMode="decimal"
            placeholder="例如 1.0"
          />
          {priceError ? <p className="text-sm leading-5 text-rose-600">{priceError}</p> : null}
        </label>
        <label className="space-y-2 text-sm text-text-muted">
          <span>修改库存</span>
          <input
            value={stock}
            onChange={(event) => handleStockChange(event.target.value)}
            aria-invalid={Boolean(stockError)}
            className={cn(
              "w-full rounded-2xl border bg-white px-4 py-3 text-brand-green outline-none ring-0 transition",
              stockError ? "border-rose-300 bg-rose-50/60" : "border-brand-green/10"
            )}
            inputMode="numeric"
          />
          {stockError ? <p className="text-sm leading-5 text-rose-600">{stockError}</p> : null}
        </label>
      </div>

      <div className="space-y-3">
        {blockingError ? <p className="text-sm leading-6 text-rose-600">{blockingError}</p> : null}
        <div className="flex justify-end">
          <button
            disabled={saving || !hasSemanticChanges || hasBlockingErrors}
            onClick={async () => {
              setSaving(true);
              try {
                if (blockingError || priceValidation.value === null || stockValidation.value === null) {
                  throw new Error(blockingError ?? "请先修正输入后再保存。");
                }

                if (!hasSemanticChanges) {
                  return;
                }

                const nextPriceWei = priceValidation.value;
                const nextStock = stockValidation.value;

                await onUpdate({
                  priceWei: nextPriceWei,
                  stock: nextStock,
                  active
                });

                showSuccess({
                  title: "商品变更已保存",
                  description: `${product.displayName} 已更新为 ${formatEth(nextPriceWei)}，库存 ${nextStock} 件，当前状态为 ${active ? "在售" : "已下架"}。`
                });
              } catch (error) {
                showError({
                  title: "保存失败",
                  description: getFriendlyErrorMessage(error, "seller-update-product")
                });
              } finally {
                setSaving(false);
              }
            }}
            className="btn-primary"
          >
            {saveButtonLabel}
          </button>
        </div>
      </div>
    </article>
  );
}
