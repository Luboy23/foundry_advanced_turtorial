"use client";

import { useGameStore } from "@/store/gameStore";
import { GameField } from "./GameField";
import { GameSolution } from "./GameSolution";

export const GameBoard = () => {
  const showHint = useGameStore((state) => state.showHint);

  return (
    // 提示区：桌面放在棋盘右侧，移动端保持在棋盘下方
    <div className="mt-3 md:mt-3">
      <div
        className={`flex flex-col ${
          showHint ? "lg:flex-row lg:items-start lg:justify-center lg:gap-4" : ""
        }`}
      >
        <div className={showHint ? "lg:min-w-0 lg:flex-1" : ""}>
          <GameField />
        </div>
        {showHint && (
          <div className="mt-3 rounded-2xl border border-rose-200 bg-white/90 p-3 shadow-sm md:mt-2 lg:mt-0 lg:w-[220px] lg:shrink-0">
            <div className="flex flex-col items-center gap-2.5">
              <div className="text-xs font-semibold uppercase tracking-[0.32em] text-rose-400">
                提示
              </div>
              <GameSolution />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
