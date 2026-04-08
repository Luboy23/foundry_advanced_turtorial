"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Address, zeroAddress } from "viem";

import InlineCopyButton from "@/components/InlineCopyButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getResolvedRuntimeConfig } from "@/constants";
import { getAddressExplorerUrl } from "@/lib/explorer";
import { cn } from "@/lib/utils";
import { useGameStore } from "@/store/useGameStore";

type GamePlayers = {
  player1: Address;
  player2: Address;
};

const formatAddress = (value: Address) =>
  value === zeroAddress ? "等待玩家加入..." : `${value.slice(0, 6)}...${value.slice(-4)}`;

// 对局大厅：展示可加入/继续的对局，并兼顾桌面表格与移动端卡片。
export default function GameList() {
  const { isConnected, address } = useAccount();
  const [mounted, setMounted] = useState(false);
  const {
    gameList,
    continueGame,
    joinGame,
    createGame,
    refreshGameList,
    isLoading,
    isGameListLoading,
    activeAction,
    actionPhase,
    highlightedGameId,
    networkMismatch,
    playerAddress,
    smartAccountAddress,
  } = useGameStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  const hydratedIsConnected = mounted && isConnected;
  const hydratedAddress = mounted ? address : undefined;
  const runtimeChainId = getResolvedRuntimeConfig().chainId;
  const isJoining =
    activeAction === "join" &&
    (actionPhase === "awaiting_signature" || actionPhase === "confirming");

  // “我方”判定同时覆盖 EOA、当前局玩家地址以及会话智能账户地址，
  // 这样大厅在不同签名模式下都能稳定识别“与我相关”的对局。
  const isMine = useCallback(
    (value: Address) => {
      const normalized = value.toLowerCase();
      return (
        (hydratedAddress && normalized === hydratedAddress.toLowerCase()) ||
        (playerAddress && normalized === playerAddress.toLowerCase()) ||
        (smartAccountAddress && normalized === smartAccountAddress.toLowerCase())
      );
    },
    [hydratedAddress, playerAddress, smartAccountAddress]
  );
  const actionableGames = gameList.filter((game) => {
    if (game.state >= 2) return false;
    return game.state === 0 || isMine(game.player1) || isMine(game.player2);
  });

  const getStatusBadge = useCallback((state: number) => {
    if (state === 0) return <Badge variant="secondary">等待加入</Badge>;
    if (state === 1) return <Badge variant="default">进行中</Badge>;
    return <Badge variant="destructive">已结束</Badge>;
  }, []);

  const getRoleBadge = useCallback(
    (game: GamePlayers, value: Address) => {
      if (value === zeroAddress) {
        return (
          <Badge variant="outline" className="border-dashed">
            空位
          </Badge>
        );
      }
      const hasMineInGame = isMine(game.player1) || isMine(game.player2);
      if (!hasMineInGame) return null;
      return isMine(value) ? (
        <Badge className="h-5 px-1.5">我方</Badge>
      ) : (
        <Badge variant="outline" className="h-5 border-primary/40 text-primary">
          对手
        </Badge>
      );
    },
    [isMine]
  );

  const renderPlayerMeta = useCallback(
    (game: GamePlayers, value: Address) => {
      if (value === zeroAddress) {
        return <span className="text-sm text-muted-foreground">等待玩家加入...</span>;
      }
      const explorerUrl = getAddressExplorerUrl(runtimeChainId, value);
      return (
        <div className="space-y-1.5">
          <div className="inline-flex flex-wrap items-center gap-2">
            <span className="font-medium" title={value}>
              {formatAddress(value)}
            </span>
            <InlineCopyButton
              value={value}
              successText="地址已复制"
              idleLabel="复制"
              copiedLabel="已复制"
              variant="outline"
              size="sm"
              className="h-6 rounded-full px-2.5 text-[11px] font-semibold leading-none"
            />
            {getRoleBadge(game, value)}
          </div>
          <div className="inline-flex items-center gap-2 text-xs">
            {explorerUrl && (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                查看链上
              </a>
            )}
          </div>
        </div>
      );
    },
    [getRoleBadge, runtimeChainId]
  );

  const renderAction = useCallback(
    (game: (GamePlayers & { id: bigint; state: number })) => {
      const isRelated = isMine(game.player1) || isMine(game.player2);
      if (isRelated) {
        return (
          <Button variant="outline" size="sm" onClick={() => continueGame(game.id)}>
            继续对局
          </Button>
        );
      }
      if (game.state === 0) {
        return (
          <Button
            variant="default"
            size="sm"
            onClick={() => joinGame(game.id)}
            disabled={isLoading || networkMismatch || isJoining}
          >
            {isJoining
              ? actionPhase === "awaiting_signature"
                ? "请在钱包确认加入"
                : "加入中…"
              : "加入对局"}
          </Button>
        );
      }
      return null;
    },
    [actionPhase, continueGame, isJoining, isLoading, isMine, joinGame, networkMismatch]
  );

  // 邀请高亮依赖对应行已经渲染出来，因此把滚动放在列表变更之后执行。
  useEffect(() => {
    if (highlightedGameId === undefined || typeof document === "undefined") return;
    const row = document.getElementById(`game-row-${highlightedGameId.toString()}`);
    row?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightedGameId, actionableGames.length]);

  return (
    <div className="mx-auto w-full max-w-4xl p-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-center text-2xl font-bold sm:text-left">
                对局大厅
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                选择继续自己的对局，或加入仍在等待玩家的公开对战。
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refreshGameList()}
              disabled={isGameListLoading}
              className="w-full sm:w-auto"
            >
              {isGameListLoading ? "刷新中…" : "刷新列表"}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {!hydratedIsConnected ? (
            <div className="py-8 text-center text-muted-foreground">
              请先连接钱包以查看对局大厅
            </div>
          ) : isGameListLoading && actionableGames.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              正在刷新对局列表...
            </div>
          ) : actionableGames.length === 0 ? (
            <div className="space-y-3 py-8 text-center text-muted-foreground">
              <p>当前暂无与你相关或可加入的对局</p>
              <div className="flex flex-col justify-center gap-2 sm:flex-row">
                <Button
                  variant="default"
                  onClick={() => void createGame()}
                  disabled={isLoading || networkMismatch}
                  className="w-full sm:w-auto"
                >
                  创建对局
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void refreshGameList()}
                  disabled={isGameListLoading}
                  className="w-full sm:w-auto"
                >
                  刷新列表
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">对局</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>玩家 1</TableHead>
                      <TableHead>玩家 2</TableHead>
                      <TableHead className="w-[160px]">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {actionableGames.map((game) => {
                      const highlight =
                        highlightedGameId !== undefined && highlightedGameId === game.id;
                      const isRelated = isMine(game.player1) || isMine(game.player2);
                      return (
                        <TableRow
                          key={game.id.toString()}
                          id={`game-row-${game.id.toString()}`}
                          className={cn(
                            highlight && "bg-primary/10 ring-1 ring-primary/30"
                          )}
                        >
                          <TableCell className="space-y-2">
                            <div className="font-medium">#{game.id.toString()}</div>
                            {highlight && <Badge className="h-5 px-1.5">邀请目标</Badge>}
                            {isRelated && (
                              <Badge variant="outline" className="border-primary/40 text-primary">
                                与我相关
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-2">
                              {getStatusBadge(game.state)}
                              {game.player2 === zeroAddress && (
                                <p className="text-xs text-muted-foreground">等待第二位玩家加入</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{renderPlayerMeta(game, game.player1)}</TableCell>
                          <TableCell>{renderPlayerMeta(game, game.player2)}</TableCell>
                          <TableCell>{renderAction(game)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-3 md:hidden">
                {actionableGames.map((game) => {
                  const highlight =
                    highlightedGameId !== undefined && highlightedGameId === game.id;
                  const isRelated = isMine(game.player1) || isMine(game.player2);
                  return (
                    <div
                      key={game.id.toString()}
                      id={`game-row-${game.id.toString()}`}
                      className={cn(
                        "rounded-2xl border bg-background/90 p-4 shadow-sm",
                        highlight && "border-primary/40 bg-primary/5"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base font-semibold">
                              对局 #{game.id.toString()}
                            </span>
                            {getStatusBadge(game.state)}
                            {highlight && <Badge className="h-5 px-1.5">邀请目标</Badge>}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {isRelated && (
                              <Badge
                                variant="outline"
                                className="border-primary/40 text-primary"
                              >
                                与我相关
                              </Badge>
                            )}
                            {game.player2 === zeroAddress && (
                              <Badge variant="outline">等待加入</Badge>
                            )}
                          </div>
                        </div>
                        {renderAction(game)}
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border bg-muted/30 p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            玩家 1
                          </p>
                          <div className="mt-2">{renderPlayerMeta(game, game.player1)}</div>
                        </div>
                        <div className="rounded-xl border bg-muted/30 p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            玩家 2
                          </p>
                          <div className="mt-2">{renderPlayerMeta(game, game.player2)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>

        <CardFooter>
          <span className="w-full text-center font-medium text-muted-foreground">
            当前可参与对局：
            <span className="font-extrabold text-primary">{actionableGames.length} </span>
            局
          </span>
        </CardFooter>
      </Card>
    </div>
  );
}
