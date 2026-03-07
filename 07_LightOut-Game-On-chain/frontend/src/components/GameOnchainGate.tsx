"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useAccount,
  useChainId,
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
import { primaryButtonClass, secondaryButtonClass } from "./buttonStyles";

const ANVIL_CHAIN_ID = 31337;

// 合约参数是 uint32，这里统一做上限裁剪，避免前端异常值导致回滚
const clampUInt32 = (value: number) =>
  Math.min(Math.max(Math.floor(value), 0), 0xffffffff);

export const GameOnchainGate = () => {
  const settings = useGameStore((state) => state.settings);
  const hasWon = useGameStore((state) => state.hasWon);
  const movesCount = useGameStore((state) => state.movesCount);
  const startedAt = useGameStore((state) => state.startedAt);
  const isPaused = useGameStore((state) => state.isPaused);
  const pausedAt = useGameStore((state) => state.pausedAt);
  const pausedTotalMs = useGameStore((state) => state.pausedTotalMs);
  const usedHint = useGameStore((state) => state.usedHint);
  const lastResult = useGameStore((state) => state.lastResult);
  const newGame = useGameStore((state) => state.newGame);
  const returnHome = useGameStore((state) => state.returnHome);
  const bumpChainRefresh = useGameStore((state) => state.bumpChainRefresh);

  const chainId = useChainId();
  const { isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { writeContractAsync, isPending: isSubmitting } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [error, setError] = useState<string | null>(null);
  const attemptRef = useRef(false);
  const sessionRef = useRef<number>(0);

  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({
      hash: txHash ?? undefined,
    });

  const durationMs = useMemo(() => {
    // 若已有通关快照则优先使用快照，确保上链数据与面板展示一致
    if (lastResult?.durationMs) return lastResult.durationMs;
    const now = Date.now();
    const pauseMs =
      pausedTotalMs + (isPaused ? Math.max(0, now - pausedAt) : 0);
    return Math.max(0, now - startedAt - pauseMs);
  }, [isPaused, lastResult, pausedAt, pausedTotalMs, startedAt]);

  const moves = useMemo(() => {
    // 同理：通关后固定使用快照步数，避免后续 UI 状态变更影响上链参数
    if (lastResult?.moves) return lastResult.moves;
    return movesCount;
  }, [lastResult, movesCount]);

  const gridSize = lastResult?.gridSize ?? settings.gridSize;
  const density = lastResult?.density ?? settings.density;
  const usedHintSnapshot =
    typeof lastResult?.usedHint === "boolean" ? lastResult.usedHint : usedHint;

  const resetState = useCallback(() => {
    setTxHash(null);
    setError(null);
    attemptRef.current = false;
  }, []);

  useEffect(() => {
    if (!hasWon) {
      resetState();
      return;
    }

    // startedAt 变化视为新对局，重置一次上链流程状态
    if (sessionRef.current !== startedAt) {
      sessionRef.current = startedAt;
      resetState();
    }
  }, [hasWon, resetState, startedAt]);

  const handleSubmit = useCallback(async () => {
    setError(null);

    if (!hasWon) {
      setError("仅通关后可提交");
      return;
    }

    if (!LIGHTS_OUT_ADDRESS_VALID || !LIGHTS_OUT_ADDRESS) {
      setError("未配置合约地址");
      return;
    }

    if (chainId !== ANVIL_CHAIN_ID) {
      setError("请切换到 Anvil (31337)");
      return;
    }

    try {
      // 仅在通关态提交一次结果：棋盘尺寸、密度、步数、用时、是否使用提示
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
      attemptRef.current = false;
      setError("签名或提交失败，请重试");
    }
  }, [
    chainId,
    density,
    durationMs,
    gridSize,
    hasWon,
    moves,
    usedHintSnapshot,
    writeContractAsync,
  ]);

  useEffect(() => {
    // 自动提交策略：满足“已通关 + 已连接 + 网络正确 + 合约可用”时自动触发一次
    if (!hasWon) return;
    if (attemptRef.current) return;
    if (!isConnected) return;
    if (!LIGHTS_OUT_ADDRESS_VALID || !LIGHTS_OUT_ADDRESS) return;
    if (chainId !== ANVIL_CHAIN_ID) return;
    if (isSubmitting || isConfirming || isSuccess) return;

    attemptRef.current = true;
    handleSubmit();
  }, [
    chainId,
    handleSubmit,
    hasWon,
    isConnected,
    isConfirming,
    isSubmitting,
    isSuccess,
  ]);

  useEffect(() => {
    if (isSuccess) {
      // 触发全局刷新，让记录/排行榜等模块读取最新链上数据
      bumpChainRefresh();
    }
  }, [bumpChainRefresh, isSuccess]);

  const handleConnect = () => {
    audioManager.playSfx("click");
    const connector = connectors[0];
    if (connector) {
      connect({ connector });
    } else {
      setError("未检测到钱包");
    }
  };

  const handleRetry = () => {
    audioManager.playSfx("click");
    attemptRef.current = false;
    handleSubmit();
  };

  const handleReset = () => {
    audioManager.playSfx("click");
    newGame();
  };

  const handleReturnHome = () => {
    audioManager.playSfx("click");
    returnHome();
  };

  if (!hasWon) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-rose-950/25 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center text-rose-700 shadow-2xl">
        <p className="text-2xl font-semibold text-rose-600">完美通关</p>
        <p className="mt-2 text-sm text-rose-400">
          请签名并上传战绩后继续操作
        </p>

        <div className="mt-5 flex flex-col items-center gap-3">
          {!isConnected ? (
            <button
              type="button"
              onClick={handleConnect}
              className={`${secondaryButtonClass} w-full justify-center`}
            >
              {isConnecting ? "连接中…" : "连接钱包"}
            </button>
          ) : !LIGHTS_OUT_ADDRESS_VALID ? (
            <div className="text-xs text-rose-400">未配置合约地址</div>
          ) : chainId !== ANVIL_CHAIN_ID ? (
            <div className="text-xs text-rose-400">请切换到 Anvil (31337)</div>
          ) : isSuccess ? (
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleReset}
                className={`${primaryButtonClass} w-full justify-center`}
              >
                已上链，继续游戏
              </button>
              <button
                type="button"
                onClick={handleReturnHome}
                className={`${secondaryButtonClass} w-full justify-center`}
              >
                返回主页
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleRetry}
              disabled={isSubmitting || isConfirming}
              className={`${secondaryButtonClass} w-full justify-center ${
                isSubmitting || isConfirming ? "opacity-70" : ""
              }`}
            >
              {isSubmitting
                ? "等待签名…"
                : isConfirming
                  ? "链上确认中…"
                  : "重新签名并上链"}
            </button>
          )}

          {error && <p className="text-xs text-rose-400">{error}</p>}
        </div>
      </div>
    </div>
  );
};
