import { cn } from "@/lib/utils";

/**
 * 指标卡片：展示 label/value/hint 三层信息。
 */
export default function MetricCard({
  label,
  value,
  hint,
  className,
  valueClassName,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <article className={cn("metric-tile soft-glow", className)}>
      <p className="section-kicker">{label}</p>
      <div
        className={cn(
          "value-wrap font-display mt-2 text-2xl font-semibold text-slate-900",
          valueClassName
        )}
      >
        {value}
      </div>
      {hint ? <p className="value-wrap mt-2 text-xs text-slate-500">{hint}</p> : null}
    </article>
  );
}
