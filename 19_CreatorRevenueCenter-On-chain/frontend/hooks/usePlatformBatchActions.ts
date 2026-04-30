"use client";

import { useState } from "react";
import { useWriteContract } from "wagmi";
import { creatorRevenueDistributorAbi, revenueBatchRegistryAbi } from "@/lib/contracts";
import { getFriendlyErrorMessage } from "@/lib/friendly-errors";
import { waitForTransactionReceiptViaServer } from "@/lib/transaction-receipt";
import type { RuntimeConfig } from "@/types/contract-config";
import type { PlatformActivationPreviewResponse } from "@/types/domain";

type BatchAction = "resume" | "pause" | "close";

/**
 * 平台批次动作和 claim 一样，采用“提交交易 + 单一路径等待回执”的模型。
 * 这样 publish / pause / close 的钱包交互足够薄，上层再统一接管乐观更新与页面同步。
 */
export function usePlatformBatchActions(config: RuntimeConfig) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const { data: hash, isPending, writeContractAsync } = useWriteContract();

  /**
   * submitBatchAction 负责把平台操作意图翻译成具体合约调用。
   * 这里把 publish / pause / close 收敛成一个入口，页面侧就不需要分别维护三套写链分支。
   */
  async function submitBatchAction(action: BatchAction, payload: { batchIdHex: `0x${string}` }) {
    try {
      setActionError(null);

      if (action === "resume") {
        return await writeContractAsync({
          address: config.batchRegistryAddress,
          abi: revenueBatchRegistryAbi,
          functionName: "resumeBatch",
          args: [payload.batchIdHex]
        });
      }

      if (action === "pause") {
        return await writeContractAsync({
          address: config.batchRegistryAddress,
          abi: revenueBatchRegistryAbi,
          functionName: "pauseBatch",
          args: [payload.batchIdHex]
        });
      }

      return await writeContractAsync({
        address: config.batchRegistryAddress,
        abi: revenueBatchRegistryAbi,
        functionName: "closeBatch",
        args: [payload.batchIdHex]
      });
    } catch (error) {
      const context = action === "resume" ? "batch-publish" : action === "pause" ? "batch-pause" : "batch-close";
      setActionError(getFriendlyErrorMessage(error, context));
      throw error;
    }
  }

  async function submitBatchActivation(payload: PlatformActivationPreviewResponse) {
    try {
      setActionError(null);

      return await writeContractAsync({
        address: config.distributorAddress,
        abi: creatorRevenueDistributorAbi,
        functionName: "activateBatchWithFunding",
        args: [
          payload.batchIdHex,
          payload.merkleRoot,
          payload.metadataHash,
          payload.claimIdHex,
          payload.monthLabel,
          payload.billId,
          BigInt(payload.grossAmountWei),
          payload.creator
        ],
        value: BigInt(payload.grossAmountWei)
      });
    } catch (error) {
      setActionError(getFriendlyErrorMessage(error, "batch-publish"));
      throw error;
    }
  }

  /**
   * receipt 等待和业务状态乐观更新是分层的。
   * 这里先拿到链确认，真正的缓存修补放到 query-cache-updates 里做，
   * 从而保持 hook 只面向钱包和链确认，不直接耦合页面缓存细节。
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
    submitBatchAction,
    submitBatchActivation,
    waitForReceipt
  };
}
