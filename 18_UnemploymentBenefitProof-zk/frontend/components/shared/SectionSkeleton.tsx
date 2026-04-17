import { cn } from "@/lib/utils";

/** 分区级骨架屏，用于延迟加载次级区块时占位，降低空白等待感。 */
type SectionSkeletonProps = {
  title?: string;
  rows?: number;
  className?: string;
};

/** 展示轻量的标题与内容骨架，不引入额外业务依赖。 */
export function SectionSkeleton({ title, rows = 3, className }: SectionSkeletonProps) {
  return (
    <section className={cn("space-y-4", className)}>
      {title ? <div className="h-5 w-32 animate-pulse rounded-full bg-brand-ink/10" aria-hidden="true" /> : null}
      <div className="card space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="h-14 animate-pulse rounded-2xl bg-brand-ink/5" aria-hidden="true" />
        ))}
      </div>
    </section>
  );
}
