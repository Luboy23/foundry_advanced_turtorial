import { formatAddress, formatDateTime } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { AuthorityPublishHistoryItem } from "@/types/history";

export function PublishRecordList({
  records
}: {
  records: AuthorityPublishHistoryItem[];
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">链上发布记录</h2>
          <p className="mt-1 text-sm text-slate-500">这里展示的是考试院已经写入链上的真实成绩源发布历史。</p>
        </div>
        <StatusBadge label={`${records.length} 条`} tone="info" />
      </div>

      {records.length ? (
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-3 font-medium">成绩批次</th>
                <th className="pb-3 font-medium">批次编号</th>
                <th className="pb-3 font-medium">发布者</th>
                <th className="pb-3 font-medium">发布时间</th>
                <th className="pb-3 font-medium">交易哈希</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={`${record.scoreSourceId}-${record.blockNumber ?? record.issuedAt}`} className="border-b border-slate-50 last:border-b-0">
                  <td className="py-4">
                    <div className="font-semibold text-slate-900">{record.sourceTitle}</div>
                  </td>
                  <td className="py-4 text-slate-700">{record.scoreSourceIdLabel}</td>
                  <td className="py-4 font-mono text-xs text-slate-500">{formatAddress(record.issuer, 6)}</td>
                  <td className="py-4 text-slate-500">{formatDateTime(record.issuedAt)}</td>
                  <td className="py-4 font-mono text-xs text-slate-500">
                    {record.txHash ? formatAddress(record.txHash, 6) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          链上还没有发布记录
        </div>
      )}
    </section>
  );
}
