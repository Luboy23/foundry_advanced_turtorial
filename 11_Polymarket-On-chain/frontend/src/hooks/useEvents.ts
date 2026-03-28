import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";

import { eventFactoryAbi } from "@/lib/contract";
import { EVENT_FACTORY_ADDRESS, IS_CONTRACT_CONFIGURED } from "@/lib/config";
import { decodeEventTuple } from "@/lib/event-readers";
import type { EventEntity } from "@/lib/event-types";

const emptyEvents: EventEntity[] = [];

/** 读取事件列表并按事件 ID 倒序返回。 */
export function useEvents() {
  const publicClient = usePublicClient();

  return useQuery<EventEntity[]>({
    queryKey: ["events", EVENT_FACTORY_ADDRESS ?? "unconfigured"],
    queryFn: async () => {
      const address = EVENT_FACTORY_ADDRESS;
      if (!publicClient || !IS_CONTRACT_CONFIGURED || !address) {
        return emptyEvents;
      }

      const count = (await publicClient.readContract({
        address,
        abi: eventFactoryAbi,
        functionName: "eventCount"
      })) as bigint;

      if (count === 0n) {
        return emptyEvents;
      }

      const ids = Array.from({ length: Number(count) }, (_, index) => BigInt(index + 1));

      // 批量按 ID 读取事件详情，再由 reader 统一解码为前端实体。
      const events = await Promise.all(
        ids.map(async (eventId) => {
          const tuple = (await publicClient.readContract({
            address,
            abi: eventFactoryAbi,
            functionName: "getEvent",
            args: [eventId]
          })) as [string, bigint, number, number, bigint, bigint, bigint, bigint, bigint, string, string];
          return decodeEventTuple(eventId, tuple);
        })
      );

      return events.sort((a, b) => Number(b.id - a.id));
    },
    initialData: emptyEvents
  });
}
