import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { decodeEventLog, parseAbiItem } from "viem";
import { useChainId, usePublicClient, useWriteContract } from "wagmi";

import { eventFactoryAbi } from "@/lib/contract";
import { copy } from "@/lib/copy";
import { CHAIN_ID, EVENT_FACTORY_ADDRESS, IS_CONTRACT_CONFIGURED } from "@/lib/config";

type CreateEventParams = {
  question: string;
  closeDurationSec: number;
  resolutionSourceURI: string;
  metadataURI: string;
};

type CreateEventResult = {
  success: boolean;
  eventId: bigint | null;
  eventIdResolved: boolean;
};

const eventCreatedEvent = parseAbiItem(
  "event EventCreated(uint256 indexed eventId,address indexed creator,string question,uint64 closeTime,string resolutionSourceURI,string metadataURI)"
);

/** 汇总多层 error 对象中的可读线索，便于统一映射用户提示。 */
function extractErrorHints(error: unknown): string {
  const hints: string[] = [];

  const push = (value: unknown) => {
    if (typeof value === "string" && value.trim().length > 0) {
      hints.push(value);
    }
  };

  const visit = (value: unknown) => {
    if (!value) {
      return;
    }
    if (typeof value === "string") {
      push(value);
      return;
    }
    if (value instanceof Error) {
      push(value.message);
      visit((value as { cause?: unknown }).cause);
      return;
    }
    if (typeof value === "object") {
      const obj = value as Record<string, unknown>;
      push(obj.shortMessage);
      push(obj.message);
      push(obj.details);
      push(obj.reason);
      visit(obj.cause);
    }
  };

  visit(error);
  try {
    push(String(error));
  } catch {
    // 部分错误对象无法安全字符串化，忽略该分支不会影响已有提示线索。
  }

  return hints.join(" | ");
}

/** 将链上/钱包错误关键字映射为统一文案。 */
function mapCreateEventError(error: unknown): string {
  const normalized = extractErrorHints(error).toUpperCase();
  if (normalized.includes("CLOSE_DURATION_TOO_SHORT")) {
    return copy.errors.createEvent.closeDurationTooShort;
  }
  if (normalized.includes("CLOSE_DURATION_TOO_LONG")) {
    return copy.errors.createEvent.closeDurationTooLong;
  }
  if (normalized.includes("ONLY_OWNER")) {
    return copy.errors.createEvent.ownerOnly;
  }
  if (normalized.includes("QUESTION_EMPTY")) {
    return copy.errors.createEvent.questionRequired;
  }
  if (normalized.includes("ENDTIME_IN_PAST")) {
    return copy.errors.createEvent.endTimePast;
  }
  if (normalized.includes("USER REJECTED")) {
    return copy.errors.createEvent.userRejected;
  }
  return copy.errors.createEvent.fallback;
}

/** 创建事件 Hook：封装交易提交、事件解析与查询刷新。 */
export function useCreateEvent() {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const queryClient = useQueryClient();
  const chainId = useChainId();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 兼容多种日志解码返回类型，统一提取正整数 eventId。 */
  const normalizeEventId = (value: unknown): bigint | null => {
    if (typeof value === "bigint") {
      return value > 0n ? value : null;
    }
    if (typeof value === "number" && Number.isInteger(value) && value > 0) {
      return BigInt(value);
    }
    if (typeof value === "string" && /^[1-9]\d*$/.test(value.trim())) {
      return BigInt(value.trim());
    }
    return null;
  };

  /** 发起创建交易并回读事件 ID；未解析到 ID 时降级读取 eventCount。 */
  const createEvent = async (params: CreateEventParams): Promise<CreateEventResult> => {
    setError(null);

    if (!IS_CONTRACT_CONFIGURED || !EVENT_FACTORY_ADDRESS || !publicClient) {
      setError(copy.errors.createEvent.systemNotReady);
      return { success: false, eventId: null, eventIdResolved: false };
    }
    if (chainId !== CHAIN_ID) {
      setError(copy.common.switchToLocalChain);
      return { success: false, eventId: null, eventIdResolved: false };
    }

    setIsPending(true);
    try {
      const hash = await writeContractAsync({
        address: EVENT_FACTORY_ADDRESS,
        abi: eventFactoryAbi,
        functionName: "createEventWithDuration",
        args: [
          params.question.trim(),
          BigInt(params.closeDurationSec),
          params.resolutionSourceURI.trim(),
          params.metadataURI.trim()
        ]
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      let eventId: bigint | null = null;
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== EVENT_FACTORY_ADDRESS.toLowerCase()) {
          continue;
        }
        try {
          const decoded = decodeEventLog({
            abi: [eventCreatedEvent],
            data: log.data,
            topics: log.topics
          });
          eventId = normalizeEventId(decoded.args.eventId);
          break;
        } catch {
          // 同一交易可能包含非 EventCreated 日志；解码失败时继续遍历后续日志即可。
        }
      }

      if (eventId === null) {
        try {
          const count = await publicClient.readContract({
            address: EVENT_FACTORY_ADDRESS,
            abi: eventFactoryAbi,
            functionName: "eventCount"
          });
          eventId = normalizeEventId(count);
        } catch {
          eventId = null;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["events", EVENT_FACTORY_ADDRESS] });
      queryClient.invalidateQueries({ queryKey: ["activities"], exact: false });
      if (eventId === null) {
        setError(copy.errors.createEvent.eventIdNotResolved);
      }
      return { success: true, eventId, eventIdResolved: eventId !== null };
    } catch (caught) {
      setError(mapCreateEventError(caught));
      return { success: false, eventId: null, eventIdResolved: false };
    } finally {
      setIsPending(false);
    }
  };

  return { createEvent, isPending, error };
}
