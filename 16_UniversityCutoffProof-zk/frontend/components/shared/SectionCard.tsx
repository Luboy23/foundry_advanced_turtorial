import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionCard({
  title,
  description,
  headerAction,
  className,
  children
}: {
  title?: string;
  description?: string;
  headerAction?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm", className)}>
      {(title || description || headerAction) && (
        <header className="border-b border-slate-100 bg-slate-50/80 px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              {title ? <h2 className="text-lg font-semibold text-slate-900">{title}</h2> : null}
              {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
            </div>
            {headerAction}
          </div>
        </header>
      )}
      <div className="p-6">{children}</div>
    </section>
  );
}
