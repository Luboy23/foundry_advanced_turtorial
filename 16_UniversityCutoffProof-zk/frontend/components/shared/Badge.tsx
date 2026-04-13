import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  children,
  variant = "info"
}: {
  children: ReactNode;
  variant?: "info" | "success" | "warning" | "error";
}) {
  const variants = {
    info: "border-blue-100 bg-blue-50 text-blue-700",
    success: "border-emerald-100 bg-emerald-50 text-emerald-700",
    warning: "border-amber-100 bg-amber-50 text-amber-700",
    error: "border-rose-100 bg-rose-50 text-rose-700"
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-wide",
        variants[variant]
      )}
    >
      {children}
    </span>
  );
}
