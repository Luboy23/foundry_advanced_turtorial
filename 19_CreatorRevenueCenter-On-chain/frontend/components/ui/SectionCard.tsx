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
    <section className={cn("surface-card overflow-hidden", className)}>
      {(title || description || headerAction) ? (
        <header className="border-b border-line-soft bg-bg-soft-pink/35 px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              {title ? <h2 className="text-lg font-semibold text-text-ink">{title}</h2> : null}
              {description ? <p className="mt-1 text-sm leading-6 text-text-muted">{description}</p> : null}
            </div>
            {headerAction}
          </div>
        </header>
      ) : null}
      <div className="p-6">{children}</div>
    </section>
  );
}
