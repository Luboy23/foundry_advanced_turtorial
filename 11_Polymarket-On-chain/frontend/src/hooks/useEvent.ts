import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";

import { eventFactoryAbi } from "@/lib/contract";
import { EVENT_FACTORY_ADDRESS, IS_CONTRACT_CONFIGURED } from "@/lib/config";
import { decodeEventTuple, decodeResolutionTuple } from "@/lib/event-readers";
import type { EventEntity, ResolutionEntity } from "@/lib/event-types";

/** 事件详情查询结果：事件主体 + 结算状态。 */
export type EventDetail = {
  event: EventEntity;
  resolution: ResolutionEntity;
};

/** 读取单个事件详情与结算状态。 */
export function useEvent(eventId: bigint | null) {
  const publicClient = usePublicClient();
  const enabled = !!eventId && !!publicClient && IS_CONTRACT_CONFIGURED && !!EVENT_FACTORY_ADDRESS;

  return useQuery<EventDetail | null>({
    queryKey: ["event", EVENT_FACTORY_ADDRESS ?? "unconfigured", eventId?.toString() ?? "none"],
    queryFn: async () => {
      if (!enabled) {
        return null;
      }

      try {
        // 并发读取主体信息与结算信息，减少详情页首屏等待时间。
        const [eventTuple, resolutionTuple] = await Promise.all([
          publicClient!.readContract({
            address: EVENT_FACTORY_ADDRESS!,
            abi: eventFactoryAbi,
            functionName: "getEvent",
            args: [eventId!]
          }) as Promise<[string, bigint, number, number, bigint, bigint, bigint, bigint, bigint, string, string]>,
          publicClient!.readContract({
            address: EVENT_FACTORY_ADDRESS!,
            abi: eventFactoryAbi,
            functionName: "getResolutionState",
            args: [eventId!]
          }) as Promise<[`0x${string}`, number, bigint, boolean, boolean, bigint]>
        ]);

        return {
          event: decodeEventTuple(eventId, eventTuple),
          resolution: decodeResolutionTuple(resolutionTuple)
        };
      } catch {
        return null;
      }
    },
    enabled,
    refetchInterval: 4000,
    refetchIntervalInBackground: true,
    initialData: null
  });
}
