import type { FailureHistoryEntry } from "@/types/domain";
import { formatDateTime } from "@/lib/utils";
import { StatePanel } from "@/components/shared/StatePanel";

type FailureHistoryListProps = {
  entries: FailureHistoryEntry[];
};

export function FailureHistoryList({ entries }: FailureHistoryListProps) {
  if (!entries.length) {
    return <StatePanel title="暂无异常记录" description="验证失败、购买失败或网络异常会保留在这里，方便你稍后重新尝试。" />;
  }

  return (
    <div className="space-y-4">
      {entries.map((entry) => (
        <article key={entry.id} className="rounded-3xl border border-rose-200 bg-rose-50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h4 className="font-semibold text-rose-700">{entry.title}</h4>
              <p className="text-sm leading-6 text-rose-600">{entry.message}</p>
            </div>
            <span className="text-xs text-rose-500">{entry.kind === "verify" ? "验证" : "购买"}</span>
          </div>
          <p className="mt-3 text-xs text-rose-500">{formatDateTime(entry.timestamp)}</p>
        </article>
      ))}
    </div>
  );
}
