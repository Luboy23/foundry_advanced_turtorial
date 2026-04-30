export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="flex items-center gap-3 rounded-full border border-line-soft bg-white px-5 py-3 text-sm font-semibold text-brand-pink shadow-[var(--shadow-soft-pink)]">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-brand-pink" />
        正在整理收益中心数据...
      </div>
    </div>
  );
}
