"use client";

import { useGameStore } from "@/store/gameStore";
import { GameField } from "./GameField";
import { GameSolution } from "./GameSolution";

export const GameBoard = () => {
  const showHint = useGameStore((state) => state.showHint);

  return (
    // 桌面端提示固定在右侧 dock，移动端在棋盘下方补一个内联提示面板
    <div className="mt-6">
      <GameField />
      {showHint && (
        <div className="mt-6 lg:hidden">
          <div className="flex flex-col items-center gap-3">
            <div className="text-xs font-semibold uppercase tracking-[0.32em] text-rose-400">
              提示
            </div>
            <GameSolution />
          </div>
        </div>
      )}
    </div>
  );
};
