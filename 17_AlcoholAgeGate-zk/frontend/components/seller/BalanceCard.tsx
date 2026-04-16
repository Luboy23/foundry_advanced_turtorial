"use client";

import { useState } from "react";
import { formatEth } from "@/lib/utils";
import type { PendingActionEntry } from "@/types/domain";

type BalanceCardProps = {
  pendingBalance: bigint;
  onWithdraw: () => Promise<void> | void;
  disabled?: boolean;
  pendingAction?: PendingActionEntry | null;
};

export function BalanceCard({ pendingBalance, onWithdraw, disabled = false, pendingAction = null }: BalanceCardProps) {
  const [localWithdrawing, setLocalWithdrawing] = useState(false);
  const withdrawing = localWithdrawing || Boolean(pendingAction);

  return (
    <section className="rounded-[2rem] bg-brand-green p-8 text-paper-white shadow-lg">
      <p className="text-xs uppercase tracking-[0.2em] text-paper-white/60">待提现余额</p>
      <p className="mt-3 text-4xl font-semibold">{formatEth(pendingBalance)}</p>
      <button
        onClick={async () => {
          setLocalWithdrawing(true);
          try {
            await onWithdraw();
          } catch {
            // 错误提示统一由页面层处理，避免事务恢复后出现重复弹窗。
          } finally {
            setLocalWithdrawing(false);
          }
        }}
        disabled={disabled || withdrawing}
        className="mt-6 w-full rounded-full bg-brand-amber px-6 py-3 font-semibold text-white transition hover:bg-brand-amber/90 disabled:opacity-50"
      >
        {withdrawing ? "正在确认提现..." : "提现到卖家钱包"}
      </button>
      <p className="mt-3 text-xs leading-5 text-paper-white/60">买家付款后，货款会先进入待结算余额，卖家可在这里提取。</p>
    </section>
  );
}
