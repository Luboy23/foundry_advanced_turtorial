import { EmptyState } from "@/components/shared/StatePanels";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatAddress, formatDateTime } from "@/lib/utils";
import type { UniversityApplicationRecord } from "@/types/history";

export function AdmittedStudentList({
  records
}: {
  records: UniversityApplicationRecord[];
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">已录取学生名单</h2>
          <p className="mt-1 text-sm text-slate-500">这里展示的是当前学校已经批准录取的学生名单。</p>
        </div>
        <StatusBadge
          label={`${records.length} 名已录取`}
          tone={records.length ? "success" : "warning"}
        />
      </div>

      {records.length ? (
        <div className="mt-5 space-y-4">
          {records.map((record) => (
            <div key={record.id} className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-3">
                  <div>
                    <div className="text-base font-semibold text-slate-900">{record.schoolName}</div>
                    <div className="mt-1 text-sm text-slate-500">
                      {record.versionNumber ? `第 ${record.versionNumber} 轮申请规则` : record.versionId}
                    </div>
                  </div>
                  <div className="text-sm text-slate-600">
                    学生钱包：<span className="font-mono">{formatAddress(record.applicant, 8)}</span>
                  </div>
                  <div className="text-sm text-slate-600">录取时间：{formatDateTime(record.updatedAt)}</div>
                </div>

                <div className="flex min-w-[220px] flex-col items-start gap-3 xl:items-end">
                  <StatusBadge label="已录取" tone="success" />
                  {record.submittedTxHash ? (
                    <div className="text-xs text-slate-500">
                      提交交易：<span className="font-mono">{formatAddress(record.submittedTxHash, 8)}</span>
                    </div>
                  ) : null}
                  {record.latestTxHash ? (
                    <div className="text-xs text-slate-500">
                      审批交易：<span className="font-mono">{formatAddress(record.latestTxHash, 8)}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5">
          <EmptyState
            title="当前暂无已录取学生"
            description="当学校批准学生申请后，名单会自动出现在这里。"
          />
        </div>
      )}
    </section>
  );
}
