import { cn } from "@/lib/utils";

export type WorkflowRailStatus = "pending" | "active" | "complete" | "warning" | "danger";

const CARD_CLASS_NAME: Record<WorkflowRailStatus, string> = {
  pending: "border-line-soft bg-white/70",
  active: "border-brand-pink/20 bg-bg-soft-pink/60",
  complete: "border-success-mint/20 bg-success-mint/10",
  warning: "border-warning-peach/20 bg-warning-peach/10",
  danger: "border-rose-200 bg-rose-50/80"
};

const BADGE_CLASS_NAME: Record<WorkflowRailStatus, string> = {
  pending: "bg-white text-text-muted border border-line-soft",
  active: "bg-brand-pink text-white",
  complete: "bg-success-mint text-white",
  warning: "bg-warning-peach text-white",
  danger: "bg-rose-500 text-white"
};

export function WorkflowStageRail({
  steps
}: {
  steps: Array<{
    label: string;
    description: string;
    status: WorkflowRailStatus;
  }>;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {steps.map((step, index) => (
        <div
          key={step.label}
          className={cn(
            "rounded-[1.35rem] border px-4 py-4 shadow-[0_10px_28px_rgba(251,114,153,0.04)] transition",
            CARD_CLASS_NAME[step.status]
          )}
        >
          <div className="flex items-start gap-3">
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-black", BADGE_CLASS_NAME[step.status])}>
              {index + 1}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-text-ink">{step.label}</div>
              <p className="mt-1 text-xs leading-5 text-text-muted">{step.description}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
