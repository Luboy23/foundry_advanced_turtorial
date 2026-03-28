import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";

import { eventFactoryAbi } from "@/lib/contract";
import { EVENT_FACTORY_ADDRESS, IS_CONTRACT_CONFIGURED } from "@/lib/config";

/** EventFactory 权限地址集合。 */
export type EventAuthorities = {
  owner: `0x${string}` | null;
  resolver: `0x${string}` | null;
};

const emptyAuthorities: EventAuthorities = {
  owner: null,
  resolver: null
};

/** 读取 owner 与 resolver 地址，用于权限门禁。 */
export function useEventOwner() {
  const publicClient = usePublicClient();

  return useQuery<EventAuthorities>({
    queryKey: ["event-authorities", EVENT_FACTORY_ADDRESS ?? "unconfigured"],
    queryFn: async () => {
      if (!publicClient || !IS_CONTRACT_CONFIGURED || !EVENT_FACTORY_ADDRESS) {
        return emptyAuthorities;
      }

      try {
        const [owner, resolver] = await Promise.all([
          publicClient.readContract({
            address: EVENT_FACTORY_ADDRESS,
            abi: eventFactoryAbi,
            functionName: "owner"
          }) as Promise<`0x${string}`>,
          publicClient.readContract({
            address: EVENT_FACTORY_ADDRESS,
            abi: eventFactoryAbi,
            functionName: "resolver"
          }) as Promise<`0x${string}`>
        ]);

        return { owner, resolver };
      } catch {
        return emptyAuthorities;
      }
    },
    initialData: emptyAuthorities
  });
}
