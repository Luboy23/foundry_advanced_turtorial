"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useConnect, useDisconnect, useChainId } from "wagmi";

import { audioManager } from "@/lib/audio";
import { GRID_OPTIONS, useGameStore } from "@/store/gameStore";

const ANVIL_CHAIN_ID = 31337;

const shortAddress = (address?: string) =>
  address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "未连接";

const WalletStatus = () => {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();

  const handleConnect = () => {
    audioManager.playSfx("click");
    const connector = connectors[0];
    if (connector) {
      connect({ connector });
    }
  };

  const handleDisconnect = () => {
    audioManager.playSfx("click");
    disconnect();
  };

  const statusContent = (
    <>
      <span className="text-rose-400">{shortAddress(address)}</span>
      <span className="hidden h-1 w-1 rounded-full bg-rose-200/70 sm:inline-block" />
      <span className="text-[10px] uppercase tracking-[0.24em] text-rose-400">
        {chainId === ANVIL_CHAIN_ID ? "Anvil" : "Wrong"}
      </span>
      {isConnected ? (
        <button
          type="button"
          onClick={handleDisconnect}
          className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-500 transition hover:bg-rose-100"
        >
          断开
        </button>
      ) : (
        <button
          type="button"
          onClick={handleConnect}
          className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-500 transition hover:bg-rose-100"
        >
          {isPending ? "连接中…" : "连接钱包"}
        </button>
      )}
    </>
  );

  return (
    <>
      <div className="fixed right-4 top-4 z-[60] hidden flex-wrap items-center justify-end gap-2 rounded-2xl border border-rose-200 bg-white/95 px-3 py-2 text-xs font-semibold text-rose-600 shadow-lg shadow-rose-200/40 backdrop-blur lg:flex">
        {statusContent}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-rose-200 bg-white/95 px-3 py-2 text-[11px] font-semibold text-rose-600 shadow-sm shadow-rose-200/30 lg:hidden">
        {statusContent}
      </div>
    </>
  );
};

export const GameHeader = () => {
  const movesCount = useGameStore((state) => state.movesCount);
  const gridSize = useGameStore((state) => state.settings.gridSize);
  const hasManualStart = useGameStore((state) => state.hasManualStart);
  const hasWon = useGameStore((state) => state.hasWon);
  const lastResult = useGameStore((state) => state.lastResult);
  const startedAt = useGameStore((state) => state.startedAt);
  const isPaused = useGameStore((state) => state.isPaused);
  const pausedAt = useGameStore((state) => state.pausedAt);
  const pausedTotalMs = useGameStore((state) => state.pausedTotalMs);
  const [nowTick, setNowTick] = useState(0);
  const difficultyLabel =
    GRID_OPTIONS.find((option) => option.size === gridSize)?.label ?? "标准";

  useEffect(() => {
    if (!hasManualStart || hasWon) return;
    const intervalId = window.setInterval(() => {
      setNowTick(Date.now());
    }, 500);
    return () => window.clearInterval(intervalId);
  }, [hasManualStart, hasWon]);

  const elapsedMs = useMemo(() => {
    if (!hasManualStart) return 0;
    if (hasWon && lastResult?.durationMs) return lastResult.durationMs;

    const now = nowTick > 0 ? nowTick : startedAt;
    const pauseMs =
      pausedTotalMs + (isPaused ? Math.max(0, now - pausedAt) : 0);
    return Math.max(0, now - startedAt - pauseMs);
  }, [
    hasManualStart,
    hasWon,
    isPaused,
    lastResult?.durationMs,
    nowTick,
    pausedAt,
    pausedTotalMs,
    startedAt,
  ]);

  const formatDuration = (durationMs: number) => {
    const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="pb-3 md:pb-4">
      <WalletStatus />
      <div className="mt-2 flex flex-col gap-3 sm:mt-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="relative inline-flex items-center">
            <h1 className="text-2xl font-semibold tracking-tight text-rose-700 sm:text-3xl lg:text-4xl">
              关灯游戏
            </h1>
            <span className="absolute -right-3 top-0 -translate-y-[64%] translate-x-3 skew-x-[-12deg] rounded-md bg-rose-500 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-white shadow-sm shadow-rose-500/30 sm:-right-6 sm:-translate-y-[70%] sm:translate-x-4 sm:px-2 sm:text-[9px] lg:-right-10 lg:translate-x-6 lg:px-2.5 lg:text-[10px]">
              On-chain
            </span>
          </div>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-rose-500 sm:text-xs sm:tracking-[0.3em]">
            Lights Out
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
          <div className="flex items-center gap-2 rounded-full border border-rose-200 bg-rose-500/10 px-3 py-1.5 text-rose-700 shadow-sm">
            <span className="text-[10px] uppercase tracking-[0.24em] text-rose-500">
              步数
            </span>
            <span className="text-xl font-semibold leading-none text-rose-600">
              {movesCount}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <div
              className={`rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold shadow-sm ${
                hasManualStart
                  ? "bg-white text-rose-500"
                  : "bg-white/70 text-rose-400"
              }`}
            >
              时长 · {formatDuration(elapsedMs)}
            </div>
            <div className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-500 shadow-sm">
              难度 · {difficultyLabel}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
