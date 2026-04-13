import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatAddress, formatDateTime } from "@/lib/utils";
import type { ApplicationHistoryRecord, ApplicationHistoryStatus } from "@/types/history";
import { EmptyState } from "@/components/shared/StatePanels";

function getStatusMeta(status: ApplicationHistoryStatus) {
  if (status === "APPROVED") {
    return {
      label: "已录取",
      tone: "success" as const
    };
  }
  if (status === "REJECTED") {
    return {
      label: "已拒绝",
      tone: "danger" as const
    };
  }
  if (status === "PENDING") {
    return {
      label: "待审批",
      tone: "info" as const
    };
  }
  return {
    label: "未达到录取线",
    tone: "warning" as const
  };
}

// 学生工作台的统一申请记录列表。
// 这里会同时展示链上申请记录和后端托管的辅助记录，但必须明确分区，避免用户误把辅助记录当成链上真相。
export function ApplicationRecordList({
  onchainRecords,
  localBlockedRecords
}: {
  onchainRecords: ApplicationHistoryRecord[];
  localBlockedRecords: ApplicationHistoryRecord[];
}) {
  const totalRecords = onchainRecords.length + localBlockedRecords.length;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">申请记录</h2>
          <p className="mt-1 text-sm text-slate-500">链上真实申请记录和本地辅助记录会分区展示，避免混淆。</p>
        </div>
        <StatusBadge label={`${totalRecords} 条`} tone="info" />
      </div>

      {totalRecords ? (
        <div className="mt-5 space-y-6">
          {/* 链上申请记录是真实业务结果，会决定审批状态与申请锁。 */}
          <RecordSection
            title="链上申请记录"
            description="这里展示已经提交到链上的待审批、已拒绝和已录取结果。"
            emptyLabel="当前还没有链上申请记录"
            records={onchainRecords}
          />
          {/* 辅助记录只解释“为什么没能提交”，不会参与任何链上状态判断。 */}
          <RecordSection
            title="未达线记录（未上链辅助）"
            description="这里只记录被前端阻断但未上链的辅助记录，由后端托管。"
            emptyLabel="当前没有未上链辅助记录"
            records={localBlockedRecords}
          />
        </div>
      ) : (
        <EmptyState title="暂无申请记录" description="当前既没有链上申请记录，也没有未上链辅助记录。" />
      )}
    </section>
  );
}

function RecordSection({
  title,
  description,
  emptyLabel,
  records
}: {
  title: string;
  description: string;
  emptyLabel: string;
  records: ApplicationHistoryRecord[];
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>

      {records.length ? (
        <div className="space-y-4">
          {records.map((record) => {
            const statusMeta = getStatusMeta(record.status);

            return (
              <div key={record.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">{record.schoolName}</div>
                    <div className="mt-1 text-sm text-slate-500">
                      {record.versionNumber ? `第 ${record.versionNumber} 轮申请规则 · ` : ""}录取线 {record.cutoffScore}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      {record.source === "auxiliary" ? "后端辅助记录，未上链" : "链上申请记录"}
                    </div>
                    <div className="mt-3 text-sm text-slate-600">{record.message}</div>
                  </div>
                  <div className="flex flex-col items-start gap-2 md:items-end">
                    <StatusBadge label={statusMeta.label} tone={statusMeta.tone} />
                    <div className="text-xs text-slate-500">{formatDateTime(record.createdAt)}</div>
                    {record.txHash ? (
                      <div className="font-mono text-xs text-slate-500">{formatAddress(record.txHash, 6)}</div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          {emptyLabel}
        </div>
      )}
    </div>
  );
}
