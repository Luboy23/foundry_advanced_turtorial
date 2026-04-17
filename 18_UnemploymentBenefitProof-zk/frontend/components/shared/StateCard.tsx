import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** 通用状态卡片的入参。 */
type StateCardProps = {
  title: string;
  description: string;
  tone?: "default" | "danger";
  action?: ReactNode;
};

/** 展示缺数据、无权限、处理中等状态的通用壳组件。 */
export function StateCard({ title, description, tone = "default", action }: StateCardProps) {
  return (
    <section
      className={cn(
        "card max-w-3xl space-y-5",
        tone === "danger" ? "border-brand-seal/25 bg-[#FFF8F7]" : "border-line-soft bg-surface"
      )}
    >
      <div className="space-y-2">
        <h2 className={cn("text-xl font-semibold", tone === "danger" ? "text-brand-seal" : "text-brand-ink")}>
          {title}
        </h2>
        <p className="text-sm leading-6 text-text-muted">{description}</p>
      </div>
      {action ? <div>{action}</div> : null}
    </section>
  );
}
