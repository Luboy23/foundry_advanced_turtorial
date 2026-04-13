"use client";

import { useState } from "react";
import { GraduationCap, School, ShieldCheck } from "lucide-react";
import { InfoNotice } from "@/components/shared/StatePanels";
import { RoleEntryCard } from "@/components/home/RoleEntryCard";
import { useRoleIdentity } from "@/hooks/useRoleIdentity";
import { useRuntimeConfig } from "@/hooks/useRuntimeConfig";
import { useWalletStatus } from "@/hooks/useWalletStatus";
import { consumeAccessFlash } from "@/lib/auth/access-flash";

export default function HomePage() {
  const { config, isConfigured } = useRuntimeConfig();
  const wallet = useWalletStatus(config.chainId);
  const roleState = useRoleIdentity({
    config,
    walletAddress: wallet.address,
    enabled: wallet.isConnected && isConfigured
  });
  const [flashMessage] = useState<string | null>(() => consumeAccessFlash());

  const disabledReason = !wallet.isHydrated
    ? "正在读取账户状态。"
    : !wallet.isConnected
    ? "请先连接项目授权账户。"
    : roleState.isLoading
      ? "正在核验账户身份。"
      : !roleState.identity.isWhitelisted
        ? "当前账户未被分配系统身份。"
        : "当前账户不能进入这个工作台。";

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8">
        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
          UniversityCutoffProof-zk
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          高考录取资格证明系统
        </h1>
        <p className="mt-2 text-sm leading-7 text-slate-500">
          请选择身份并进入对应工作台。
        </p>
      </section>

      {flashMessage ? <InfoNotice title="无法进入工作台" description={flashMessage} tone="warning" /> : null}

      {wallet.isConnected && !roleState.isLoading && !roleState.identity.isWhitelisted ? (
        <InfoNotice
          title="当前账户未被分配身份"
          description="只有考试院、学生、北京大学和家里蹲大学对应的授权账户可以进入系统工作台。"
          tone="warning"
        />
      ) : null}

      <section className="grid gap-6 md:grid-cols-3">
        <RoleEntryCard
          title="考试院"
          description="发布本届成绩源，向学生发放成绩凭证。"
          href="/authority"
          actionLabel="进入考试院工作台"
          icon={ShieldCheck}
          iconTone="bg-blue-50 text-blue-600"
          disabled={!wallet.isConnected || roleState.identity.role !== "authority"}
          disabledReason={!wallet.isConnected || roleState.identity.role !== "authority" ? disabledReason : undefined}
        />
        <RoleEntryCard
          title="学生"
          description="查看成绩、学校录取线和个人申请记录。"
          href="/student"
          actionLabel="进入学生工作台"
          icon={GraduationCap}
          iconTone="bg-emerald-50 text-emerald-600"
          disabled={!wallet.isConnected || roleState.identity.role !== "student"}
          disabledReason={!wallet.isConnected || roleState.identity.role !== "student" ? disabledReason : undefined}
        />
        <RoleEntryCard
          title="大学"
          description="管理本校录取线、申请规则和开放状态。"
          href="/university"
          actionLabel="进入大学工作台"
          icon={School}
          iconTone="bg-orange-50 text-orange-600"
          disabled={!wallet.isConnected || roleState.identity.role !== "university"}
          disabledReason={!wallet.isConnected || roleState.identity.role !== "university" ? disabledReason : undefined}
        />
      </section>
    </div>
  );
}
