import { Button } from "@/components/shared/Button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { normalizeCutoffInput } from "@/lib/admission/rule-version";
import type { SchoolRuleVersion } from "@/types/admission";

// 大学规则草稿面板。
// 当前版本的核心约束是“一份成绩源只能对应一条规则”，所以这里的 UI 只允许新建或开放，不允许反复改线。
export function UniversityRuleDraftPanel({
  schoolName,
  currentSourceTitle,
  currentSourceMaxScore,
  draftCutoff,
  onDraftCutoffChange,
  onCreateDraft,
  onFreezeDraft,
  creatingDraft,
  freezingDraft,
  currentSourceRule,
  canEdit,
  canCreateDraft,
  createDisabledReason
}: {
  schoolName: string;
  currentSourceTitle: string | null;
  currentSourceMaxScore: number | null;
  draftCutoff: string;
  onDraftCutoffChange: (value: string) => void;
  onCreateDraft: () => void;
  onFreezeDraft: () => void;
  creatingDraft: boolean;
  freezingDraft: boolean;
  currentSourceRule: SchoolRuleVersion | null;
  canEdit: boolean;
  canCreateDraft: boolean;
  createDisabledReason: string | null;
}) {
  const hasCutoff = draftCutoff.trim().length > 0;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">申请规则草稿</h2>
          <p className="mt-1 text-sm text-slate-500">
            {schoolName} 在每一版成绩源下只能提交一条申请规则，创建后只能选择是否开放申请。
          </p>
        </div>
        <StatusBadge
          label={
            currentSourceRule
              ? currentSourceRule.cutoffFrozen
                ? `第 ${currentSourceRule.versionNumber} 轮已开放`
                : `第 ${currentSourceRule.versionNumber} 轮待开放`
              : "当前成绩源暂无规则"
          }
          tone={currentSourceRule ? (currentSourceRule.cutoffFrozen ? "success" : "info") : "neutral"}
        />
      </div>

      <div className="mt-5 space-y-4">
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {currentSourceTitle
            ? `当前可用成绩批次：${currentSourceTitle}`
            : "考试院尚未发布本届成绩，暂时还不能设置录取线。"}
        </div>

        {!currentSourceRule ? (
          <div>
            <label className="block text-sm font-medium text-slate-700">录取线</label>
            <input
              value={draftCutoff}
              onChange={(event) =>
                onDraftCutoffChange(normalizeCutoffInput(event.target.value, currentSourceMaxScore))
              }
              type="number"
              inputMode="numeric"
              min={1}
              max={currentSourceMaxScore ?? undefined}
              step={1}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-400"
              placeholder={
                currentSourceMaxScore ? `请输入本轮录取线，最高 ${currentSourceMaxScore} 分` : "请输入本轮录取线"
              }
            />
            {currentSourceMaxScore ? (
              // 录取线必须受当前成绩源总分上限约束，避免前端先放行无效输入再让链上回退。
              <p className="mt-2 text-xs text-slate-500">当前成绩源总分为 {currentSourceMaxScore} 分，录取线不能超过该上限。</p>
            ) : null}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            当前成绩源对应规则：第 {currentSourceRule.versionNumber} 轮申请规则，录取线 {currentSourceRule.cutoffScore}。
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {!currentSourceRule ? (
            <Button onClick={onCreateDraft} disabled={!canCreateDraft || creatingDraft || !hasCutoff}>
              {creatingDraft ? "正在新建草稿..." : "新建规则草稿"}
            </Button>
          ) : !currentSourceRule.cutoffFrozen ? (
            <>
              {/* 一旦规则创建成功，就只剩“开放申请”这一个状态推进动作。 */}
              <Button onClick={onFreezeDraft} disabled={!canEdit || freezingDraft}>
                {freezingDraft ? "正在开放申请..." : "开放申请"}
              </Button>
            </>
          ) : null
        }
        {!currentSourceRule && createDisabledReason ? (
          <p className="text-xs text-slate-500">{createDisabledReason}</p>
        ) : null}
        {currentSourceRule ? (
          <p className="text-xs text-slate-500">
            {currentSourceRule.cutoffFrozen
              ? "当前成绩源已经提交过规则，如需下一条规则，请等待考试院发布新的成绩版本。"
              : "当前成绩源已经提交过规则，不能重复新建；确认后请直接开放申请。"}
          </p>
        ) : null}
        </div>
      </div>
    </section>
  );
}
