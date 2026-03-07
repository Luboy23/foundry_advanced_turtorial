"use client";

import { useGameStore } from "@/store/gameStore";
import { GameSolution } from "./GameSolution";

export const GameHintDock = () => {
  const showHint = useGameStore((state) => state.showHint);

  if (!showHint) {
    return null;
  }

  return (
    <aside className="hidden lg:block">
      <div className="fixed right-8 top-24 z-40 w-[220px]">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-white/95 p-3 shadow-xl shadow-rose-200/60">
          <div className="text-xs font-semibold uppercase tracking-[0.32em] text-rose-400">
            提示
          </div>
          <GameSolution />
        </div>
      </div>
    </aside>
  );
};
