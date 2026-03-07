"use client";

import { useEffect } from "react";
import { usePublicClient } from "wagmi";
import { ANVIL_CHAIN_ID } from "@/lib/chain";
import {
  SCORE_CONTRACT_ABI,
  SCORE_CONTRACT_ADDRESS,
  isZeroAddress,
} from "@/lib/contract";

type ScoreEventWatcherProps = {
  onScoreSubmitted: () => void;
};

export default function ScoreEventWatcher({
  onScoreSubmitted,
}: ScoreEventWatcherProps) {
  // 公共客户端：监听链上事件（无需钱包签名）
  const publicClient = usePublicClient({ chainId: ANVIL_CHAIN_ID });

  useEffect(() => {
    if (!publicClient || isZeroAddress(SCORE_CONTRACT_ADDRESS)) {
      return;
    }
    // 监听 ScoreSubmitted 事件，用于前端刷新
    const unwatch = publicClient.watchContractEvent({
      address: SCORE_CONTRACT_ADDRESS as `0x${string}`,
      abi: SCORE_CONTRACT_ABI,
      eventName: "ScoreSubmitted",
      onLogs: () => {
        // 任意地址提交成功都刷新一次，保证排行榜/历史与链上状态一致。
        onScoreSubmitted();
      },
    });

    return () => {
      if (typeof unwatch === "function") {
        unwatch();
      }
    };
  }, [onScoreSubmitted, publicClient]);

  return null;
}
