import { cn } from "@/lib/utils";

type StatePanelProps = {
  title: string;
  description: string;
  tone?: "default" | "warning" | "danger";
  action?: React.ReactNode;
  className?: string;
};

export function StatePanel({ title, description, tone = "default", action, className }: StatePanelProps) {
  return (
    <div
      className={cn(
        "rounded-3xl border p-6 shadow-sm",
        tone === "default" && "border-brand-green/10 bg-surface",
        tone === "warning" && "border-brand-amber/20 bg-brand-amber/5",
        tone === "danger" && "border-rose-200 bg-rose-50",
        className
      )}
    >
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-brand-green">{title}</h3>
        <p className="text-sm leading-6 text-text-muted">{description}</p>
      </div>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
