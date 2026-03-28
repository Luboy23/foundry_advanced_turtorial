import { useQueryClient } from "@tanstack/react-query";
import { useWatchContractEvent } from "wagmi";

import { eventFactoryAbi } from "@/lib/contract";
import { EVENT_FACTORY_ADDRESS, IS_CONTRACT_CONFIGURED } from "@/lib/config";

/** 监听核心链上事件并统一触发前端缓存失效。 */
export function useEventEvents() {
  const queryClient = useQueryClient();
  const enabled = IS_CONTRACT_CONFIGURED && !!EVENT_FACTORY_ADDRESS;

  /** 事件触发后的统一缓存失效策略。 */
  const invalidateAll = () => {
    if (!EVENT_FACTORY_ADDRESS) {
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["events", EVENT_FACTORY_ADDRESS] });
    queryClient.invalidateQueries({ queryKey: ["event"], exact: false });
    queryClient.invalidateQueries({ queryKey: ["position"], exact: false });
    queryClient.invalidateQueries({ queryKey: ["user-portfolio"], exact: false });
    queryClient.invalidateQueries({ queryKey: ["activities"], exact: false });
    queryClient.invalidateQueries({ queryKey: ["redeem-preview"], exact: false });
  };

  useWatchContractEvent({
    address: EVENT_FACTORY_ADDRESS ?? undefined,
    abi: eventFactoryAbi,
    eventName: "EventCreated",
    enabled,
    onLogs: invalidateAll
  });

  useWatchContractEvent({
    address: EVENT_FACTORY_ADDRESS ?? undefined,
    abi: eventFactoryAbi,
    eventName: "PositionBought",
    enabled,
    onLogs: invalidateAll
  });

  useWatchContractEvent({
    address: EVENT_FACTORY_ADDRESS ?? undefined,
    abi: eventFactoryAbi,
    eventName: "ResolutionProposed",
    enabled,
    onLogs: invalidateAll
  });

  useWatchContractEvent({
    address: EVENT_FACTORY_ADDRESS ?? undefined,
    abi: eventFactoryAbi,
    eventName: "ResolutionFinalized",
    enabled,
    onLogs: invalidateAll
  });

  useWatchContractEvent({
    address: EVENT_FACTORY_ADDRESS ?? undefined,
    abi: eventFactoryAbi,
    eventName: "Redeemed",
    enabled,
    onLogs: invalidateAll
  });

}
