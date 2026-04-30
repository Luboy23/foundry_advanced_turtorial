import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type RecordDisplayCardAccent = "mint" | "peach";

const ACCENT_STYLES: Record<
  RecordDisplayCardAccent,
  {
    capsule: string;
    shadow: string;
  }
> = {
  mint: {
    capsule: "bg-success-mint/10 text-success-mint",
    shadow: "shadow-[0_12px_24px_rgba(59,178,115,0.08)]"
  },
  peach: {
    capsule: "bg-warning-peach/12 text-warning-peach",
    shadow: "shadow-[0_12px_24px_rgba(246,178,107,0.1)]"
  }
};

export function RecordDisplayCard({
  icon,
  accent,
  title,
  subtitle,
  amount,
  meta,
  subtitleTitle,
  className
}: {
  icon: ReactNode;
  accent: RecordDisplayCardAccent;
  title: string;
  subtitle: string;
  amount: string;
  meta: string;
  subtitleTitle?: string;
  className?: string;
}) {
  const accentStyle = ACCENT_STYLES[accent];

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-[1.5rem] border border-line-soft bg-white/90 p-4 transition",
        "shadow-[0_10px_28px_rgba(251,114,153,0.05)] hover:border-brand-pink/25 hover:bg-white",
        "md:flex-row md:items-center md:justify-between",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.35rem]",
            accentStyle.capsule,
            accentStyle.shadow
          )}
        >
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-base font-black tracking-tight text-text-ink">{title}</div>
          <div
            title={subtitleTitle ?? subtitle}
            className="mt-1 truncate font-mono text-[13px] leading-6 text-text-muted"
          >
            {subtitle}
          </div>
        </div>
      </div>

      <div className="shrink-0 md:min-w-[8.5rem] md:text-right">
        <div className="text-2xl font-black tracking-tight text-brand-pink">{amount}</div>
        <div className="mt-1 text-sm font-semibold text-text-muted">{meta}</div>
      </div>
    </div>
  );
}
