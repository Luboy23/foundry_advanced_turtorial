"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useChainId, useConnect, useDisconnect } from "wagmi";
import { ANVIL_CHAIN_ID } from "@/lib/chain";
import { shortenAddress } from "@/lib/format";

export default function WalletStatus() {
  const [mounted, setMounted] = useState(false);
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending: isConnectPending } = useConnect();
  const { disconnect, isPending: isDisconnectPending } = useDisconnect();

  useEffect(() => {
    setMounted(true);
  }, []);

  const injectedConnector = useMemo(
    () => connectors.find((connector) => connector.id === "injected"),
    [connectors]
  );

  const hasProvider =
    typeof window !== "undefined" &&
    Boolean((window as Window & { ethereum?: unknown }).ethereum);

  // 业务上仅支持本地 Anvil 链，链不匹配时前端会继续给出引导提示。
  const isSupportedChain = isConnected && chainId === ANVIL_CHAIN_ID;
  const isPending = isConnectPending || isDisconnectPending;

  const label = isConnected
    ? isDisconnectPending
      ? "断开中..."
      : shortenAddress(address ?? "")
    : isConnectPending
    ? "连接钱包中..."
    : "连接钱包";

  return (
    <div className="flex flex-col items-end gap-2 text-xs text-right">
      <button
        type="button"
        onClick={() => {
          if (!mounted || isPending) return;
          if (isConnected) {
            disconnect();
            return;
          }
          if (!injectedConnector) return;
          connect({ connector: injectedConnector });
        }}
        disabled={
          !mounted ||
          isPending ||
          (!isConnected && (!hasProvider || !injectedConnector))
        }
        className="rounded bg-[var(--button-background)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--secondary-text-color)] disabled:cursor-not-allowed disabled:opacity-60"
        title={isConnected ? "点击断开钱包连接" : "点击连接钱包"}
      >
        {mounted ? label : "连接钱包"}
      </button>
      <div className="text-[var(--primary-text-color)]">
        {mounted && isConnected
          ? `网络 ${chainId}`
          : "未连接网络（请连接钱包）"}
        {mounted && isConnected
          ? isSupportedChain
            ? "（Anvil）"
            : `（请切换到 ${ANVIL_CHAIN_ID} / Anvil）`
          : ""}
      </div>
    </div>
  );
}
