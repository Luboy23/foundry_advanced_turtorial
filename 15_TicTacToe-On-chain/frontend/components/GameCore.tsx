"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import GameList from "./GameList";
import GameBoard from "./GameBoard";
import GameStatus from "./GameStatus";
import GameResult from "./GameResult";
import GameHistoryPanel from "./GameHistoryPanel";
import LeaderboardPanel from "./LeaderboardPanel";
import RulesDialogContent from "./RulesDialogContent";
import { useGameStore } from "@/store/useGameStore";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useWatchContractEvent,
} from "wagmi";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Address } from "viem";

import { ContractConfig, getResolvedRuntimeConfig } from "@/constants";
import { PROJECT_NAME_EN, PROJECT_NAME_ZH } from "@/lib/projectBrand";
import {
  getProjectTonePanelClass,
  PROJECT_BODY_CLASS,
  PROJECT_TITLE_CLASS,
} from "@/lib/projectTheme";
import type {
  ContractEventLog,
  GameCancelledEventArgs,
  GameCreatedEventArgs,
  GameDrawnEventArgs,
  GameWonEventArgs,
  MoveMadeEventArgs,
  PlayerJoinedEventArgs,
} from "@/types/types";

const getContractEventArgs = <TArgs extends object>(
  log: unknown
): Partial<TArgs> => {
  if (!log || typeof log !== "object") {
    return {};
  }

  const args = (log as { args?: unknown }).args;
  if (!args || typeof args !== "object") {
    return {};
  }

  return args as Partial<TArgs>;
};

const logsContainGameId = <TArgs extends { gameId: bigint }>(
  logs: readonly ContractEventLog<TArgs>[],
  targetGameId?: bigint
) => {
  if (targetGameId === undefined) {
    return false;
  }

  return logs.some((log) => getContractEventArgs<TArgs>(log).gameId === targetGameId);
};

const logsContainAddress = <
  TArgs extends Record<TKey, Address>,
  TKey extends keyof TArgs,
>(
  logs: readonly ContractEventLog<TArgs>[],
  key: TKey,
  targetAddress?: Address
) => {
  if (!targetAddress) {
    return false;
  }

  return logs.some((log) => {
    const value = getContractEventArgs<TArgs>(log)[key];
    return typeof value === "string" && value.toLowerCase() === targetAddress.toLowerCase();
  });
};

