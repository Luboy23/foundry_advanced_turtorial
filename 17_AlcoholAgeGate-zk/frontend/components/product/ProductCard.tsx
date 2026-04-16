import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import type { MarketplaceProduct } from "@/types/domain";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { cn } from "@/lib/utils";

type ProductCardProps = {
  product: MarketplaceProduct;
  disabled?: boolean;
  disabledReason?: string | null;
  variant?: "default" | "compact";
};

export function ProductCard({
  product,
  disabled = false,
  disabledReason = null,
  variant = "default"
}: ProductCardProps) {
  const compact = variant === "compact";

  return (
    <article
      className={cn(
        "group shelf-card w-full overflow-hidden",
        compact ? "max-w-[19.5rem]" : ""
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden bg-[linear-gradient(180deg,_rgba(255,253,248,0.98)_0%,_rgba(245,238,220,0.92)_100%)]",
          compact ? "aspect-[7/8]" : "aspect-[4/5]"
        )}
      >
        <Image
          src={product.imageSrc}
          alt={product.imageAlt}
          fill
          sizes={compact ? "(max-width: 768px) 100vw, 19.5rem" : "(max-width: 768px) 100vw, 50vw"}
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          priority={false}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(30,43,37,0.04)_0%,_rgba(30,43,37,0)_45%,_rgba(30,43,37,0.14)_100%)]" />
        <div className={cn("absolute inset-x-0 top-0 flex items-start justify-between", compact ? "p-3.5" : "p-5")}>
          <StatusBadge tone={product.active ? "success" : "danger"}>
            {product.active ? "在售" : "已下架"}
          </StatusBadge>
          <span
            className={cn(
              "rounded-full bg-white/88 font-semibold text-brand-green shadow-sm",
              compact ? "px-2 py-1 text-[10px]" : "px-3 py-1 text-xs"
            )}
          >
            库存 {product.stock}
          </span>
        </div>
      </div>
      <div className={cn(compact ? "space-y-3 p-4" : "space-y-4 p-6")}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-amber">
            {product.category}
          </span>
          <span className={cn("text-text-muted", compact ? "text-[13px]" : "text-sm")}>
            {product.displayPrice}
          </span>
        </div>
        <div className={cn("space-y-2", compact ? "min-h-0" : "min-h-[7.5rem]")}>
          <h3 className={cn("font-semibold text-brand-green", compact ? "text-[1.02rem] leading-6" : "text-xl")}>
            {product.displayName}
          </h3>
          <p className={cn("text-text-muted", compact ? "text-[12px] leading-5" : "text-sm leading-6")}>
            {product.description}
          </p>
        </div>
        {disabled ? (
          <div className="space-y-2">
            <span
              title={disabledReason ?? "当前钱包没有访问商品详情的权限。"}
              className={cn(
                "inline-flex cursor-not-allowed items-center gap-2 font-semibold text-brand-amber/50",
                compact ? "text-[13px]" : "text-sm"
              )}
            >
              查看详情
              <ArrowRight className="h-4 w-4" />
            </span>
            <p className={cn("leading-5 text-text-muted", compact ? "text-[11px]" : "text-xs")}>
              {disabledReason ?? "当前钱包没有访问商品详情的权限。"}
            </p>
          </div>
        ) : (
          <Link
            href={`/products/${product.productIdLabel}`}
            className={cn(
              "inline-flex items-center gap-2 font-semibold text-brand-amber transition hover:gap-3",
              compact ? "text-[13px]" : "text-sm"
            )}
          >
            查看详情
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </article>
  );
}
