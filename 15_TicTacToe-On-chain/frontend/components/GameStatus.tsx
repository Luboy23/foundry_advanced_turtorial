import { useEffect, useMemo, useState } from "react";
import { useAccount, useChainId } from "wagmi";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import InlineCopyButton from "@/components/InlineCopyButton";
import { getResolvedRuntimeConfig } from "@/constants";
import {
  buildGameSummaryItems,
  buildStatusBanner,
  getRemainingTurnSeconds,
  isTimeoutClaimable,
} from "@/lib/gameUiState";
import {
  getProjectToneCardClass,
  getProjectTonePanelClass,
  PROJECT_BODY_CLASS,
  PROJECT_LABEL_CLASS,
  PROJECT_TITLE_CLASS,
  PROJECT_VALUE_CLASS,
} from "@/lib/projectTheme";
import { useGameStore } from "@/store/useGameStore";

// 状态面板：统一展示主状态、摘要信息、邀请动作与超时操作。
export default function GameStatus() {
  const {
    gameStatus,
    gameId,
    playerAddress,
    activeAction,
    actionPhase,
    actionMessage,
    networkMismatch,
    rulesMeta,
    claimTimeoutWin,
    isLoading,
  } = useGameStore();
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const runtimeChainId = getResolvedRuntimeConfig().chainId;
  const [nowSeconds, setNowSeconds] = useState(() =>
    Math.floor(Date.now() / 1000)
  );

  // 仅在进行中对局维护秒级倒计时，避免等待态或结束态长期持有无意义的定时器。
  useEffect(() => {
    if (!gameStatus || gameStatus.state !== 1) return;
    const timer = window.setInterval(() => {
      setNowSeconds(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [gameStatus]);

  const remainingTurnSeconds = useMemo(
    () => getRemainingTurnSeconds(gameStatus, nowSeconds),
    [gameStatus, nowSeconds]
  );
  const timeoutReady = isTimeoutClaimable({
    gameStatus,
    playerAddress,
    remainingTurnSeconds,
  });
  const statusBanner = buildStatusBanner({
    isConnected,
    gameStatus,
    playerAddress,
    networkMismatch,
    rulesMeta,
    runtimeChainId,
    chainId,
  });
  const summaryItems = buildGameSummaryItems({
    isConnected,
    gameId: gameId!,
    gameStatus,
    playerAddress,
    networkMismatch,
    runtimeChainId,
    chainId,
    rulesMeta,
  });

  // 邀请链接必须基于浏览器当前 URL 生成；SSR 阶段返回空串以避免水合不一致。
  const inviteLink = useMemo(() => {
    if (gameId === undefined || typeof window === "undefined") return "";
    const url = new URL(window.location.href);
    url.searchParams.set("gameId", gameId.toString());
    return url.toString();
  }, [gameId]);
  const isWaitingInvite = gameStatus?.state === 0 && gameId !== undefined;

  return (
    <div className="w-full border-t border-border/50 bg-card/50 px-4 py-6 sm:px-6">
      <div className="space-y-4">
        <div
          className={`rounded-2xl border px-5 py-4 ${getProjectTonePanelClass(
            statusBanner.tone
          )}`}
          role="status"
          aria-live="polite"
        >
          <p className={`text-lg ${PROJECT_TITLE_CLASS}`}>{statusBanner.title}</p>
          <p className={`mt-1 text-sm leading-6 ${PROJECT_BODY_CLASS}`}>
            {statusBanner.description}
          </p>
          {timeoutReady && (
            <div className="mt-4">
              <Button
                size="sm"
                onClick={() => void claimTimeoutWin()}
                disabled={isLoading || networkMismatch}
              >
                发起超时判胜
              </Button>
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {summaryItems.map((item) => (
            <div
              key={item.label}
              className={`rounded-xl border px-4 py-3 shadow-sm ${getProjectToneCardClass(
                item.tone
              )}`}
            >
              <p className={PROJECT_LABEL_CLASS}>
                {item.label}
              </p>
              <p className={`text-base ${PROJECT_VALUE_CLASS}`}>
                {item.value}
              </p>
            </div>
          ))}
        </div>

        {isWaitingInvite && (
          <div className="rounded-2xl border border-primary/18 bg-primary/[0.05] px-5 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center">
                  <Badge variant="secondary">邀请中</Badge>
                </div>
                <p className={`text-base ${PROJECT_TITLE_CLASS}`}>
                  把邀请链接发给对手即可加入这一局
                </p>
                <p className={`text-sm leading-6 ${PROJECT_BODY_CLASS}`}>
                  发送邀请链接最省事；如果对方已经在本地链环境中，也可以直接把对局 ID 发给他。
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <InlineCopyButton
                  value={inviteLink}
                  successText="邀请链接已复制，可直接发送给对手"
                  idleLabel="复制邀请链接"
                  copiedLabel="链接已复制"
                  variant="default"
                  size="sm"
                  disabled={!inviteLink}
                  className="w-full sm:w-auto"
                />
                <InlineCopyButton
                  value={gameId.toString()}
                  successText="对局 ID 已复制"
                  idleLabel="复制对局 ID"
                  copiedLabel="ID 已复制"
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                />
              </div>
            </div>
          </div>
        )}

        {activeAction && actionPhase !== "idle" && actionMessage && (
          <div className={`text-sm ${PROJECT_BODY_CLASS}`}>{actionMessage}</div>
        )}
      </div>
    </div>
  );
}
