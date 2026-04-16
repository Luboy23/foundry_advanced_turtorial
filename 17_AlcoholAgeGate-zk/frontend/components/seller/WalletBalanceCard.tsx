"use client";

import { formatAddress, formatEth } from "@/lib/utils";
import type { Address } from "@/types/contract-config";

type WalletBalanceCardProps = {
  address?: Address;
  balance?: bigint;
  loading?: boolean;
};

export function WalletBalanceCard({ address, balance = 0n, loading = false }: WalletBalanceCardProps) {
  return (
    <section className="glass-card p-8">
      <p className="text-xs uppercase tracking-[0.2em] text-text-muted">当前钱包余额</p>
      <p className="mt-3 text-4xl font-semibold text-brand-green">
        {loading ? "读取中..." : formatEth(balance)}
      </p>
      <p className="mt-3 text-sm leading-6 text-text-muted">
        当前连接卖家账户的可用余额，便于你同时查看待提现货款和钱包持有的 ETH。
      </p>
      <div className="mt-5 rounded-[1.4rem] bg-bg-ivory px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">卖家账户</p>
        <p className="mt-2 font-mono text-sm text-brand-green break-all">
          {address ? address : formatAddress(address)}
        </p>
      </div>
    </section>
  );
}
