"use client";

import { useGameStore } from "@/store/gameStore";

export const GameSolution = () => {
  const solution = useGameStore((state) => state.solution);
  const solverStatus = useGameStore((state) => state.solverStatus);
  const gridSize = useGameStore((state) => state.settings.gridSize);
  const nextMove = solution[0];

  if (solverStatus === "computing") {
    return (
      <p className="text-xs font-semibold text-rose-400">提示计算中…</p>
    );
  }

  if (!nextMove) {
    return <p className="text-xs font-semibold text-rose-400">暂无提示</p>;
  }

  return (
    <div className="flex flex-col items-center gap-2 opacity-90">
      <div
        className="grid gap-1.5 rounded-xl border border-rose-200 bg-white/80 p-3 shadow-sm"
        style={{
          gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: gridSize * gridSize }).map((_, index) => {
          const rowIdx = Math.floor(index / gridSize);
          const cellIdx = index % gridSize;
          const isNext = nextMove.row === rowIdx && nextMove.column === cellIdx;
          return (
            <div
              className={`aspect-square w-6 rounded-md border border-rose-200 bg-rose-100 sm:w-7 ${
                isNext
                  ? "border-rose-500 bg-rose-400 shadow-[0_0_6px_rgba(244,63,94,0.65)]"
                  : ""
              }`}
              key={`solution-cell-${rowIdx}-${cellIdx}`}
            />
          );
        })}
      </div>
      <p className="text-xs font-semibold text-rose-500">
        建议点击第 {nextMove.row + 1} 行第 {nextMove.column + 1} 列
      </p>
    </div>
  );
};
