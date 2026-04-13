import Link from "next/link";
import { buttonClassName } from "@/components/shared/Button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { cn } from "@/lib/utils";
import type { SchoolRuleVersion } from "@/types/admission";
import type { StudentApplicationSummary } from "@/types/history";

// 在学生首页按学校展示“当前是否可申请”的最直接结果。
export function UniversityEligibilityList({
  score,
  versions,
  currentApplication
}: {
  score: number | null;
  versions: SchoolRuleVersion[];
  currentApplication: StudentApplicationSummary | null;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">可申请学校</h2>
          <p className="mt-1 text-sm text-slate-500">按当前可用的申请规则展示。</p>
        </div>
      </div>

      {versions.length ? (
        <div className="mt-5 space-y-4">
          {versions.map((version) => {
            const eligible = score !== null && score >= version.cutoffScore && version.active;
            const sameSchool =
              currentApplication?.schoolId.toLowerCase() === version.schoolId.toLowerCase();
            const lockedByOtherSchool = Boolean(currentApplication && !sameSchool);

            let badgeLabel = "未达到录取线";
            let badgeTone: "success" | "warning" | "danger" = "danger";
            let actionLabel = eligible ? "提交申请" : "查看原因";

            if (sameSchool && currentApplication?.status === "APPROVED") {
              badgeLabel = "已被录取";
              badgeTone = "success";
              actionLabel = "已完成录取";
            } else if (sameSchool && currentApplication?.status === "REJECTED") {
              badgeLabel = "已拒绝";
              badgeTone = "danger";
              actionLabel = "资格已锁定";
            } else if (sameSchool && currentApplication?.status === "PENDING") {
              badgeLabel = "等待审批";
              badgeTone = "warning";
              actionLabel = "已提交申请";
            } else if (lockedByOtherSchool && currentApplication?.status === "APPROVED") {
              badgeLabel = "已被他校录取";
              badgeTone = "warning";
              actionLabel = "不可再申请";
            } else if (lockedByOtherSchool && currentApplication?.status === "REJECTED") {
              badgeLabel = "资格已锁定";
              badgeTone = "warning";
              actionLabel = "不可再申请";
            } else if (lockedByOtherSchool) {
              badgeLabel = "已有其他申请";
              badgeTone = "warning";
              actionLabel = "不可再申请";
            } else if (!version.active) {
              badgeLabel = "暂未开放申请";
              badgeTone = "warning";
            } else if (eligible) {
              badgeLabel = "当前可申请";
              badgeTone = "success";
            }

            return (
              <div key={version.schoolId} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-lg font-semibold text-slate-900">{version.schoolName}</div>
                    <div className="mt-1 text-sm text-slate-500">当前申请规则 · 录取线 {version.cutoffScore}</div>
                  </div>
                  <div className="flex flex-col items-stretch gap-3 md:items-end">
                    <StatusBadge label={badgeLabel} tone={badgeTone} />
                    {currentApplication ? (
                      <span className={cn(buttonClassName("outline", "md"), "cursor-not-allowed")}>
                        {actionLabel}
                      </span>
                    ) : (
                      <Link
                        href={`/student/apply?school=${version.familyKey}&version=${version.versionId}`}
                        className={buttonClassName(eligible ? "secondary" : "outline", "md")}
                      >
                        {eligible ? "提交申请" : "查看原因"}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          大学尚未发布申请规则，暂时还不能提交申请
        </div>
      )}
    </section>
  );
}
