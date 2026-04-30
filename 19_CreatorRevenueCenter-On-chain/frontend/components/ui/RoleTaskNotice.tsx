import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { WorkflowNoticeTone } from "@/lib/current-month-workflow";

const TONE_CLASS_NAME: Record<WorkflowNoticeTone, string> = {
  neutral: "border-line-soft bg-white/80",
  info: "border-brand-pink/15 bg-bg-soft-pink/65",
  success: "border-success-mint/20 bg-success-mint/10",
  warning: "border-warning-peach/20 bg-warning-peach/10",
  danger: "border-rose-200 bg-rose-50/80"
};

const LABEL_CLASS_NAME: Record<WorkflowNoticeTone, string> = {
  neutral: "text-text-muted/80",
  info: "text-brand-pink",
  success: "text-success-mint",
  warning: "text-warning-peach",
  danger: "text-rose-700"
};

export function RoleTaskNotice({
  label,
  value,
  tone = "neutral"
}: {
  label: string;
  value: ReactNode;
  tone?: WorkflowNoticeTone;
}) {
  return (
    <div className={cn("rounded-[1.35rem] border p-4 shadow-[0_10px_28px_rgba(251,114,153,0.04)]", TONE_CLASS_NAME[tone])}>
      <div className={cn("text-[11px] font-black uppercase tracking-[0.22em]", LABEL_CLASS_NAME[tone])}>{label}</div>
      <div className="mt-2 text-sm leading-6 text-text-ink">{value}</div>
    </div>
  );
}
