import { StatusBadge } from "@/components/shared/StatusBadge";
import type { SchoolRuleVersion } from "@/types/admission";

export function CurrentFrozenRulePanel({
  version
}: {
  version: SchoolRuleVersion | null;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">当前生效规则</h2>
          <p className="mt-1 text-sm text-slate-500">学生当前提交申请时使用的规则。</p>
        </div>
        <StatusBadge label={version ? "已生效" : "暂无生效规则"} tone={version ? "success" : "warning"} />
      </div>

      {version ? (
        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <Tile label="申请规则" value={`第 ${version.versionNumber} 轮`} />
          <Tile label="录取线" value={String(version.cutoffScore)} />
          <Tile label="当前状态" value="已开放申请" />
          <Tile label="学校" value={version.schoolName} />
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          当前学校尚未开放申请
        </div>
      )}
    </section>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-2 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}
