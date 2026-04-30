import { cn } from "@/lib/utils";

export function StatusBadge({
  label,
  tone = "neutral"
}: {
  label: string;
  tone?: "neutral" | "info" | "success" | "warning" | "danger";
}) {
  const toneClassName = {
    neutral: "border-line-soft bg-white text-text-muted",
    info: "border-brand-pink/15 bg-bg-soft-pink text-brand-pink",
    success: "border-success-mint/20 bg-success-mint/10 text-success-mint",
    warning: "border-warning-peach/20 bg-warning-peach/10 text-warning-peach",
    danger: "border-rose-200 bg-rose-50 text-rose-700"
  }[tone];

  return (
    <span className={cn("inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold", toneClassName)}>
      {label}
    </span>
  );
}
