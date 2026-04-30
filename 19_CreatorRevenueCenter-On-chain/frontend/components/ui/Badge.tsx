import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type BadgeProps = HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "success" | "warning" | "outline";
  children: ReactNode;
};

export function Badge({ className, variant = "default", children, ...props }: BadgeProps) {
  const variantClassName = {
    default: "bg-bg-soft-pink text-brand-pink border border-brand-pink/10",
    success: "bg-success-mint/10 text-success-mint border border-success-mint/15",
    warning: "bg-warning-peach/10 text-warning-peach border border-warning-peach/15",
    outline: "bg-white text-text-muted border border-line-soft"
  }[variant];

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
        variantClassName,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
