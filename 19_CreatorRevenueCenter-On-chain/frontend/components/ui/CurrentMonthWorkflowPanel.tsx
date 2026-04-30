import type { ReactNode } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { RoleTaskNotice } from "@/components/ui/RoleTaskNotice";
import { WorkflowStageRail } from "@/components/ui/WorkflowStageRail";
import { cn } from "@/lib/utils";
import type { WorkflowNoticeTone } from "@/lib/current-month-workflow";

export function CurrentMonthWorkflowPanel({
  eyebrow,
  monthLabel,
  statusLabel,
  statusTone,
  title,
  description,
  steps,
  nextStep,
  expectedResult,
  blockingReason,
  action,
  summary,
  className
}: {
  eyebrow: string;
  monthLabel: string;
  statusLabel: string;
  statusTone: WorkflowNoticeTone;
  title: string;
  description: string;
  steps: Array<{
    label: string;
    description: string;
    status: "pending" | "active" | "complete" | "warning" | "danger";
  }>;
  nextStep: string;
  expectedResult: string;
  blockingReason?: string | null;
  action?: ReactNode;
  summary?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("surface-section relative overflow-hidden p-6 md:p-8", className)}>
      <div className="absolute left-[-4rem] top-[-4rem] h-40 w-40 rounded-full bg-brand-pink/10 blur-3xl" />
      <div className="absolute bottom-[-3rem] right-[-2rem] h-40 w-40 rounded-full bg-success-mint/10 blur-3xl" />

      <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            <div className="soft-pill">{eyebrow}</div>
            <StatusBadge label={`当前月份：${monthLabel}`} tone="info" />
            <StatusBadge label={statusLabel} tone={statusTone} />
          </div>
          <div className="mt-5">
            <h2 className="text-3xl font-black tracking-tight text-text-ink md:text-4xl">{title}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-text-muted">{description}</p>
          </div>
        </div>

        {action ? <div className="w-full max-w-md shrink-0">{action}</div> : null}
      </div>

      <div className="relative mt-6">
        <WorkflowStageRail steps={steps} />
      </div>

      <div className={cn("relative mt-6 grid gap-3", blockingReason ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-3")}>
        <RoleTaskNotice label="当前阶段" value={statusLabel} tone={statusTone} />
        {blockingReason ? <RoleTaskNotice label="阻塞原因" value={blockingReason} tone={statusTone === "danger" ? "danger" : "warning"} /> : null}
        <RoleTaskNotice label="下一步" value={nextStep} tone="info" />
        <RoleTaskNotice label="结果预期" value={expectedResult} tone="success" />
      </div>

      {summary ? <div className="relative mt-6">{summary}</div> : null}
    </section>
  );
}
