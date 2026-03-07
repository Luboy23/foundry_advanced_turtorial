"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const EmptyState = ({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  tone = "light"
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  tone?: "light" | "dark";
}) => {
  const isDark = tone === "dark";
  const handleAction = () => {
    if (actionHref) {
      window.location.href = actionHref;
      return;
    }
    onAction?.();
  };

  return (
    <div
      className={cn(
        "u-stack-2 rounded-2xl border border-dashed px-6 py-8 text-center",
        isDark
          ? "border-white/15 bg-white/5 text-white"
          : "border-slate-200 bg-slate-50/60 text-slate-900"
      )}
    >
      <p
        className={cn(
          "text-base font-semibold",
          isDark ? "text-white" : "text-slate-900"
        )}
      >
        {title}
      </p>
      {description ? (
        <p
          className={cn(
            "u-text-body",
            isDark ? "text-neutral-400" : "text-slate-600"
          )}
        >
          {description}
        </p>
      ) : null}
      {actionLabel ? (
        <Button
          type="button"
          variant="secondary"
          onClick={handleAction}
          className={cn(
            "mt-4 rounded-full",
            isDark &&
              "border-white/15 bg-white/10 text-white/80 hover:bg-white/20"
          )}
        >
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
};