// 游戏主容器：负责页面级状态编排、事件订阅与弹窗组合渲染。
export default function GameCore() {
  const {
    gameId,
    setShowGameList,
    showGameList,
    showHistoryDialog,
    showLeaderboardDialog,
    showRulesDialog,
    setShowHistoryDialog,
    setShowLeaderboardDialog,
    setShowRulesDialog,
    createGame,
    isLoading,
    autoDetectGame,
    refreshGameList,
    fetchMyHistory,
    fetchLeaderboard,
    fetchRulesMeta,
    historyPage,
    leaderboardPage,
    syncGameStatusFast,
    clearActionFeedback,
    setShowResult,
    gameStatus,
    cancelGame,
    resign,
    claimTimeoutWin,
    handleInviteGame,
    invalidateLeaderboardCache,
    activeAction,
    actionPhase,
    actionMessage,
    networkMismatch,
    setNetworkMismatch,
    playerAddress,
    restoredGameId,
    isAutoRestoringGame,
    setRestoredGameId,
  } = useGameStore();

  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain();
  const [mounted, setMounted] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const [inviteGameId, setInviteGameId] = useState<bigint | undefined>(undefined);
  const [confirmAction, setConfirmAction] = useState<
    "cancel" | "resign" | "timeout" | null
  >(null);
  const shownResultGameIdRef = useRef<bigint | undefined>(undefined);
  const inviteHandledKeyRef = useRef<string | undefined>(undefined);

  // 客户端挂载标记：用于规避 SSR 场景下的钱包状态抖动。
  useEffect(() => {
    setMounted(true);
  }, []);

  // 读取 URL 中的 gameId 参数，支持邀请链接直达。
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = new URLSearchParams(window.location.search).get("gameId");
    if (!raw || !/^\d+$/.test(raw)) return;
    try {
      setInviteGameId(BigInt(raw));
    } catch {
      setInviteGameId(undefined);
    }
  }, []);

  // 水合后的连接状态与地址，避免在未挂载时触发副作用。
  const hydratedIsConnected = mounted && isConnected;
  const hydratedAddress = mounted ? address : undefined;
  const runtimeChainId = getResolvedRuntimeConfig().chainId;
  const isRuntimeNetworkMismatch =
    hydratedIsConnected && chainId !== runtimeChainId;
  // 写操作闸门：任一网络不匹配条件成立都禁止链写。
  const blockWriteActions = networkMismatch || isRuntimeNetworkMismatch;
  const showHomeActionFeedback =
    gameId === undefined &&
    hydratedIsConnected &&
    (activeAction === "create" || activeAction === "join") &&
    actionPhase !== "idle" &&
    Boolean(actionMessage);
  const homeActionFeedbackTitle =
    actionPhase === "awaiting_signature"
      ? "等待签名"
      : actionPhase === "confirming"
        ? "链上确认中"
        : actionPhase === "success"
          ? "已完成"
          : "需要处理";
  const homeActionFeedbackTone =
    actionPhase === "success"
      ? "success"
      : actionPhase === "error"
        ? "danger"
        : "warning";

  // 判断某个动作是否处于签名中/确认中，用于按钮禁用与文案切换。
  const isActionPending = (action: typeof activeAction) =>
    activeAction === action &&
    (actionPhase === "awaiting_signature" || actionPhase === "confirming");

  // 统一动作按钮文案：根据动作阶段展示“待签名/确认中/完成/重试”。
  const resolveActionLabel = (
    action: typeof activeAction,
    idleText: string,
    awaitingText: string,
    confirmingText: string
  ) => {
    if (activeAction !== action) return idleText;
    if (actionPhase === "awaiting_signature") return awaitingText;
    if (actionPhase === "confirming") return confirmingText;
    if (actionPhase === "success") return `${idleText}（完成）`;
    if (actionPhase === "error") return `${idleText}（重试）`;
    return idleText;
  };

  // 切换网络动作：失败时保留只读能力并提示手动切换。
  const handleSwitchNetwork = async () => {
    try {
      await switchChainAsync({ chainId: runtimeChainId });
      toast.success("网络已切换");
    } catch {
      toast.error("切换网络失败，请在钱包中手动切换。");
    }
  };

  // 钱包连接后自动探测可继续对局，并同步玩家地址身份。
  useEffect(() => {
    if (hydratedIsConnected && hydratedAddress) {
      autoDetectGame(hydratedIsConnected, hydratedAddress);
    }
  }, [hydratedIsConnected, hydratedAddress, autoDetectGame]);

  // 将运行链校验结果同步写入 store，供全局组件统一使用。
  useEffect(() => {
    setNetworkMismatch(Boolean(isRuntimeNetworkMismatch));
  }, [isRuntimeNetworkMismatch, setNetworkMismatch]);

  // 邀请参数处理：同一地址 + 同一 gameId 只执行一次，防止重复跳转。
  useEffect(() => {
    if (!hydratedIsConnected || !hydratedAddress || inviteGameId === undefined) {
      return;
    }
    const key = `${hydratedAddress.toLowerCase()}-${inviteGameId.toString()}`;
    if (inviteHandledKeyRef.current === key) return;
    inviteHandledKeyRef.current = key;
    void handleInviteGame(inviteGameId, hydratedAddress);
  }, [hydratedIsConnected, hydratedAddress, inviteGameId, handleInviteGame]);

  // 页面可见性与轮询策略：页面退到后台后暂停主动刷新；
  // 回到前台时先恢复可见态，再让后续 effect 立即补拉当前局和大厅数据。
  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleVisibilityChange = () => {
      setIsPageVisible(document.visibilityState === "visible");
    };

    handleVisibilityChange();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // 活跃对局兜底轮询：仅进行中且页面可见时 1 秒同步一次。
  useEffect(() => {
    const shouldSyncActiveGame =
      hydratedIsConnected && gameId !== undefined && gameStatus?.state === 1;
    if (!shouldSyncActiveGame || !isPageVisible) return;

    void syncGameStatusFast();
    const timer = window.setInterval(() => {
      void syncGameStatusFast();
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [hydratedIsConnected, gameId, gameStatus?.state, isPageVisible, syncGameStatusFast]);

  // 对局大厅轮询：弹窗打开且页面可见时定期刷新列表。
  useEffect(() => {
    if (!showGameList || !hydratedIsConnected || !isPageVisible) return;

    void refreshGameList();
    const timer = window.setInterval(() => {
      void refreshGameList();
    }, 3000);

    return () => {
      window.clearInterval(timer);
    };
  }, [showGameList, hydratedIsConnected, isPageVisible, refreshGameList]);

  // 历史弹窗打开时按当前页拉取数据。
  useEffect(() => {
    if (!showHistoryDialog || !hydratedIsConnected) return;
    void fetchMyHistory(historyPage);
  }, [showHistoryDialog, hydratedIsConnected, fetchMyHistory, historyPage]);

  // 排行榜弹窗打开时按当前页拉取数据。
  useEffect(() => {
    if (!showLeaderboardDialog || !hydratedIsConnected) return;
    void fetchLeaderboard(leaderboardPage);
  }, [showLeaderboardDialog, hydratedIsConnected, fetchLeaderboard, leaderboardPage]);

  // 规则弹窗打开时读取链上规则元数据。
  useEffect(() => {
    if (!showRulesDialog) return;
    void fetchRulesMeta();
  }, [showRulesDialog, fetchRulesMeta]);

  // 对局结束时触发结算弹窗，且同一局只弹一次。
  useEffect(() => {
    if (gameId === undefined || !gameStatus) return;
    if (gameStatus.state < 2) return;
    if (shownResultGameIdRef.current === gameId) return;

    shownResultGameIdRef.current = gameId;
    setShowResult(true);
  }, [gameId, gameStatus, setShowResult]);

  // 返回首页后清理“已弹窗对局”记录，避免下一局被误拦截。
  useEffect(() => {
    if (gameId === undefined) {
      shownResultGameIdRef.current = undefined;
    }
  }, [gameId]);

  // 结算联动策略：结束事件统一走这里，先同步当前局与结果弹窗，
  // 再按需刷新历史、失效排行榜缓存，并在大厅可见时补刷新列表。
  const refreshGameListIfVisible = () => {
    if (showGameList && isPageVisible) {
      void refreshGameList();
    }
  };

  const runSettlementEffects = ({
    refreshHistory,
    refreshLeaderboard,
  }: {
    refreshHistory: boolean;
    refreshLeaderboard: boolean;
  }) => {
    void syncGameStatusFast();
    setShowResult(true);

    if (refreshHistory && showHistoryDialog) {
      void fetchMyHistory(historyPage);
    }

    if (refreshLeaderboard) {
      invalidateLeaderboardCache();
      if (showLeaderboardDialog) {
        void fetchLeaderboard(leaderboardPage, true);
      }
    }

    refreshGameListIfVisible();
  };

  // GameCreated 事件：刷新大厅并在命中当前关注对局时快速同步。
  useWatchContractEvent({
    ...ContractConfig,
    eventName: "GameCreated",
    onLogs(logs) {
      refreshGameListIfVisible();
      const typedLogs = logs as readonly ContractEventLog<GameCreatedEventArgs>[];
      const shouldRefresh =
        logsContainGameId<GameCreatedEventArgs>(typedLogs, gameId) ||
        logsContainAddress<GameCreatedEventArgs, "player1">(
          typedLogs,
          "player1",
          playerAddress
        );

      if (shouldRefresh) {
        void syncGameStatusFast();
      }
    },
  });

  // PlayerJoined 事件：命中当前局或我方参与时触发快速刷新。
  useWatchContractEvent({
    ...ContractConfig,
    eventName: "PlayerJoined",
    onLogs(logs) {
      refreshGameListIfVisible();
      const typedLogs = logs as readonly ContractEventLog<PlayerJoinedEventArgs>[];
      const shouldRefresh =
        logsContainGameId<PlayerJoinedEventArgs>(typedLogs, gameId) ||
        logsContainAddress<PlayerJoinedEventArgs, "player2">(
          typedLogs,
          "player2",
          playerAddress
        );

      if (shouldRefresh) {
        void syncGameStatusFast();
      }
    },
  });

  // MoveMade 事件：作为实时更新主通道，匹配当前对局即刻同步。
  useWatchContractEvent({
    ...ContractConfig,
    eventName: "MoveMade",
    onLogs(logs) {
      refreshGameListIfVisible();
      const typedLogs = logs as readonly ContractEventLog<MoveMadeEventArgs>[];
      if (logsContainGameId<MoveMadeEventArgs>(typedLogs, gameId)) {
        void syncGameStatusFast();
      }
    },
  });

  // GameWon 事件：刷新状态并联动历史/排行榜失效刷新。
  useWatchContractEvent({
    ...ContractConfig,
    eventName: "GameWon",
    onLogs(logs) {
      const typedLogs = logs as readonly ContractEventLog<GameWonEventArgs>[];
      if (logsContainGameId<GameWonEventArgs>(typedLogs, gameId)) {
        runSettlementEffects({
          refreshHistory: true,
          refreshLeaderboard: true,
        });
      }
    },
  });

  // GameDrawn 事件：结算行为与胜利事件保持一致。
  useWatchContractEvent({
    ...ContractConfig,
    eventName: "GameDrawn",
    onLogs(logs) {
      const typedLogs = logs as readonly ContractEventLog<GameDrawnEventArgs>[];
      if (logsContainGameId<GameDrawnEventArgs>(typedLogs, gameId)) {
        runSettlementEffects({
          refreshHistory: true,
          refreshLeaderboard: true,
        });
      }
    },
  });

  // GameCancelled 事件：触发本局状态同步并弹出结算结果。
  useWatchContractEvent({
    ...ContractConfig,
    eventName: "GameCancelled",
    onLogs(logs) {
      const typedLogs = logs as readonly ContractEventLog<GameCancelledEventArgs>[];
      if (logsContainGameId<GameCancelledEventArgs>(typedLogs, gameId)) {
        runSettlementEffects({
          refreshHistory: false,
          refreshLeaderboard: false,
        });
      }
    },
  });

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
      <Card className="w-full max-w-4xl border-primary/20 shadow-lg shadow-primary/5">
        <CardHeader className="gap-5 bg-card/50 border-b border-border/50">
          <div className="space-y-2 text-center">
            <CardTitle className="text-center text-primary text-2xl">
              {PROJECT_NAME_ZH}
            </CardTitle>
            <p className="text-xs uppercase tracking-[0.24em] text-primary/60">
              {PROJECT_NAME_EN}
            </p>
          </div>

          {restoredGameId !== undefined && (
            <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-primary">
                  已自动恢复你未结束的对局 #{restoredGameId.toString()}
                </p>
                <p className="text-sm text-muted-foreground">
                  你可以继续完成这一局，或关闭提示后自行浏览大厅。
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRestoredGameId(undefined)}
                className="self-start sm:self-auto"
              >
                知道了
              </Button>
            </div>
          )}

          {hydratedIsConnected && gameId === undefined && isAutoRestoringGame && activeAction === undefined && (
            <div
              className="rounded-xl border border-primary/15 bg-primary/[0.05] px-4 py-3 text-sm text-primary/80"
              role="status"
              aria-live="polite"
            >
              正在检查可继续对局...
            </div>
          )}

          <div className="w-full overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="mx-auto flex min-w-max items-center justify-center gap-3 px-1">
              {hydratedIsConnected && blockWriteActions && (
                <Button
                  variant="secondary"
                  onClick={handleSwitchNetwork}
                  disabled={isSwitchingChain}
                  className="shrink-0 px-5 py-2"
                >
                  {isSwitchingChain ? "切换中…" : "切换到本地测试链"}
                </Button>
              )}
              {hydratedIsConnected && gameId === undefined && !blockWriteActions && (
                <>
                  <Button
                    variant="default"
                    onClick={() => void createGame()}
                    disabled={isLoading}
                    className="shrink-0 px-5 py-2"
                  >
                    创建对局
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowGameList(true)}
                    className="shrink-0 px-5 py-2"
                  >
                    进入大厅
                  </Button>
                </>
              )}
              {hydratedIsConnected && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setShowHistoryDialog(true)}
                    className="shrink-0 px-5 py-2"
                  >
                    战绩记录
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowLeaderboardDialog(true)}
                    className="shrink-0 px-5 py-2"
                  >
                    排行榜
                  </Button>
                </>
              )}
              <Button
                variant="secondary"
                onClick={() => setShowRulesDialog(true)}
                className="shrink-0 px-5 py-2"
              >
                规则说明
              </Button>

              {gameId !== undefined && hydratedIsConnected && gameStatus && (
                <>
                  <div className="inline-flex shrink-0 items-center justify-center rounded-full border border-primary/80 bg-background px-5 py-2 text-sm font-semibold whitespace-nowrap text-primary shadow-sm">
                    当前对局 ID #{gameId.toString()}
                  </div>
                  {gameStatus.state === 0 &&
                    playerAddress &&
                    gameStatus.player1 &&
                    gameStatus.player1.toLowerCase() === playerAddress.toLowerCase() && (
                      <Button
                        variant="destructive"
                        disabled={
                          isLoading || blockWriteActions || isActionPending("cancel")
                        }
                        onClick={() => {
                          clearActionFeedback();
                          setConfirmAction("cancel");
                        }}
                        className="shrink-0 px-5 py-2"
                      >
                        {resolveActionLabel(
                          "cancel",
                          "取消对局",
                          "请在钱包确认取消",
                          "取消中…"
                        )}
                      </Button>
                    )}

                  {gameStatus.state === 1 &&
                    playerAddress &&
                    ((gameStatus.player1 &&
                      gameStatus.player1.toLowerCase() ===
                        playerAddress.toLowerCase()) ||
                      (gameStatus.player2 &&
                        gameStatus.player2.toLowerCase() ===
                          playerAddress.toLowerCase())) && (
                      <>
                        <Button
                          variant="outline"
                          disabled={
                            isLoading || blockWriteActions || isActionPending("resign")
                          }
                          onClick={() => {
                            clearActionFeedback();
                            setConfirmAction("resign");
                          }}
                          className="shrink-0 px-5 py-2"
                        >
                          {resolveActionLabel(
                            "resign",
                            "认输",
                            "请在钱包确认认输",
                            "认输中…"
                          )}
                        </Button>
                        {gameStatus.currentTurn &&
                          gameStatus.currentTurn.toLowerCase() !==
                            playerAddress.toLowerCase() && (
                            <Button
                              variant="secondary"
                              disabled={
                                isLoading ||
                                blockWriteActions ||
                                isActionPending("timeout")
                              }
                              onClick={() => {
                                clearActionFeedback();
                                setConfirmAction("timeout");
                              }}
                              className="shrink-0 px-5 py-2"
                            >
                              {resolveActionLabel(
                                "timeout",
                                "超时判胜",
                                "请在钱包确认判胜",
                                "判胜中…"
                              )}
                            </Button>
                          )}
                      </>
                    )}
                </>
              )}
            </div>
          </div>

          {showHomeActionFeedback && (
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${getProjectTonePanelClass(
                homeActionFeedbackTone
              )}`}
              role="status"
              aria-live="polite"
            >
              <p className={PROJECT_TITLE_CLASS}>{homeActionFeedbackTitle}</p>
              <p className={`mt-1 ${PROJECT_BODY_CLASS}`}>{actionMessage}</p>
            </div>
          )}
        </CardHeader>

        <CardContent className="p-0">
          <GameBoard />
        </CardContent>

      {gameId !== undefined && (
          <CardFooter className="p-0">
            <GameStatus />
          </CardFooter>
        )}
      </Card>

      <footer className="mt-6 flex w-full max-w-2xl items-center justify-center gap-3 px-4 text-[10px] text-primary/60 sm:text-xs">
        <span className="h-px w-10 bg-primary/20" />
        <div className="flex items-center gap-2 whitespace-nowrap uppercase tracking-[0.18em] text-primary/60">
          <span>© 2026 lllu_23 • TicTacToe-On-chain</span>
          <span className="h-1 w-1 rounded-full bg-primary/30" />
          <a
            href="https://github.com/Luboy23/foundry_advanced_turtorial"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary transition hover:text-primary/80"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 2C6.48 2 2 6.59 2 12.25c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.49 0-.24-.01-1.04-.01-1.88-2.78.62-3.37-1.21-3.37-1.21-.45-1.19-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.85.09-.67.35-1.12.64-1.38-2.22-.26-4.55-1.14-4.55-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.31.1-2.73 0 0 .84-.28 2.75 1.05A9.28 9.28 0 0 1 12 6.97c.85 0 1.7.12 2.5.36 1.9-1.33 2.74-1.05 2.74-1.05.55 1.42.2 2.47.1 2.73.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.8-4.57 5.05.36.32.68.94.68 1.9 0 1.38-.01 2.49-.01 2.83 0 .27.18.6.69.49A10.25 10.25 0 0 0 22 12.25C22 6.59 17.52 2 12 2Z" />
            </svg>
            GitHub
          </a>
        </div>
        <span className="h-px w-10 bg-primary/20" />
      </footer>

      <Dialog open={showGameList} onOpenChange={setShowGameList}>
        <DialogContent className="sm:max-w-[900px]">
          <DialogHeader>
            <DialogTitle>对局大厅</DialogTitle>
            <DialogDescription>
              浏览可加入或正在进行的对局。
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto">
            <GameList />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="sm:max-w-[980px]">
          <DialogHeader>
            <DialogTitle>战绩记录</DialogTitle>
            <DialogDescription>
              查看当前账户历史战绩（胜/平/负与分数变化）。
            </DialogDescription>
          </DialogHeader>
          <GameHistoryPanel />
        </DialogContent>
      </Dialog>

      <Dialog open={showLeaderboardDialog} onOpenChange={setShowLeaderboardDialog}>
        <DialogContent className="sm:max-w-[980px]">
          <DialogHeader>
            <DialogTitle>排行榜</DialogTitle>
            <DialogDescription>
              按总分与对局数展示有效玩家排名。
            </DialogDescription>
          </DialogHeader>
          <LeaderboardPanel />
        </DialogContent>
      </Dialog>

      <Dialog open={showRulesDialog} onOpenChange={setShowRulesDialog}>
        <DialogContent className="sm:max-w-[980px]">
          <DialogHeader>
            <DialogTitle>游戏规则</DialogTitle>
            <DialogDescription>
              快速查看玩法、计分与超时机制。
            </DialogDescription>
          </DialogHeader>
          <RulesDialogContent />
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>
              {confirmAction === "cancel"
                ? "确认取消本局？"
                : confirmAction === "resign"
                  ? "确认认输并结束本局？"
                  : "确认发起超时判胜？"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === "cancel"
                ? "取消后本局将直接结束，且不计入积分。"
                : confirmAction === "resign"
                  ? "认输后本局立即结束，对手获胜并计入战绩。"
                  : "若对手已超时未落子，你将直接获胜并计入战绩。"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmAction(null)}
              disabled={isLoading}
            >
              返回
            </Button>
            <Button
              variant={confirmAction === "cancel" ? "destructive" : "default"}
              disabled={isLoading || blockWriteActions}
              onClick={() => {
                const target = confirmAction;
                setConfirmAction(null);
                if (target === "cancel") {
                  void cancelGame();
                  return;
                }
                if (target === "resign") {
                  void resign();
                  return;
                }
                void claimTimeoutWin();
              }}
            >
              {confirmAction === "cancel"
                ? "确认取消"
                : confirmAction === "resign"
                  ? "确认认输"
                  : "确认判胜"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <GameResult />
    </div>
  );
}
