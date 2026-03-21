import { cn } from "@/lib/utils";

/**
 * 数据表壳层：统一标题、工具栏、表格内容与分页区布局。
 */
export default function DataTableShell({
  id,
  title,
  description,
  kicker,
  toolbar,
  pagination,
  className,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  kicker?: string;
  toolbar?: React.ReactNode;
  pagination?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={cn("data-shell soft-glow", className)}>
      <header className="border-b border-white/70 px-4 py-4 md:px-5">
        {kicker ? <p className="section-kicker">{kicker}</p> : null}
        <h2 className="font-display mt-1 text-lg font-semibold text-slate-900">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </header>
      {toolbar ? <div className="px-4 pt-4 md:px-5">{toolbar}</div> : null}
      <div className="px-4 py-4 md:px-5">{children}</div>
      {pagination ? <div className="px-4 pb-4 md:px-5">{pagination}</div> : null}
    </section>
  );
}
