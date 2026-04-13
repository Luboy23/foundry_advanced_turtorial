import { StatusBadge } from "@/components/shared/StatusBadge";
import type { AdmissionCredential } from "@/types/credential";
import type { SchoolRuleVersion } from "@/types/admission";

// 申请页顶部的统一摘要，帮助学生先确认“学校、录取线、成绩、规则状态”四项关键信息。
export function ApplicationVersionSummary({
  credential,
  version
}: {
  credential: AdmissionCredential | null;
  version: SchoolRuleVersion | null;
}) {
  const eligible = Boolean(credential && version && credential.score >= version.cutoffScore && version.active);
  const lifecycleLabel =
    version?.status === "draft"
      ? "草稿"
      : version?.active
        ? "已开放申请"
        : version?.status === "superseded"
          ? "历史规则"
          : "未开放";
  const ruleLabel = version ? `第 ${version.versionNumber} 轮申请规则` : "-";

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{version?.schoolName ?? "提交申请"}</h1>
          <p className="mt-1 text-sm text-slate-500">{version ? ruleLabel : "正在读取申请信息"}</p>
        </div>
        <StatusBadge
          label={!version?.active ? "暂未开放申请" : eligible ? "当前可提交申请" : "未达到录取线"}
          tone={!version?.active ? "warning" : eligible ? "success" : "danger"}
        />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <Tile label="当前成绩" value={credential ? String(credential.score) : "未载入"} />
        <Tile label="录取线" value={version ? String(version.cutoffScore) : "-"} />
        <Tile label="当前申请规则" value={ruleLabel} />
        <Tile label="申请状态" value={lifecycleLabel} />
      </div>
    </section>
  );
}

// 摘要卡里的轻量信息块组件。
function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-2 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}
