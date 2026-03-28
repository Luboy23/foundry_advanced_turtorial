import { useQuery } from "@tanstack/react-query";
import { parseEther } from "viem";
import { usePublicClient } from "wagmi";

import { eventFactoryAbi } from "@/lib/contract";
import { EVENT_FACTORY_ADDRESS, IS_CONTRACT_CONFIGURED } from "@/lib/config";

type UseRedeemPreviewParams = {
  eventId: bigint | null;
  yesAmount: string;
  noAmount: string;
};

/** 读取赎回预估金额（单位：wei）。 */
export function useRedeemPreview({ eventId, yesAmount, noAmount }: UseRedeemPreviewParams) {
  const publicClient = usePublicClient();

  return useQuery<bigint>({
    queryKey: ["redeem-preview", EVENT_FACTORY_ADDRESS ?? "unconfigured", eventId?.toString() ?? "none", yesAmount, noAmount],
    queryFn: async () => {
      if (!publicClient || !eventId || !IS_CONTRACT_CONFIGURED || !EVENT_FACTORY_ADDRESS) {
        return 0n;
      }

      try {
        // 前端输入按 ETH 文本解析为链上所需的 18 位精度整数。
        const yes = yesAmount.trim() ? parseEther(yesAmount) : 0n;
        const no = noAmount.trim() ? parseEther(noAmount) : 0n;
        return (await publicClient.readContract({
          address: EVENT_FACTORY_ADDRESS,
          abi: eventFactoryAbi,
          functionName: "getRedeemPreview",
          args: [eventId, yes, no]
        })) as bigint;
      } catch {
        return 0n;
      }
    },
    initialData: 0n
  });
}
