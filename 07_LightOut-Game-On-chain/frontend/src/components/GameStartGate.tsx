"use client";

import { useEffect } from "react";
import { useAccount, useConnect } from "wagmi";

import { audioManager } from "@/lib/audio";
import { useGameStore } from "@/store/gameStore";
import { secondaryButtonClass } from "./buttonStyles";

export const GameStartGate = () => {
  const { isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const pauseGame = useGameStore((state) => state.pauseGame);
  const resumeGame = useGameStore((state) => state.resumeGame);

  useEffect(() => {
    // 钱包连接状态与游戏暂停状态联动：
    // 未连接时强制暂停，连接后解除 wallet 暂停源
    if (!isConnected) {
      pauseGame("wallet");
    } else {
      resumeGame("wallet");
    }
  }, [isConnected, pauseGame, resumeGame]);

  if (isConnected) return null;

  const handleConnect = () => {
    audioManager.playSfx("click");
    // 默认使用首个可用连接器（本地教学场景通常为 injected 钱包）
    const connector = connectors[0];
    if (connector) {
      connect({ connector });
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-rose-950/25 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center text-rose-700 shadow-2xl">
        <p className="text-2xl font-semibold text-rose-600">连接钱包开始游戏</p>
        <p className="mt-2 text-sm text-rose-400">
          请先连接钱包，才能开始对局
        </p>
        <div className="mt-5 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={handleConnect}
            className={`${secondaryButtonClass} w-full justify-center`}
          >
            {isPending ? "连接中…" : "连接钱包"}
          </button>
        </div>
      </div>
    </div>
  );
};
