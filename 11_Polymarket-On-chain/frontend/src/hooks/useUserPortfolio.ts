import { useQuery } from "@tanstack/react-query";
import { useAccount, usePublicClient } from "wagmi";

import { eventFactoryAbi } from "@/lib/contract";
import { EVENT_FACTORY_ADDRESS, IS_CONTRACT_CONFIGURED } from "@/lib/config";
import { EventState } from "@/lib/event-types";

/** 用户在单事件下的持仓摘要。 */
export type UserPositionSummary = {
  eventId: bigint;
  yesBalance: bigint;
  noBalance: bigint;
  claimable: bigint;
};

/** 用户投资组合聚合视图。 */
export type UserPortfolio = {
  totalPosition: bigint;
  totalClaimable: bigint;
  positions: UserPositionSummary[];
};

const emptyPortfolio: UserPortfolio = {
  totalPosition: 0n,
  totalClaimable: 0n,
  positions: []
};

/** 聚合读取用户在所有事件的持仓与可赎回金额。 */
export function useUserPortfolio() {
  const publicClient = usePublicClient();
  const { address } = useAccount();

  return useQuery<UserPortfolio>({
    queryKey: ["user-portfolio", EVENT_FACTORY_ADDRESS ?? "unconfigured", address ?? "disconnected"],
    queryFn: async () => {
      const contractAddress = EVENT_FACTORY_ADDRESS;
      if (!publicClient || !address || !IS_CONTRACT_CONFIGURED || !contractAddress) {
        return emptyPortfolio;
      }

      try {
        const count = (await publicClient.readContract({
          address: contractAddress,
          abi: eventFactoryAbi,
          functionName: "eventCount"
        })) as bigint;

        if (count === 0n) {
          return emptyPortfolio;
        }

        const ids = Array.from({ length: Number(count) }, (_, index) => BigInt(index + 1));

        // 并发读取每个事件的持仓，并在已结算事件中追加赎回预估。
        const positions = await Promise.all(
          ids.map(async (eventId) => {
            const [yesBalance, noBalance] = (await publicClient.readContract({
              address: contractAddress,
              abi: eventFactoryAbi,
              functionName: "getUserPosition",
              args: [eventId, address]
            })) as [bigint, bigint];

            if (yesBalance === 0n && noBalance === 0n) {
              return null;
            }

            const eventTuple = (await publicClient.readContract({
              address: contractAddress,
              abi: eventFactoryAbi,
              functionName: "getEvent",
              args: [eventId]
            })) as [string, bigint, number, number, bigint, bigint, bigint, bigint, bigint, string, string];

            let claimable = 0n;
            if (eventTuple[2] === EventState.Resolved) {
              claimable = (await publicClient.readContract({
                address: contractAddress,
                abi: eventFactoryAbi,
                functionName: "getRedeemPreview",
                args: [eventId, yesBalance, noBalance]
              })) as bigint;
            }

            return { eventId, yesBalance, noBalance, claimable } satisfies UserPositionSummary;
          })
        );

        const validPositions = positions.filter((item): item is UserPositionSummary => item !== null);
        const totals = validPositions.reduce(
          (acc, position) => {
            acc.totalPosition += position.yesBalance + position.noBalance;
            acc.totalClaimable += position.claimable;
            return acc;
          },
          { totalPosition: 0n, totalClaimable: 0n }
        );

        return {
          ...totals,
          positions: validPositions
        };
      } catch {
        return emptyPortfolio;
      }
    },
    initialData: emptyPortfolio
  });
}
