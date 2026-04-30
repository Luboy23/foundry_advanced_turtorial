"use client";

import { useState } from "react";
import { useWriteContract } from "wagmi";
import type { CreatorClaimPackage } from "@/types/domain";
import { creatorRevenueDistributorAbi } from "@/lib/contracts";
import { getFriendlyErrorMessage } from "@/lib/friendly-errors";
import { waitForTransactionReceiptViaServer } from "@/lib/transaction-receipt";
import type { RuntimeConfig } from "@/types/contract-config";

/**
 * 这个 hook 只负责 claim 交易生命周期里最靠近钱包的那一层：
 * - submitClaim 负责把 claim package 送进合约；
 * - waitForReceipt 负责等待这笔交易被链确认。
 * 它刻意不管 query invalidation 和页面刷新，避免“发交易逻辑”和“读模型同步逻辑”缠在一起。
 */
export function useClaimFlow(config: RuntimeConfig) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const { data: hash, isPending, writeContractAsync } = useWriteContract();

  /**
   * submitClaim 只做一件事：把当前账单对应的 claim package 原样送进合约。
   * 这里不掺杂页面缓存修补，方便上层在交易确认后按统一策略处理 optimistic update。
   */
  async function submitClaim(claimPackage: CreatorClaimPackage) {
    try {
      setActionError(null);
      return await writeContractAsync({
        address: config.distributorAddress,
        abi: creatorRevenueDistributorAbi,
        functionName: "claim",
        args: [
          claimPackage.batchIdHex,
          claimPackage.claimIdHex,
          claimPackage.creator,
          BigInt(claimPackage.grossAmount),
          claimPackage.recipients,
          claimPackage.bps.map((value) => Number(value)),
          claimPackage.merkleProof
        ]
      });
    } catch (error) {
      setActionError(getFriendlyErrorMessage(error, "claim"));
      throw error;
    }
  }

  /**
   * waitForReceipt 的职责边界很窄：
   * 它只负责把“用户已经签名广播”推进到“链上已经确认”。
   * 这里改成通过服务端统一确认回执，避免浏览器直连 RPC 时受本地钱包 / 端口 / CORS 影响。
   */
  async function waitForReceipt(txHash: `0x${string}`) {
    setIsConfirming(true);
    try {
      return await waitForTransactionReceiptViaServer(txHash);
    } finally {
      setIsConfirming(false);
    }
  }

  return {
    txHash: hash,
    isPending,
    isConfirming,
    isSuccess: false,
    actionError,
    receipt: undefined,
    submitClaim,
    waitForReceipt
  };
}
