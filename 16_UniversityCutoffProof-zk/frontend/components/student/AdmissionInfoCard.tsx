import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatAddress, formatDateTime } from "@/lib/utils";
import type { StudentApplicationSummary } from "@/types/history";

function getStatusMeta(status: StudentApplicationSummary["status"]) {
  if (status === "APPROVED") {
    return {
      title: "录取结果",
      description: "你已被该校录取，当前账户不能再申请其他学校。",
      badgeLabel: "已录取",
      tone: "success" as const,
      borderClassName: "border-emerald-200 bg-emerald-50",
      accentClassName: "text-emerald-800",
      labelClassName: "text-emerald-700"
    };
  }

  if (status === "REJECTED") {
    return {
      title: "当前申请状态",
      description: "该申请已被大学拒绝，但当前账户申请资格已永久锁定。",
      badgeLabel: "已拒绝",
      tone: "danger" as const,
      borderClassName: "border-rose-200 bg-rose-50",
      accentClassName: "text-rose-800",
      labelClassName: "text-rose-700"
    };
  }

  return {
    title: "当前申请状态",
    description: "申请已提交成功，正在等待大学审批；当前账户申请资格已锁定。",
    badgeLabel: "待审批",
    tone: "info" as const,
    borderClassName: "border-sky-200 bg-sky-50",
    accentClassName: "text-sky-800",
    labelClassName: "text-sky-700"
  };
}

export function AdmissionInfoCard({
  application
}: {
  application: StudentApplicationSummary | null;
}) {
  if (!application) {
    return null;
  }

  const meta = getStatusMeta(application.status);

  return (
    <section className={`rounded-3xl border p-6 shadow-sm ${meta.borderClassName}`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-lg font-semibold text-slate-950">{meta.title}</div>
          <p className={`mt-1 text-sm ${meta.accentClassName}`}>{meta.description}</p>
        </div>
        <StatusBadge label={meta.badgeLabel} tone={meta.tone} />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
          <div className={`text-xs font-semibold ${meta.labelClassName}`}>申请学校</div>
          <div className="mt-2 text-base font-semibold text-slate-900">{application.schoolName}</div>
        </div>
        <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
          <div className={`text-xs font-semibold ${meta.labelClassName}`}>申请规则</div>
          <div className="mt-2 text-base font-semibold text-slate-900">
            {application.versionNumber ? `第 ${application.versionNumber} 轮` : application.versionId}
          </div>
        </div>
        <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
          <div className={`text-xs font-semibold ${meta.labelClassName}`}>
            {application.status === "PENDING" ? "提交时间" : "审批时间"}
          </div>
          <div className="mt-2 text-base font-semibold text-slate-900">
            {formatDateTime(application.decidedAt ?? application.submittedAt)}
          </div>
        </div>
      </div>

      <div className={`mt-4 space-y-1 text-xs ${meta.accentClassName}`}>
        {application.submittedTxHash ? (
          <div>
            提交交易：<span className="font-mono">{formatAddress(application.submittedTxHash, 8)}</span>
          </div>
        ) : null}
        {application.decisionTxHash ? (
          <div>
            审批交易：<span className="font-mono">{formatAddress(application.decisionTxHash, 8)}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
