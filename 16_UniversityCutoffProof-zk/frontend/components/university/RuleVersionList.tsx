import { StatusBadge } from "@/components/shared/StatusBadge";
import type { SchoolRuleVersion } from "@/types/admission";

export function RuleVersionList({
  versions
}: {
  versions: SchoolRuleVersion[];
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">规则记录</h2>
          <p className="mt-1 text-sm text-slate-500">查看当前规则与历史规则。</p>
        </div>
        <StatusBadge label={`${versions.length} 条`} tone="info" />
      </div>

      {versions.length ? (
        <div className="mt-5 space-y-4">
          {versions.map((version) => (
            <div key={version.schoolId} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-semibold text-slate-900">第 {version.versionNumber} 轮申请规则</div>
                  <div className="mt-1 text-sm text-slate-500">录取线 {version.cutoffScore}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge
                    label={version.status === "draft" ? "草稿" : version.active ? "当前生效规则" : "历史规则"}
                    tone={version.status === "draft" ? "info" : version.status === "frozen" ? "success" : "neutral"}
                  />
                  <StatusBadge label={version.cutoffFrozen ? "已开放申请" : "未开放申请"} tone={version.cutoffFrozen ? "success" : "warning"} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          当前学校暂无版本记录
        </div>
      )}
    </section>
  );
}
