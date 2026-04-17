"use client";

import { useCallback, useState } from "react";
import type { WalletStatus } from "@/hooks/useWalletStatus";
import { getFriendlyErrorMessage } from "@/lib/friendly-errors";

/**
 * 把钱包层动作包装成带用户错误提示的交互函数。
 *
 * 页面一般不直接处理 wagmi 抛出的底层异常，而是统一通过这个 Hook 得到可直接展示的文案。
 */
export function useWalletActionFeedback(wallet: WalletStatus) {
  const [walletError, setWalletError] = useState<string | null>(null);

  /** 发起钱包连接，并在失败时写入用户可理解的错误信息。 */
  const connectWallet = useCallback(async () => {
    setWalletError(null);
    try {
      await wallet.connectWallet();
    } catch (error) {
      setWalletError(getFriendlyErrorMessage(error, "wallet-connect"));
    }
  }, [wallet]);

  /** 发起链切换，并把底层错误翻译成统一文案。 */
  const switchToExpectedChain = useCallback(async () => {
    setWalletError(null);
    try {
      await wallet.switchToExpectedChain();
    } catch (error) {
      setWalletError(getFriendlyErrorMessage(error, "wallet-switch"));
    }
  }, [wallet]);

  /** 让钱包进入“已连接且已切到目标链”的可用状态。 */
  const ensureWalletReady = useCallback(async () => {
    if (!wallet.isConnected) {
      await connectWallet();
      return;
    }

    if (wallet.wrongChain) {
      await switchToExpectedChain();
    }
  }, [connectWallet, switchToExpectedChain, wallet.isConnected, wallet.wrongChain]);

  return {
    walletError,
    setWalletError,
    clearWalletError: () => setWalletError(null),
    connectWallet,
    switchToExpectedChain,
    ensureWalletReady
  };
}
