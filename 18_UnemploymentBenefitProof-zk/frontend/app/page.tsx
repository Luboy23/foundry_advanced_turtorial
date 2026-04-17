"use client";

import Link from "next/link";
import { ArrowRight, ShieldCheck, Wallet } from "lucide-react";
import { useDialog } from "@/components/shared/DialogProvider";
import { useCurrentCredentialSetQuery, useProgramQuery } from "@/hooks/useBenefitQueries";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { useWalletActionFeedback } from "@/hooks/useWalletActionFeedback";
import { sharedCopy } from "@/lib/copy";
import { roleDefinitions, roleKeys, type RoleKey } from "@/lib/role-access";
import { cn, formatEth } from "@/lib/utils";

/**
 * 首页负责把整个平台的三类角色入口、当前资格名单状态和补助池状态汇总到一个总览页。
 *
 * 用户在这里完成钱包连接后，就能立即看到自己当前可进入的工作台和服务整体状态。
 */
const steps = [
  { title: "资格审核通过", desc: "资格确认完成后，资格名单进入可用状态" },
  { title: "领取资格凭证", desc: "申请人领取本次办理所需的资格凭证" },
  { title: "补助发放", desc: "资格核验通过后进入补助发放流程" }
];

/** 首页组件。 */
export default function HomePage() {
  const { config, wallet, publicClient, accessByRole, isConfigured } = useRoleAccess();
  const { walletError, clearWalletError, ensureWalletReady } = useWalletActionFeedback(wallet);
  const dialog = useDialog();

  const currentSetQuery = useCurrentCredentialSetQuery({ config, enabled: Boolean(publicClient && isConfigured) });
  const programQuery = useProgramQuery({ config, enabled: Boolean(publicClient && isConfigured) });

  /** 首页连接钱包按钮的统一处理入口。 */
  async function handleWalletAction() {
    clearWalletError();
    await ensureWalletReady();
  }

  /** 点击不可进入的服务入口时，弹出明确阻塞原因，而不是让按钮无反馈。 */
  async function handleBlockedRoleClick(role: RoleKey) {
    const access = accessByRole[role];
    if (access.allowed) {
      return;
    }

    await dialog.showInfo({
      title: access.reasonTitle,
      description: access.reasonBody,
      tone: access.reason === "missing-role" ? "warning" : access.reason === "role-query-failed" ? "error" : "info"
    });
  }

  const currentSet = currentSetQuery.data;
  const program = programQuery.data;
  const serviceStatusError = Boolean(
    (currentSetQuery.isError && !currentSet) || (programQuery.isError && !program)
  );
  const statusLabel = !currentSet
    ? "待发布资格名单"
    : program?.active
      ? "补助发放中"
      : "资格名单已发布";

  return (
    <div className="flex flex-col">
      <section className="bg-bg-paper py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-brand-ink/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-ink">
                <ShieldCheck size={14} />
                <span>{sharedCopy.serviceBadge}</span>
              </div>

              <div className="space-y-5">
                <h1 className="text-4xl font-bold leading-tight text-brand-ink md:text-5xl">
                  减少材料暴露，
                  <br />
                  申请失业补助
                </h1>
                <p className="max-w-xl text-lg leading-8 text-text-muted">
                  如果你已经通过资格审核，无需向发放机构重复提交完整失业材料。领取资格凭证并完成资格核验后，即可进入补助发放流程。
                </p>
              </div>

              <ul className="space-y-3 text-sm leading-7 text-text-muted">
                <li>只核验你是否符合当前补助条件，不展示完整失业与家庭材料。</li>
                <li>当前服务固定补助金额为 100 ETH。</li>
              </ul>
            </div>

            <div className="space-y-6">
              <div className="card space-y-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">{sharedCopy.connectAccount}</h3>
                  <p className="text-sm text-text-muted">连接账户后，才能查看你可使用的服务和当前办理进度。</p>
                  <button
                    type="button"
                    onClick={() => void handleWalletAction()}
                    disabled={wallet.isConnecting || wallet.isSwitching || (wallet.isConnected && !wallet.wrongChain)}
                    aria-busy={wallet.isConnecting || wallet.isSwitching}
                    className="btn-primary mt-4 flex w-full items-center gap-2"
                  >
                    <Wallet size={18} />
                    <span>
                      {!wallet.isConnected
                        ? wallet.isConnecting
                          ? sharedCopy.connecting
                          : sharedCopy.connectAccount
                        : wallet.wrongChain
                          ? wallet.isSwitching
                            ? sharedCopy.switching
                            : sharedCopy.switchServiceNetwork
                          : sharedCopy.accountConnected}
                    </span>
                  </button>
                  {walletError ? <p className="text-xs text-brand-seal">{walletError}</p> : null}
                </div>

                <div className="space-y-4 border-t border-line-soft pt-6">
                  <h3 className="text-lg font-semibold">{sharedCopy.serviceEntryTitle}</h3>
                  <div className="grid gap-3">
                    {roleKeys.map((role) => {
                      const access = accessByRole[role];
                      const definition = roleDefinitions[role];
                      const content = (
                        <>
                          <div>
                            <div className="font-medium">{definition.title}</div>
                            <div className="text-xs text-text-muted">{definition.desc}</div>
                            {!access.allowed ? <div className="mt-2 text-xs text-brand-seal">{access.reasonTitle}</div> : null}
                          </div>
                          <ArrowRight size={18} className={cn("shrink-0", access.allowed ? "text-brand-ink" : "text-text-muted/45")} />
                        </>
                      );

                      return access.allowed ? (
                        <Link
                          key={definition.path}
                          href={definition.path}
                          className="flex items-center justify-between rounded-xl border border-line-soft px-4 py-4 transition hover:border-brand-ink hover:bg-brand-ink/5"
                        >
                          {content}
                        </Link>
                      ) : (
                        <button
                          key={definition.path}
                          type="button"
                          aria-disabled="true"
                          onClick={() => void handleBlockedRoleClick(role)}
                          className="flex cursor-not-allowed items-center justify-between rounded-xl border border-line-soft px-4 py-4 text-left opacity-65"
                        >
                          {content}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-line-soft pt-6">
                  <h3 className="mb-4 text-lg font-semibold">{sharedCopy.serviceStatusTitle}</h3>
                  <div
                    className={cn(
                      "rounded-xl border p-4",
                      serviceStatusError ? "border-brand-seal/25 bg-[#FFF8F7]" : "border-line-soft bg-bg-paper"
                    )}
                  >
                    {serviceStatusError ? (
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-brand-seal">{sharedCopy.serviceStatusUnavailableTitle}</div>
                        <div className="text-xs text-text-muted">{sharedCopy.serviceStatusUnavailableBody}</div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="text-sm font-medium">{statusLabel}</div>
                          <div className="text-xs text-text-muted">
                            {currentSet ? `当前资格名单版本 v${currentSet.version}` : "资格名单尚未发布"}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-text-muted">资金池余额</div>
                          <div className="text-sm font-medium">{formatEth(program?.poolBalanceWei ?? 0n)}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-line-soft bg-surface py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step.title} className="relative flex flex-col items-center space-y-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-line-soft bg-bg-paper text-lg font-bold text-brand-ink">
                  {index + 1}
                </div>
                <div className="space-y-1">
                  <h4 className="text-lg font-semibold">{step.title}</h4>
                  <p className="text-sm text-text-muted">{step.desc}</p>
                </div>
                {index < 2 ? <div className="absolute -right-6 top-6 hidden h-px w-12 bg-line-soft md:block" /> : null}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
