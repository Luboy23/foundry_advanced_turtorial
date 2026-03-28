import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BaseError, parseEther } from "viem";
import { useChainId, usePublicClient, useWriteContract } from "wagmi";

import { eventFactoryAbi } from "@/lib/contract";
import { copy } from "@/lib/copy";
import { CHAIN_ID, EVENT_FACTORY_ADDRESS, IS_CONTRACT_CONFIGURED } from "@/lib/config";
import { EventState, eventStateLabel, type Outcome } from "@/lib/event-types";

/** 事件动作 Hook：买入、提案、最终化、赎回与统一错误处理。 */
export function useEventActions(eventId: bigint | null) {
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const { writeContractAsync } = useWriteContract();
  const chainId = useChainId();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 交易写入前置校验：事件上下文、合约配置与链 ID。 */
  const ensureWritable = () => {
    if (!eventId || !IS_CONTRACT_CONFIGURED || !EVENT_FACTORY_ADDRESS || !publicClient) {
      setError(copy.errors.eventActions.systemNotReady);
      return false;
    }
    if (chainId !== CHAIN_ID) {
      setError(copy.common.switchToLocalChain);
      return false;
    }
    return true;
  };

  /** 刷新交易后受影响的查询，确保页面状态与链上同步。 */
  const refreshRelatedQueries = async () => {
    if (!eventId || !EVENT_FACTORY_ADDRESS) {
      return;
    }
    const id = eventId.toString();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["event", EVENT_FACTORY_ADDRESS, id], exact: false }),
      queryClient.invalidateQueries({ queryKey: ["events", EVENT_FACTORY_ADDRESS], exact: false }),
      queryClient.invalidateQueries({ queryKey: ["position", EVENT_FACTORY_ADDRESS, id], exact: false }),
      queryClient.invalidateQueries({ queryKey: ["user-portfolio"], exact: false }),
      queryClient.invalidateQueries({ queryKey: ["activities"], exact: false }),
      queryClient.invalidateQueries({ queryKey: ["redeem-preview", EVENT_FACTORY_ADDRESS, id], exact: false })
    ]);
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ["event", EVENT_FACTORY_ADDRESS, id], exact: false }),
      queryClient.refetchQueries({ queryKey: ["events", EVENT_FACTORY_ADDRESS], exact: false }),
      queryClient.refetchQueries({ queryKey: ["position", EVENT_FACTORY_ADDRESS, id], exact: false }),
      queryClient.refetchQueries({ queryKey: ["user-portfolio"], exact: false }),
      queryClient.refetchQueries({ queryKey: ["activities"], exact: false }),
      queryClient.refetchQueries({ queryKey: ["redeem-preview", EVENT_FACTORY_ADDRESS, id], exact: false })
    ]);
  };

  /** 买入前二次校验：实时读取链上状态，确保仅 `Open` 事件可买入。 */
  const ensureEventOpenForBuy = async () => {
    if (!ensureWritable() || !publicClient || !EVENT_FACTORY_ADDRESS || !eventId) {
      return false;
    }
    try {
      const eventTuple = await publicClient.readContract({
        address: EVENT_FACTORY_ADDRESS,
        abi: eventFactoryAbi,
        functionName: "getEvent",
        args: [eventId]
      });
      const state = parseEventStateFromGetEventTuple(eventTuple);
      if (state === null) {
        setError(copy.errors.eventActions.txFailed("读取事件状态失败，请稍后重试。"));
        return false;
      }
      if (state !== EventState.Open) {
        setError(copy.eventDetail.cannotBuy(eventStateLabel[state]));
        return false;
      }
      return true;
    } catch (error) {
      setError(extractReadableError(error));
      return false;
    }
  };

  /** 统一交易执行模板：发送交易、等待回执、刷新查询。 */
  const withTx = async (exec: () => Promise<`0x${string}`>) => {
    setError(null);
    if (!ensureWritable() || !publicClient) {
      return false;
    }

    setIsPending(true);
    try {
      const hash = await exec();
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        setError(copy.errors.eventActions.txReverted);
        return false;
      }
      await refreshRelatedQueries();
      return true;
    } catch (error) {
      setError(extractReadableError(error));
      return false;
    } finally {
      setIsPending(false);
    }
  };

  /** 买入“是”头寸（单位：ETH 字符串）。 */
  const buyYes = async (amount: string) => {
    const value = parsePositiveAmountToWei(amount);
    if (value === null || value === 0n) {
      setError(copy.errors.eventActions.invalidBuyAmount);
      return false;
    }
    if (!(await ensureEventOpenForBuy())) {
      return false;
    }

    return withTx(async () =>
      writeContractAsync({
        address: EVENT_FACTORY_ADDRESS!,
        abi: eventFactoryAbi,
        functionName: "buyYes",
        args: [eventId!],
        value
      })
    );
  };

  /** 买入“否”头寸（单位：ETH 字符串）。 */
  const buyNo = async (amount: string) => {
    const value = parsePositiveAmountToWei(amount);
    if (value === null || value === 0n) {
      setError(copy.errors.eventActions.invalidBuyAmount);
      return false;
    }
    if (!(await ensureEventOpenForBuy())) {
      return false;
    }

    return withTx(async () =>
      writeContractAsync({
        address: EVENT_FACTORY_ADDRESS!,
        abi: eventFactoryAbi,
        functionName: "buyNo",
        args: [eventId!],
        value
      })
    );
  };

  /** 提交事件结果提案。 */
  const proposeResolution = async (outcome: Outcome) =>
    withTx(async () =>
      writeContractAsync({
        address: EVENT_FACTORY_ADDRESS!,
        abi: eventFactoryAbi,
        functionName: "proposeResolution",
        args: [eventId!, outcome]
      })
    );

  /** 确认最终结果（冷静期后）。 */
  const finalizeResolution = async () =>
    withTx(async () =>
      writeContractAsync({
        address: EVENT_FACTORY_ADDRESS!,
        abi: eventFactoryAbi,
        functionName: "finalizeResolution",
        args: [eventId!]
      })
    );

  /** 按输入份额赎回 ETH。 */
  const redeemToETH = async (yesAmount: string, noAmount: string) => {
    const yes = parseNonNegativeAmountToWei(yesAmount);
    const no = parseNonNegativeAmountToWei(noAmount);
    if (yes === null || no === null) {
      setError(copy.errors.eventActions.invalidRedeemAmount);
      return false;
    }
    if (yes === 0n && no === 0n) {
      setError(copy.errors.eventActions.redeemAmountBothZero);
      return false;
    }

    return withTx(async () =>
      writeContractAsync({
        address: EVENT_FACTORY_ADDRESS!,
        abi: eventFactoryAbi,
        functionName: "redeemToETH",
        args: [eventId!, yes, no]
      })
    );
  };

  return {
    buyYes,
    buyNo,
    proposeResolution,
    finalizeResolution,
    redeemToETH,
    isPending,
    error
  };
}

