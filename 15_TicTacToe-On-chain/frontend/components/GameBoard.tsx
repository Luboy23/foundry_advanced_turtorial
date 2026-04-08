import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Button } from "./ui/button";
import { useGameStore } from "@/store/useGameStore";
import {
  buildBoardOverlayMessage,
  isCurrentPlayerTurn,
} from "@/lib/gameUiState";

// 棋盘组件：负责渲染 3x3 网格与可落子交互。
export default function GameBoard() {
  const {
    board,
    gameId,
    gameStatus,
    makeMove,
    playerAddress,
    isLoading,
    networkMismatch,
  } = useGameStore();
  const { isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);

  // 仅在客户端挂载后启用交互，避免 SSR/CSR 状态不一致。
  useEffect(() => {
    setMounted(true);
  }, []);

  const hydratedIsConnected = mounted && isConnected;
  const overlayMessage = buildBoardOverlayMessage({
    isConnected: hydratedIsConnected,
    gameId,
    gameStatus,
  });
  const currentPlayerTurn = isCurrentPlayerTurn(gameStatus, playerAddress);
  
  // 统一落子闸门：连接态 + 对局态 + 回合态 + 网络态全部满足才可操作。
  const canMakeMove = 
    hydratedIsConnected && 
    gameId !== undefined && 
    gameStatus && 
    gameStatus.state === 1 && 
    currentPlayerTurn &&
    !isLoading &&
    !networkMismatch;

  // 单格点击处理：仅空位且可落子时才写链。
  const handleClick = (index: number) => {
    if (canMakeMove && board[index] === null) {
      makeMove(index);
    }
  };

  // 渲染单个格子：根据棋子状态切换样式，并输出可访问性标签。
  const renderSquare = (index: number) => {
    const row = Math.floor(index / 3) + 1;
    const col = (index % 3) + 1;
    const piece = board[index] ?? "空";
    const clickable = canMakeMove && board[index] === null;
    return (
      <Button
        key={index}
        variant={
          board[index]
            ? board[index] === "X"
              ? "default"
              : "destructive"
            : "outline"
        }
        size="lg"
        className={`h-20 w-20 text-4xl font-bold transition-all duration-200 sm:h-24 sm:w-24 sm:text-5xl ${
          clickable
            ? "border-primary/40 bg-background shadow-sm hover:scale-[1.03] hover:border-primary/60 hover:bg-primary/5 focus-visible:ring-2"
            : !board[index]
              ? "border-border/80 bg-background/90 text-muted-foreground"
              : ""
        } ${board[index] && " cursor-not-allowed disabled:opacity-100"}`}
        onClick={() => handleClick(index)}
        disabled={!canMakeMove || board[index] !== null}
        aria-label={`第${row}行第${col}列，当前${piece}，${
          clickable ? "可落子" : "不可落子"
        }`}
      >
        {board[index]}
      </Button>
    );
  };

  return (
    <div
      className={`relative p-4 sm:p-6 md:p-8 ${
        currentPlayerTurn
          ? "bg-primary/[0.05] shadow-[inset_0_0_0_1px_rgba(255,56,92,0.14)]"
          : "bg-card/30"
      }`}
    >
      {overlayMessage && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/10 backdrop-blur-[1px]">
          <div className="rounded-full border border-primary/15 bg-background/95 px-5 py-3 text-center text-base font-medium text-primary/80 shadow-lg sm:text-xl">
            {overlayMessage}
          </div>
        </div>
      )}
      <div
        className={`mx-auto grid w-fit grid-cols-[repeat(3,max-content)] gap-3 sm:gap-4 ${
          gameStatus?.state === 1 && !currentPlayerTurn ? "opacity-90" : ""
        }`}
      >
        {Array(9)
          .fill(null)
          .map((_, index) => renderSquare(index))}
      </div>
    </div>
  );
}
