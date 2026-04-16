import type { AgeCredentialSet } from "@/types/domain";
import { formatDateTime } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/StatusBadge";

type CredentialSetCardProps = {
  credentialSet: AgeCredentialSet | null;
  activeBuyerCount?: number | null;
};

export function CredentialSetCard({ credentialSet, activeBuyerCount }: CredentialSetCardProps) {
  return (
    <section className="glass-card p-5 lg:p-6">
      <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center rounded-full bg-brand-green/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-green">
            Overview
          </div>
          <div>
            <h2 className="text-xl font-semibold text-brand-green">当前资格总览</h2>
            <p className="text-sm leading-6 text-text-muted">当前启用的是一份链上身份集合。用户是否达到购酒年龄，会在各自验证时按当前 UTC 日期动态判断。</p>
          </div>
        </div>
        <StatusBadge tone={credentialSet?.active ? "success" : "warning"}>
          {credentialSet?.active ? "已激活" : "未发布"}
        </StatusBadge>
      </div>

      {credentialSet ? (
        <div className="grid gap-3 text-sm text-text-muted md:grid-cols-2 xl:grid-cols-5">
          <div className="min-h-[7.25rem] rounded-[1.5rem] bg-bg-ivory p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-text-muted">当前集合编号</p>
            <p className="mt-3 break-all font-mono text-[11px] leading-5 text-brand-green">{credentialSet.setId}</p>
          </div>
          <div className="min-h-[7.25rem] rounded-[1.5rem] bg-bg-ivory p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-text-muted">当前版本</p>
            <p className="mt-3 text-2xl font-semibold text-brand-green">{credentialSet.version}</p>
          </div>
          <div className="min-h-[7.25rem] rounded-[1.5rem] bg-bg-ivory p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-text-muted">参考日期</p>
            <p className="mt-3 text-sm font-medium leading-6 text-brand-green">{formatDateTime(credentialSet.referenceDate)}</p>
          </div>
          <div className="min-h-[7.25rem] rounded-[1.5rem] bg-bg-ivory p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-text-muted">最近发布时间</p>
            <p className="mt-3 text-sm font-medium leading-6 text-brand-green">{formatDateTime(credentialSet.updatedAt)}</p>
          </div>
          <div className="min-h-[7.25rem] rounded-[1.5rem] bg-bg-ivory p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-text-muted">集合成员数</p>
            <p className="mt-3 text-2xl font-semibold text-brand-green">{activeBuyerCount ?? 0}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm leading-6 text-text-muted">当前暂未读取到资格数据，请稍后刷新重试。</p>
      )}
    </section>
  );
}
