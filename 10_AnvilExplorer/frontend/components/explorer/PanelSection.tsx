import { cn } from "@/lib/utils";

/**
 * 通用面板容器：标题区 + 内容区。
 */
export default function PanelSection({
  title,
  description,
  kicker,
  action,
  className,
  bodyClassName,
  children,
}: {
  title: string;
  description?: string;
  kicker?: string;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("glass-panel soft-glow", className)}>
      <header className="border-b border-white/70 px-4 py-4 md:px-5">
        {kicker ? <p className="section-kicker">{kicker}</p> : null}
        <div className="mt-1 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h2 className="font-display value-wrap text-lg font-semibold text-slate-900">
              {title}
            </h2>
            {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </header>
      <div className={cn("px-4 py-4 md:px-5", bodyClassName)}>{children}</div>
    </section>
  );
}
