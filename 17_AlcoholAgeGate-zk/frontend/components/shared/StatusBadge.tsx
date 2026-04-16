import { cn } from "@/lib/utils";

type StatusBadgeProps = {
  tone?: "success" | "warning" | "danger" | "neutral";
  children: React.ReactNode;
};

export function StatusBadge({ tone = "neutral", children }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide",
        tone === "success" && "bg-emerald-100 text-emerald-700",
        tone === "warning" && "bg-amber-100 text-amber-700",
        tone === "danger" && "bg-rose-100 text-rose-700",
        tone === "neutral" && "bg-brand-green/8 text-brand-green"
      )}
    >
      {children}
    </span>
  );
}
