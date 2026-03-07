"use client";

import { useMemo, useState } from "react";
import {
  useAccount,
  useConnect,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

import { audioManager } from "@/lib/audio";
import {
  LIGHTS_OUT_ABI,
  LIGHTS_OUT_ADDRESS,
  LIGHTS_OUT_ADDRESS_VALID,
  densityToIndex,
} from "@/lib/contract";
import { useGameStore } from "@/store/gameStore";
import { secondaryButtonClass } from "./buttonStyles";

const clampUInt32 = (value: number) =>
  Math.min(Math.max(Math.floor(value), 0), 0xffffffff);

export const SubmitOnchainButton = () => {
  const settings = useGameStore((state) => state.settings);
  const hasWon = useGameStore((state) => state.hasWon);
  const movesCount = useGameStore((state) => state.movesCount);
  const startedAt = useGameStore((state) => state.startedAt);
  const isPaused = useGameStore((state) => state.isPaused);
  const pausedAt = useGameStore((state) => state.pausedAt);
  const pausedTotalMs = useGameStore((state) => state.pausedTotalMs);
  const usedHint = useGameStore((state) => state.usedHint);
  const lastResult = useGameStore((state) => state.lastResult);

  const { isConnected } = useAccount();
  // 钱包连接与写交易能力
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { writeContractAsync, isPending: isSubmitting } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash ?? undefined,
  });

  const durationMs = useMemo(() => {
    if (lastResult?.durationMs) return lastResult.durationMs;
    const now = Date.now();
    const pauseMs =
      pausedTotalMs + (isPaused ? Math.max(0, now - pausedAt) : 0);
    return Math.max(0, now - startedAt - pauseMs);
  }, [isPaused, lastResult, pausedAt, pausedTotalMs, startedAt]);

  const moves = useMemo(() => {
    if (lastResult?.moves) return lastResult.moves;
    return movesCount;
  }, [lastResult, movesCount]);

  const gridSize = lastResult?.gridSize ?? settings.gridSize;
  const density = lastResult?.density ?? settings.density;
  const usedHintSnapshot =
    typeof lastResult?.usedHint === "boolean" ? lastResult.usedHint : usedHint;

  const handleSubmit = async () => {
    audioManager.playSfx("click");
    setError(null);

    if (!hasWon) {
      setError("仅通关后可提交");
      return;
    }

    // 未连接钱包时先发起连接
    if (!isConnected) {
      const connector = connectors[0];
      if (connector) {
        connect({ connector });
      } else {
        setError("未检测到钱包");
      }
      return;
    }

    // 合约地址校验：未配置则不允许提交
    if (!LIGHTS_OUT_ADDRESS_VALID || !LIGHTS_OUT_ADDRESS) {
      setError("未配置合约地址");
      return;
    }

    try {
      // 写交易：提交成绩到链上
      const hash = await writeContractAsync({
        address: LIGHTS_OUT_ADDRESS,
        abi: LIGHTS_OUT_ABI,
        functionName: "submitResult",
        args: [
          gridSize,
          densityToIndex(density),
          clampUInt32(moves),
          clampUInt32(durationMs),
          usedHintSnapshot,
        ],
      });
      setTxHash(hash);
    } catch (err) {
      setError("提交失败，请重试");
    }
  };

  const buttonText = () => {
    if (isSuccess) return "已上链";
    if (isConfirming) return "确认中…";
    if (isSubmitting) return "提交中…";
    if (isConnecting) return "连接中…";
    if (!isConnected) return "连接钱包并上链";
    return "上链记录";
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!hasWon || isSubmitting || isConfirming || isSuccess}
        className={`${secondaryButtonClass} w-full min-w-[140px] justify-center ${
          !hasWon || isSubmitting || isConfirming || isSuccess
            ? "cursor-not-allowed opacity-70"
            : ""
        }`}
      >
        {buttonText()}
      </button>
      {error && <p className="text-[11px] text-rose-400">{error}</p>}
    </div>
  );
};
