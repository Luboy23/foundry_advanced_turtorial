import { useQuery } from "@tanstack/react-query";
import { useAccount, usePublicClient } from "wagmi";

import { eventFactoryAbi } from "@/lib/contract";
import { EVENT_FACTORY_ADDRESS, IS_CONTRACT_CONFIGURED } from "@/lib/config";
import type { PositionEntity } from "@/lib/event-types";

const emptyPosition: PositionEntity = { yesBalance: 0n, noBalance: 0n };

/** 读取用户在单事件中的 YES/NO 持仓。 */
export function useUserPosition(eventId: bigint | null) {
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const enabled = !!eventId && !!address && !!publicClient && IS_CONTRACT_CONFIGURED && !!EVENT_FACTORY_ADDRESS;

  return useQuery<PositionEntity>({
    queryKey: [
      "position",
      EVENT_FACTORY_ADDRESS ?? "unconfigured",
      eventId?.toString() ?? "none",
      address ?? "disconnected"
    ],
    queryFn: async () => {
      if (!enabled) {
        return emptyPosition;
      }
      const [yesBalance, noBalance] = (await publicClient!.readContract({
        address: EVENT_FACTORY_ADDRESS!,
        abi: eventFactoryAbi,
        functionName: "getUserPosition",
        args: [eventId!, address!]
      })) as [bigint, bigint];

      return { yesBalance, noBalance };
    },
    enabled,
    refetchInterval: 4000,
    refetchIntervalInBackground: true,
    initialData: emptyPosition
  });
}
