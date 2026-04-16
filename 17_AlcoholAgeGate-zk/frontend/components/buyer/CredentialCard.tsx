import { ShieldCheck } from "lucide-react";
import type { Address } from "@/types/contract-config";
import type { LocalAgeCredential } from "@/types/domain";
import { formatAddress, formatDateTime } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/StatusBadge";

type CredentialCardProps = {
  credential: LocalAgeCredential | null;
  address?: Address;
};

export function CredentialCard({ credential, address }: CredentialCardProps) {
  const matchesWallet =
    credential && address ? credential.boundBuyerAddress.toLowerCase() === address.toLowerCase() : false;

  return (
    <section className="glass-card p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-brand-green/8 p-3 text-brand-green">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-brand-green">本地凭证状态</h3>
            <p className="text-sm text-text-muted">系统只保留完成资格验证所需的信息。</p>
          </div>
        </div>
        <StatusBadge tone={credential ? "success" : "warning"}>
          {credential ? "已保存" : "未领取"}
        </StatusBadge>
      </div>

      {credential ? (
        <div className="grid gap-3 text-sm text-text-muted md:grid-cols-2">
          <div className="rounded-2xl bg-bg-ivory p-4">
            <p className="text-xs uppercase tracking-[0.2em]">凭证编号</p>
            <p className="mt-2 font-mono text-xs text-brand-green">{credential.credentialId}</p>
          </div>
          <div className="rounded-2xl bg-bg-ivory p-4">
            <p className="text-xs uppercase tracking-[0.2em]">对应账户</p>
            <p className="mt-2 font-medium text-brand-green">{formatAddress(credential.boundBuyerAddress)}</p>
          </div>
          <div className="rounded-2xl bg-bg-ivory p-4">
            <p className="text-xs uppercase tracking-[0.2em]">签发时间</p>
            <p className="mt-2 font-medium text-brand-green">{formatDateTime(credential.issuedAt)}</p>
          </div>
          <div className="rounded-2xl bg-bg-ivory p-4">
            <p className="text-xs uppercase tracking-[0.2em]">当前账户匹配</p>
            <p className="mt-2 font-medium text-brand-green">{matchesWallet ? "是" : "否"}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm leading-6 text-text-muted">
          当前还没有可用凭证。请先领取年龄凭证后再继续。
        </p>
      )}
    </section>
  );
}
