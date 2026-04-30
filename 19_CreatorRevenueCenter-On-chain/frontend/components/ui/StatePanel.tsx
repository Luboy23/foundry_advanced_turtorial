import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatePanel({
  title,
  description,
  action,
  tone = "default"
}: {
  title: string;
  description: string;
  action?: ReactNode;
  tone?: "default" | "warning";
}) {
  return (
    <div
      className={cn(
        "surface-card w-full self-start min-w-0 p-6",
        tone === "warning" ? "border-warning-peach/25 bg-warning-peach/5" : ""
      )}
    >
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-text-ink">{title}</h2>
          <p className="mt-1 text-sm leading-7 text-text-muted">{description}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}
