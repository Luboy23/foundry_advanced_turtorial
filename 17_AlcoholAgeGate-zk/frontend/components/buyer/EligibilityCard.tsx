import { Shield } from "lucide-react";
import type { AgeCredentialSet, EligibilityStatus } from "@/types/domain";
import { formatYmdDate, isEligibleOnYmd } from "@/lib/domain/age-eligibility";
import { formatDateTime } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/StatusBadge";

type EligibilityCardProps = {
  eligibility: EligibilityStatus | null;
  currentSet: AgeCredentialSet | null;
  eligibleFromYmd?: number | null;
  currentDateYmd?: number | null;
};

export function EligibilityCard({ eligibility, currentSet, eligibleFromYmd, currentDateYmd }: EligibilityCardProps) {
  const waitingForAdultDate = Boolean(
    eligibleFromYmd &&
      currentDateYmd &&
      !eligibility?.isCurrent &&
      isEligibleOnYmd(eligibleFromYmd, currentDateYmd) === false
  );
  const tone = waitingForAdultDate ? "warning" : !eligibility?.active ? "warning" : eligibility.isCurrent ? "success" : "danger";
  const label = waitingForAdultDate ? "待成年" : !eligibility?.active ? "未验证" : eligibility.isCurrent ? "当前有效" : "已失效";

  return (
    <section className="glass-card p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-brand-amber/10 p-3 text-brand-amber">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-brand-green">购买资格</h3>
            <p className="text-sm text-text-muted">资格有效后才可以继续下单。</p>
          </div>
        </div>
        <StatusBadge tone={tone}>{label}</StatusBadge>
      </div>

      {eligibility || eligibleFromYmd ? (
        <div className="grid gap-3 text-sm text-text-muted md:grid-cols-2">
          <div className="rounded-2xl bg-bg-ivory p-4">
            <p className="text-xs uppercase tracking-[0.2em]">验证版本</p>
            <p className="mt-2 font-medium text-brand-green">{eligibility?.verifiedRootVersion || "暂无"}</p>
          </div>
          <div className="rounded-2xl bg-bg-ivory p-4">
            <p className="text-xs uppercase tracking-[0.2em]">最后验证时间</p>
            <p className="mt-2 font-medium text-brand-green">
              {eligibility?.verifiedAt ? formatDateTime(eligibility.verifiedAt) : "暂无"}
            </p>
          </div>
          <div className="rounded-2xl bg-bg-ivory p-4">
            <p className="text-xs uppercase tracking-[0.2em]">当前资格版本</p>
            <p className="mt-2 font-medium text-brand-green">{currentSet?.version ?? "暂无"}</p>
          </div>
          <div className="rounded-2xl bg-bg-ivory p-4">
            <p className="text-xs uppercase tracking-[0.2em]">资格状态</p>
            <p className="mt-2 font-medium text-brand-green">{label}</p>
          </div>
          <div className="rounded-2xl bg-bg-ivory p-4 md:col-span-2">
            <p className="text-xs uppercase tracking-[0.2em]">最早可验证日期</p>
            <p className="mt-2 font-medium text-brand-green">
              {eligibleFromYmd ? formatYmdDate(eligibleFromYmd) : "暂无"}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm leading-6 text-text-muted">
          当前账户还没有可用购买资格。完成年龄资格验证后，这里会更新为可购买状态。
        </p>
      )}
    </section>
  );
}
