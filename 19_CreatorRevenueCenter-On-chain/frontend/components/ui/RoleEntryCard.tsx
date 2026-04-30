import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";

export function RoleEntryCard({
  title,
  description,
  href,
  actionLabel,
  icon: Icon,
  iconTone,
  disabled = false,
  disabledReason,
  helperText,
  badgeLabel,
  badgeTone = "neutral"
}: {
  title: string;
  description?: string | null;
  href: string;
  actionLabel: string;
  icon: LucideIcon;
  iconTone: string;
  disabled?: boolean;
  disabledReason?: string | null;
  helperText?: string | null;
  badgeLabel?: string;
  badgeTone?: "neutral" | "info" | "success" | "warning" | "danger";
}) {
  const footerText = disabledReason ?? helperText ?? null;

  return (
    <div className={cn("surface-card flex h-full flex-col p-6 transition", disabled ? "" : "hover:-translate-y-1")}>
      <div className="flex items-start justify-between gap-3">
        <div className={cn("inline-flex rounded-2xl p-3", iconTone)}>
          <Icon className="h-6 w-6" />
        </div>
        {badgeLabel ? <StatusBadge label={badgeLabel} tone={badgeTone} /> : null}
      </div>

      <div className="mt-5">
        <h2 className="text-2xl font-semibold text-text-ink">{title}</h2>
        {description ? <p className="mt-2 min-h-12 text-sm leading-7 text-text-muted">{description}</p> : null}
      </div>

      <Link
        href={disabled ? "#" : href}
        aria-disabled={disabled}
        className={cn(
          "mt-8 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition",
          disabled
            ? "cursor-not-allowed border border-line-soft bg-white text-text-muted opacity-60"
            : "bg-brand-pink text-white shadow-[var(--shadow-soft-pink)] hover:bg-brand-pink-hover"
        )}
        onClick={(event) => {
          if (disabled) {
            event.preventDefault();
          }
        }}
      >
        {actionLabel}
        <ArrowRight className="h-4 w-4" />
      </Link>

      {footerText ? (
        <div className="mt-4 rounded-[1.1rem] border border-line-soft bg-white/75 px-4 py-3 text-xs leading-6 text-text-muted">
          {footerText}
        </div>
      ) : null}
    </div>
  );
}
