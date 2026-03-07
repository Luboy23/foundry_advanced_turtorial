"use client";

import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import type { Tile as TileModel } from "@/models/tile";
import Tile from "./tile";
import { GameContext } from "@/context/game-context";
import Splash from "./splash";

const GRID_SIZE = 4;

export default function Board() {
  const { getTiles, moveTiles, startGame, status, submissionRequired, isReady } =
    useContext(GameContext);
  const { isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // 仅在“钱包已连接 + 对局已开始”时响应键盘输入。
      if (!isConnected || !isReady) {
        return;
      }
      const key = event.key;
      if (
        key !== "ArrowUp" &&
        key !== "ArrowDown" &&
        key !== "ArrowLeft" &&
        key !== "ArrowRight"
      ) {
        return;
      }

      event.preventDefault();

      if (key === "ArrowUp") {
        moveTiles("up");
      } else if (key === "ArrowDown") {
        moveTiles("down");
      } else if (key === "ArrowLeft") {
        moveTiles("left");
      } else if (key === "ArrowRight") {
        moveTiles("right");
      }
    },
    [isConnected, isReady, moveTiles]
  );

  const handleGoHome = useCallback(() => {
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  }, []);

  useEffect(() => {
    if (!initialized.current && mounted && isConnected) {
      initialized.current = true;
    }
  }, [isConnected, mounted, startGame]);

  useEffect(() => {
    // 统一在 window 级别监听方向键，保证焦点不在棋盘上时也能操作。
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  const tiles = getTiles();
  const tilesByPosition = new Map<string, TileModel>();
  // 采用固定 4x4 网格渲染，tile 通过 row-col 键映射到对应格子。
  tiles.forEach((tile) => {
    tilesByPosition.set(`${tile.row}-${tile.col}`, tile);
  });

  const renderGrid = () =>
    Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, index) => (
      <div
        key={`grid-${index}`}
        className="w-full h-full rounded bg-[var(--cell-background)]"
      />
    ));

  const renderTiles = () =>
    Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, index) => {
      const row = Math.floor(index / GRID_SIZE);
      const col = index % GRID_SIZE;
      const tile = tilesByPosition.get(`${row}-${col}`);

      return (
        <div key={`tile-${row}-${col}`} className="w-full h-full">
          {tile ? <Tile tile={tile} /> : null}
        </div>
      );
    });

  return (
    <div className="relative w-[296px] h-[296px] md:w-[480px] md:h-[480px]">
      {/* 覆盖层用于承载“未连接 / 准备开始 / 通关 / 失败”等业务状态提示。 */}
      {mounted && !isConnected && (
        <Splash
          heading="请连接钱包"
          subtext="连接后即可开始游戏并体验链上提交"
          actionLabel="等待钱包连接"
          actionDisabled
        />
      )}
      {mounted && isConnected && !isReady && (
        <Splash
          heading="准备就绪"
          subtext="点击开始进入游戏"
          actionLabel="开始游戏"
        />
      )}
      {status === "won" && (
        <Splash
          heading="游戏通关"
          type="won"
          subtext={
            submissionRequired
              ? "正在请求签名并提交成绩"
              : "记录已成功上链"
          }
          actionLabel={submissionRequired ? "请在钱包中确认签名" : undefined}
          actionDisabled={submissionRequired}
          secondaryActionLabel="返回初始界面"
          secondaryActionDisabled={submissionRequired}
          onSecondaryAction={handleGoHome}
        />
      )}
      {status === "lost" && (
        <Splash
          heading="游戏结束"
          subtext={
            submissionRequired
              ? "正在请求签名并提交成绩"
              : "记录已成功上链"
          }
          actionLabel={submissionRequired ? "请在钱包中确认签名" : undefined}
          actionDisabled={submissionRequired}
          secondaryActionLabel="返回初始界面"
          secondaryActionDisabled={submissionRequired}
          onSecondaryAction={handleGoHome}
        />
      )}

      <div className="absolute inset-0 z-[2] grid grid-cols-4 grid-rows-4 gap-1 md:gap-2 p-1 md:p-2">
        {renderTiles()}
      </div>

      <div className="w-full h-full grid grid-cols-4 grid-rows-4 gap-1 md:gap-2 bg-[var(--secondary-background)] p-1 md:p-2 border border-[var(--secondary-background)] rounded-lg">
        {renderGrid()}
      </div>
    </div>
  );
}
