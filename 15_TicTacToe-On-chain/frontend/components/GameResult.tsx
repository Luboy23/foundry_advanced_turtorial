"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BadgeX, Ban, Handshake, PartyPopper } from "lucide-react";

import { buildResultSummary } from "@/lib/gameUiState";
import {
  getProjectTonePanelClass,
  getProjectScoreClass,
  PROJECT_INFO_CARD_SOFT_CLASS,
  PROJECT_BODY_CLASS,
  PROJECT_LABEL_CLASS,
  PROJECT_TITLE_CLASS,
  PROJECT_VALUE_SUBTLE_CLASS,
} from "@/lib/projectTheme";
import { useGameStore } from "@/store/useGameStore";

const RESULT_ICON_CONFIG = {
  win: {
    Icon: PartyPopper,
    label: "胜利图标",
  },
  loss: {
    Icon: BadgeX,
    label: "失败图标",
  },
  draw: {
    Icon: Handshake,
    label: "平局图标",
  },
  cancelled: {
    Icon: Ban,
    label: "取消图标",
  },
} as const;

// 地址短展示工具，保证弹窗标题长度稳定。
const shortenAddress = (value?: string) => {
  if (!value || value.length < 10) return value ?? "未知玩家";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

// 对局结算弹窗：展示结果、分数、统计口径与下一步动作。
export default function GameResult() {
  const {
    showResult,
    setShowResult,
    createGame,
    returnToHome,
    gameStatus,
    playerAddress,
    activeAction,
    actionPhase,
    actionMessage,
    rulesMeta,
  } = useGameStore();

  const resultSummary = buildResultSummary({
    gameStatus,
    playerAddress,
    rulesMeta,
  });
  const {
    Icon: ResultIcon,
    label: resultIconLabel,
  } = RESULT_ICON_CONFIG[resultSummary.kind];
  const scoreLabel =
    resultSummary.scoreDelta > 0
      ? `+${resultSummary.scoreDelta}`
      : `${resultSummary.scoreDelta}`;
  const isRematchAction = activeAction === "create";
  const isRematchPending =
    isRematchAction &&
    (actionPhase === "awaiting_signature" || actionPhase === "confirming");
  const rematchButtonLabel = !isRematchAction
    ? "再来一局"
    : actionPhase === "awaiting_signature"
      ? "请在钱包确认"
      : actionPhase === "confirming"
        ? "创建中…"
        : actionPhase === "success"
          ? "即将进入新局…"
          : actionPhase === "error"
            ? "重试创建"
            : "再来一局";
  const rematchFeedbackTitle =
    actionPhase === "awaiting_signature"
      ? "等待签名"
      : actionPhase === "confirming"
        ? "链上确认中"
        : actionPhase === "success"
          ? "已完成"
          : "需要处理";
  const rematchFeedbackTone =
    actionPhase === "success"
      ? "success"
      : actionPhase === "error"
        ? "danger"
        : "warning";
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setShowResult(true);
      return;
    }
    if (isRematchPending) {
      return;
    }
    returnToHome();
  };

  return (
    <Dialog open={showResult} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-[620px]"
        showCloseButton={!isRematchPending}
        onEscapeKeyDown={(event) => {
          if (isRematchPending) {
            event.preventDefault();
          }
        }}
        onInteractOutside={(event) => {
          if (isRematchPending) {
            event.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <div
            aria-label={resultIconLabel}
            className="spring-pop mx-auto mb-1 mt-1 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"
          >
            <ResultIcon className="h-7 w-7" aria-hidden="true" />
          </div>
          <DialogTitle
            className={`flex items-center justify-center gap-2 text-center text-2xl ${PROJECT_TITLE_CLASS}`}
          >
            {resultSummary.title}
          </DialogTitle>
          <DialogDescription className={`pt-2 text-center text-lg ${PROJECT_BODY_CLASS}`}>
            {resultSummary.description}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className={`${PROJECT_INFO_CARD_SOFT_CLASS} p-4`}>
            <p className={PROJECT_LABEL_CLASS}>
              结果类型
            </p>
            <div className="mt-2">
              <Badge
                variant="outline"
                className="border-primary/30 bg-primary/[0.08] text-primary"
              >
                {resultSummary.kind === "win"
                  ? "胜利"
                  : resultSummary.kind === "loss"
                    ? "失败"
                    : resultSummary.kind === "draw"
                      ? "平局"
                      : "已取消"}
              </Badge>
            </div>
          </div>

          <div className={`${PROJECT_INFO_CARD_SOFT_CLASS} p-4`}>
            <p className={PROJECT_LABEL_CLASS}>
              分数变化
            </p>
            <p className={`mt-2 text-xl font-semibold ${getProjectScoreClass(resultSummary.scoreDelta)}`}>
              {scoreLabel}
            </p>
          </div>

          <div className={`${PROJECT_INFO_CARD_SOFT_CLASS} p-4`}>
            <p className={PROJECT_LABEL_CLASS}>
              {resultSummary.opponentLabel}
            </p>
            <p className={PROJECT_VALUE_SUBTLE_CLASS}>
              {resultSummary.opponentAddress
                ? shortenAddress(resultSummary.opponentAddress)
                : "本局未产生有效对手"}
            </p>
          </div>

          <div className={`${PROJECT_INFO_CARD_SOFT_CLASS} p-4`}>
            <p className={PROJECT_LABEL_CLASS}>
              统计口径
            </p>
            <p className={PROJECT_VALUE_SUBTLE_CLASS}>
              {resultSummary.countsTowardStats
                ? "计入历史与排行榜"
                : "不计入历史与排行榜"}
            </p>
          </div>
        </div>

        {isRematchAction && actionPhase !== "idle" && actionMessage && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${getProjectTonePanelClass(
              rematchFeedbackTone
            )}`}
            role="status"
            aria-live="polite"
          >
            <p className={PROJECT_TITLE_CLASS}>{rematchFeedbackTitle}</p>
            <p className={`mt-1 ${PROJECT_BODY_CLASS}`}>{actionMessage}</p>
          </div>
        )}

        <DialogFooter className="mt-2 w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            variant="outline"
            disabled={isRematchPending}
            onClick={returnToHome}
            className="w-full sm:min-w-0 sm:flex-1 sm:w-auto"
          >
            返回首页
          </Button>
          <Button
            variant="default"
            disabled={isRematchPending}
            onClick={() => {
              void createGame();
            }}
            className="w-full sm:min-w-0 sm:flex-1 sm:w-auto"
          >
            {rematchButtonLabel}
          </Button>
        </DialogFooter>

        <style jsx>{`
          .spring-pop {
            animation: spring-pop 560ms cubic-bezier(0.22, 1.35, 0.4, 1) both;
          }

          @keyframes spring-pop {
            0% {
              transform: scale(0.62);
              opacity: 0;
            }
            60% {
              transform: scale(1.16);
              opacity: 1;
            }
            100% {
              transform: scale(1);
              opacity: 1;
            }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