/** 从 `getEvent` 返回 tuple 中提取并校验事件状态。 */
function parseEventStateFromGetEventTuple(value: unknown): EventState | null {
  if (!Array.isArray(value) || value.length < 3) {
    return null;
  }
  const rawState = value[2];
  if (typeof rawState !== "bigint" && typeof rawState !== "number") {
    return null;
  }
  const state = Number(rawState);
  if (
    state !== EventState.Open &&
    state !== EventState.Closed &&
    state !== EventState.Proposed &&
    state !== EventState.Resolved
  ) {
    return null;
  }
  return state;
}

/** 解析正数 ETH 文本输入；非法或非正数返回 `null`。 */
function parsePositiveAmountToWei(value: string): bigint | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  try {
    const parsed = parseEther(normalized);
    if (parsed <= 0n) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** 解析非负 ETH 文本输入；空字符串视为 0。 */
function parseNonNegativeAmountToWei(value: string): bigint | null {
  const normalized = value.trim();
  if (!normalized) {
    return 0n;
  }
  try {
    const parsed = parseEther(normalized);
    if (parsed < 0n) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** 提取 wagmi/viem 错误中的可读原因并映射统一文案。 */
function extractReadableError(error: unknown) {
  if (error instanceof BaseError) {
    const reason = error.walk((item) => item instanceof Error)?.message ?? error.shortMessage;
    if (reason) {
      return copy.errors.eventActions.txFailed(reason);
    }
  }
  if (error instanceof Error && error.message) {
    return copy.errors.eventActions.txFailed(error.message);
  }
  return copy.errors.eventActions.txFailedFallback;
}
