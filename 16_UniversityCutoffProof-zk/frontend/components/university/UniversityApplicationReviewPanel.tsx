import { Button } from "@/components/shared/Button";
import { EmptyState } from "@/components/shared/StatePanels";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatAddress, formatDateTime } from "@/lib/utils";
import type { UniversityApplicationRecord, UniversityApplicationStatus } from "@/types/history";

type ReviewFilter = UniversityApplicationStatus;

function getStatusMeta(status: UniversityApplicationStatus) {
  if (status === "APPROVED") {
    return { label: "已批准", tone: "success" as const };
  }
  if (status === "REJECTED") {
    return { label: "已拒绝", tone: "danger" as const };
  }
  return { label: "待处理", tone: "info" as const };
}

const FILTERS: Array<{ value: ReviewFilter; label: string }> = [
  { value: "PENDING", label: "待处理" },
  { value: "APPROVED", label: "已批准" },
  { value: "REJECTED", label: "已拒绝" }
];

// 大学审批面板。
// 这一层只消费 workbench 已经整理好的申请记录，不再在前端自行拼接链上事件和状态机。
export function UniversityApplicationReviewPanel({
  records,
  activeFilter,
  onFilterChange,
  pendingKey,
  canReview,
  onApprove,
  onReject
}: {
  records: UniversityApplicationRecord[];
  activeFilter: ReviewFilter;
  onFilterChange: (filter: ReviewFilter) => void;
  pendingKey: string | null;
  canReview: boolean;
  onApprove: (record: UniversityApplicationRecord) => void;
  onReject: (record: UniversityApplicationRecord) => void;
}) {
  const filteredRecords = records.filter((record) => record.status === activeFilter);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">申请审批</h2>
          <p className="mt-1 text-sm text-slate-500">按当前学校的申请规则汇总学生申请，并支持批准或拒绝。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => onFilterChange(filter.value)}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                activeFilter === filter.value
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {filteredRecords.length ? (
        <div className="mt-5 space-y-4">
          {filteredRecords.map((record) => {
            const statusMeta = getStatusMeta(record.status);
            const approveKey = `approve:${record.schoolId}:${record.applicant}`;
            const rejectKey = `reject:${record.schoolId}:${record.applicant}`;
            const approving = pendingKey === approveKey;
            const rejecting = pendingKey === rejectKey;

            return (
              <div key={record.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
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
                    <div className="text-sm text-slate-600">提交时间：{formatDateTime(record.submittedAt)}</div>
                    {record.submittedTxHash ? (
                      <div className="text-sm text-slate-600">
                        提交交易：<span className="font-mono">{formatAddress(record.submittedTxHash, 8)}</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex min-w-[220px] flex-col items-start gap-3 xl:items-end">
                    <StatusBadge label={statusMeta.label} tone={statusMeta.tone} />
                    <div className="text-xs text-slate-500">最近更新：{formatDateTime(record.updatedAt)}</div>
                    {record.latestTxHash ? (
                      <div className="font-mono text-xs text-slate-500">{formatAddress(record.latestTxHash, 8)}</div>
                    ) : null}
                    {record.status === "PENDING" ? (
                      <div className="flex flex-wrap gap-2">
                        {/* 批准/拒绝动作会继续触发弹窗确认和 workbench 追平，因此这里按钮只承担入口职责。 */}
                        <Button
                          size="sm"
                          onClick={() => onApprove(record)}
                          disabled={!canReview || approving || Boolean(pendingKey)}
                        >
                          {approving ? "批准中..." : "批准"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onReject(record)}
                          disabled={!canReview || rejecting || Boolean(pendingKey)}
                        >
                          {rejecting ? "拒绝中..." : "拒绝"}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-5">
          <EmptyState
            title="当前筛选下暂无申请"
            description="切换状态筛选，或等待新的学生申请提交。"
          />
        </div>
      )}
    </section>
  );
}
