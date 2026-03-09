"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";

import { audioManager } from "@/lib/audio";
import { useGameStore } from "@/store/gameStore";
import { primaryButtonClass } from "./buttonStyles";

interface GameCellProps {
  active: boolean;
  row: number;
  column: number;
  isHint: boolean;
  onToggle: (row: number, column: number) => void;
}

const GameCell = memo(
  ({ active, row, column, isHint, onToggle }: GameCellProps) => {
  // 单格组件使用 memo，减少整盘重渲染开销
  const handleClick = useCallback(() => {
    onToggle(row, column);
  }, [onToggle, row, column]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`aspect-square w-full rounded-2xl border border-rose-200/70 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/70 active:scale-95 active:shadow-inner touch-manipulation ${
        active
          ? "bg-rose-500 shadow-[0_10px_20px_rgba(244,63,94,0.28),inset_0_0_18px_rgba(255,255,255,0.22)] [transform:rotateY(180deg)]"
          : "bg-rose-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_4px_10px_rgba(244,63,94,0.08)]"
      } ${isHint ? "ring-2 ring-rose-400/80 ring-offset-2 ring-offset-white" : ""}`}
      aria-pressed={active}
      aria-label={`切换第 ${row + 1} 行第 ${column + 1} 列`}
    />
  );
});

GameCell.displayName = "GameCell";

export const GameField = () => {
  const grid = useGameStore((state) => state.grid.current);
  const hasWon = useGameStore((state) => state.hasWon);
  const showHint = useGameStore((state) => state.showHint);
  const solverStatus = useGameStore((state) => state.solverStatus);
  const solution = useGameStore((state) => state.solution);
  const toggleCell = useGameStore((state) => state.toggleCell);
  const hasManualStart = useGameStore((state) => state.hasManualStart);
  const isPaused = useGameStore((state) => state.isPaused);
  const pauseReasons = useGameStore((state) => state.pauseReasons);
  const resumeCountdown = useGameStore((state) => state.resumeCountdown);
  const newGame = useGameStore((state) => state.newGame);
  const resumeGame = useGameStore((state) => state.resumeGame);
  const setResumeCountdown = useGameStore(
    (state) => state.setResumeCountdown,
  );
  const { isConnected } = useAccount();
  const [viewportHeight, setViewportHeight] = useState(900);
  const gridSize = grid.length;
  const hintMove =
    showHint && solverStatus === "idle" ? solution[0] : undefined;
  const baseCell = gridSize <= 4 ? 100 : gridSize === 5 ? 84 : 72;
  // 联合“棋盘尺寸 + 视口高度”限制最大宽度，确保常见桌面高度下一屏可见
  const boardMaxWidth = Math.min(
    540,
    gridSize * baseCell,
    Math.max(300, viewportHeight * 0.44),
  );
  const handleToggle = useCallback(
    (row: number, column: number) => {
      // 锁定未连接、未开始、暂停中三种状态，避免非法操作
      if (!isConnected || !hasManualStart || isPaused) return;
      audioManager.playSfx("toggle");
      toggleCell(row, column);
    },
    [hasManualStart, isConnected, isPaused, toggleCell],
  );

  useEffect(() => {
    const syncViewportHeight = () => {
      setViewportHeight(window.innerHeight);
    };
    syncViewportHeight();
    window.addEventListener("resize", syncViewportHeight);
    return () => {
      window.removeEventListener("resize", syncViewportHeight);
    };
  }, []);

  useEffect(() => {
    if (hasWon) {
      audioManager.playSfx("win");
    }
  }, [hasWon]);

  const isCountdownOnly =
    pauseReasons.length === 1 && pauseReasons[0] === "countdown";

  useEffect(() => {
    // 倒计时音效与 UI 数字同步，提升反馈一致性
    if (!isCountdownOnly) return;
    if (resumeCountdown === 3 || resumeCountdown === 2) {
      audioManager.playSfx("countdown");
    }
    if (resumeCountdown === 1) {
      audioManager.playSfx("ready");
    }
  }, [isCountdownOnly, resumeCountdown]);

  useEffect(() => {
    // 倒计时每秒递减 1
    if (!isCountdownOnly || resumeCountdown <= 0) return;
    const timerId = window.setTimeout(() => {
      setResumeCountdown(resumeCountdown - 1);
    }, 1000);
    return () => window.clearTimeout(timerId);
  }, [isCountdownOnly, resumeCountdown, setResumeCountdown]);

  useEffect(() => {
    // 倒计时结束后恢复游戏
    if (resumeCountdown !== 0) return;
    if (!isCountdownOnly) return;
    resumeGame("countdown");
  }, [isCountdownOnly, resumeCountdown, resumeGame]);

  const showStartOverlay = !hasManualStart && !hasWon;
  const showCountdownOverlay = resumeCountdown > 0;
  const showPauseOverlay =
    isPaused && !showCountdownOverlay && hasManualStart && !hasWon;

  return (
    <div className="relative flex flex-col rounded-2xl border border-rose-200 bg-white p-3 shadow-lg shadow-rose-200/60 sm:p-4 md:p-3">
      <div
        className="mx-auto grid w-full gap-2 sm:gap-3"
        style={{
          gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
          maxWidth: `${boardMaxWidth}px`,
        }}
      >
        {grid.map((row, rowIdx) =>
          row.map((cell, cellIdx) => (
            <GameCell
              key={`game-cell-${rowIdx}-${cellIdx}`}
              active={cell}
              row={rowIdx}
              column={cellIdx}
              isHint={
                !!hintMove &&
                hintMove.row === rowIdx &&
                hintMove.column === cellIdx
              }
              onToggle={handleToggle}
            />
          )),
        )}
      </div>

      {hasWon && (
        <div className="absolute inset-0 rounded-2xl bg-white/60 backdrop-blur-sm" />
      )}

      {showStartOverlay && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-rose-950/20 px-4 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-2xl border border-rose-200 bg-white/95 p-4 text-center text-rose-600 shadow-2xl">
            <p className="text-lg font-semibold text-rose-600">准备开始</p>
            <p className="mt-1 text-xs text-rose-400">
              点击开始游戏进入对局
            </p>
            <button
              type="button"
              onClick={() => {
                audioManager.playSfx("click");
                if (!isConnected) return;
                newGame();
              }}
              className={`${primaryButtonClass} mt-4 w-full justify-center ${
                !isConnected ? "cursor-not-allowed opacity-70" : ""
              }`}
              disabled={!isConnected}
            >
              开始游戏
            </button>
          </div>
        </div>
      )}

      {showPauseOverlay && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-rose-950/20 px-4 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-2xl border border-rose-200 bg-white/95 p-4 text-center text-rose-600 shadow-2xl">
            <p className="text-lg font-semibold text-rose-600">已暂停</p>
            <p className="mt-1 text-xs text-rose-400">
              请关闭弹窗或返回游戏继续
            </p>
          </div>
        </div>
      )}

      {showCountdownOverlay && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-rose-950/20 px-4 backdrop-blur-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-rose-100 bg-white/95 text-3xl font-semibold text-rose-600 shadow-lg shadow-rose-200/50 sm:h-24 sm:w-24 sm:text-4xl">
            {resumeCountdown}
          </div>
        </div>
      )}
    </div>
  );
};
