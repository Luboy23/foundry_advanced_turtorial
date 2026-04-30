import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, LoaderCircle, PackageOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export function LoadingState({
  title,
  description
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="w-full self-start min-w-0 rounded-[1.75rem] border border-dashed border-line-soft bg-white/75 px-6 py-5 shadow-[var(--shadow-soft-pink)]">
      <div className="flex items-center gap-4">
        <LoaderCircle className="h-8 w-8 shrink-0 animate-spin text-brand-pink" />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-text-ink">{title}</h3>
          {description ? <p className="mt-1 text-sm leading-7 text-text-muted">{description}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  variant = "default"
}: {
  title: string;
  description: string;
  action?: ReactNode;
  variant?: "default" | "compact";
}) {
  const compact = variant === "compact";

  return (
    <div
      className={cn(
        "w-full self-start min-w-0 rounded-[1.75rem] border border-dashed border-line-soft bg-white/75 px-6 py-5 shadow-[var(--shadow-soft-pink)]",
        compact ? "mx-auto max-w-3xl" : ""
      )}
    >
      <div className="flex items-center gap-4">
        <PackageOpen className={cn("shrink-0 text-text-muted", compact ? "h-10 w-10" : "h-8 w-8")} />
        <div className="min-w-0 flex-1">
          <h3 className={cn("font-semibold text-text-ink", compact ? "text-lg" : "text-base")}>{title}</h3>
          <p className={cn("mt-1 text-sm leading-7 text-text-muted", compact ? "max-w-xl" : "")}>{description}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

export function ErrorState({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="w-full self-start min-w-0 rounded-[1.75rem] border border-rose-200 bg-rose-50 px-6 py-5 shadow-[var(--shadow-soft-pink)]">
      <div className="flex items-center gap-4">
        <AlertCircle className="h-8 w-8 shrink-0 text-rose-600" />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-rose-900">{title}</h3>
          <p className="mt-1 text-sm leading-7 text-rose-700">{description}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

export function InfoNotice({
  title,
  description,
  tone = "info",
  action
}: {
  title: string;
  description: string;
  tone?: "info" | "warning" | "success";
  action?: ReactNode;
}) {
  const toneClassName = {
    info: "border-brand-pink/10 bg-bg-soft-pink/65 text-text-ink",
    warning: "border-warning-peach/20 bg-warning-peach/10 text-text-ink",
    success: "border-success-mint/20 bg-success-mint/10 text-text-ink"
  }[tone];

  const toneIconClassName = {
    info: "text-brand-pink",
    warning: "text-warning-peach",
    success: "text-success-mint"
  }[tone];

  const Icon = tone === "success" ? CheckCircle2 : Info;

  return (
    <div className={cn("rounded-[1.5rem] border p-4", toneClassName)}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-3">
          <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", toneIconClassName)} />
          <div>
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="mt-1 text-sm leading-6 text-text-muted">{description}</p>
          </div>
        </div>
        {action ? <div className="md:shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}
