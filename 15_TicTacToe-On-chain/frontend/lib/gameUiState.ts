import { zeroAddress, type Address } from "viem";

import type {
  GameStatus,
  GameSummaryItem,
  ResultSummary,
  RulesMeta,
  StatusBanner,
  SummaryTone,
} from "@/types/types";

type BaseUiInput = {
  isConnected: boolean;
  gameId?: bigint;
  gameStatus?: GameStatus;
  playerAddress?: Address;
  networkMismatch: boolean;
  runtimeChainId: number;
  chainId?: number;
  rulesMeta: RulesMeta;
};

type StatusBannerInput = Omit<BaseUiInput, "gameId">;

type SummaryItemsInput = StatusBannerInput & {
  gameId: bigint;
};

type ResultSummaryInput = {
  gameStatus?: GameStatus;
  playerAddress?: Address;
  rulesMeta: RulesMeta;
};

// 对局派生 helper：把链上状态压缩成前端需要的“身份/回合/网络”判断。
// 这里优先输出可复用的最小事实，组件层再决定如何展示文案和样式。
const isCancelledWaitingGame = (gameStatus?: GameStatus) =>
  Boolean(gameStatus && gameStatus.state === 2 && gameStatus.player2 === zeroAddress);

export const getPlayerPiece = (
  gameStatus?: GameStatus,
  playerAddress?: Address
): "X" | "O" | "" => {
  if (!gameStatus || !playerAddress) return "";
  const normalized = playerAddress.toLowerCase();
  if (gameStatus.player1.toLowerCase() === normalized) return "X";
  if (gameStatus.player2.toLowerCase() === normalized) return "O";
  return "";
};

export const isCurrentPlayerTurn = (
  gameStatus?: GameStatus,
  playerAddress?: Address
) => {
  if (!gameStatus || !playerAddress || gameStatus.state !== 1) return false;
  return gameStatus.currentTurn.toLowerCase() === playerAddress.toLowerCase();
};

export const getRemainingTurnSeconds = (
  gameStatus?: GameStatus,
  nowSeconds = Math.floor(Date.now() / 1000)
) => {
  if (!gameStatus || gameStatus.state !== 1) return undefined;
  const expiresAt =
    Number(gameStatus.lastMoveAt) + Number(gameStatus.turnTimeoutSeconds);
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) return undefined;
  return Math.max(expiresAt - nowSeconds, 0);
};

export const isTimeoutClaimable = ({
  gameStatus,
  playerAddress,
  remainingTurnSeconds,
}: {
  gameStatus?: GameStatus;
  playerAddress?: Address;
  remainingTurnSeconds?: number;
}) =>
  Boolean(
    gameStatus &&
      playerAddress &&
      gameStatus.state === 1 &&
      // 只有非当前行动方才能基于“对手超时”发起判胜。
      gameStatus.currentTurn.toLowerCase() !== playerAddress.toLowerCase() &&
      remainingTurnSeconds === 0
  );

export const getOpponentAddress = (
  gameStatus?: GameStatus,
  playerAddress?: Address
): Address | undefined => {
  if (!gameStatus || !playerAddress) return undefined;
  const normalized = playerAddress.toLowerCase();
  if (gameStatus.player1.toLowerCase() === normalized) return gameStatus.player2;
  if (gameStatus.player2.toLowerCase() === normalized) return gameStatus.player1;
  return undefined;
};

const getTurnLabel = (
  gameStatus?: GameStatus,
  playerAddress?: Address
) => {
  if (!gameStatus) return "等待同步";
  if (gameStatus.state === 0) return "等待加入";
  if (gameStatus.state === 2) {
    if (isCancelledWaitingGame(gameStatus)) return "对局已取消";
    return "对局已结束";
  }
  if (!playerAddress) return "进行中";
  return isCurrentPlayerTurn(gameStatus, playerAddress) ? "轮到你" : "轮到对手";
};

const getNetworkLabel = ({
  isConnected,
  networkMismatch,
  runtimeChainId,
  chainId,
}: Pick<BaseUiInput, "isConnected" | "networkMismatch" | "runtimeChainId" | "chainId">) => {
  if (!isConnected) return "未连接";
  if (networkMismatch) return `错误链 ${chainId ?? "--"}`;
  return `本地链 ${runtimeChainId}`;
};

const toneForNetwork = ({
  isConnected,
  networkMismatch,
}: Pick<BaseUiInput, "isConnected" | "networkMismatch">): SummaryTone => {
  if (!isConnected) return "warning";
  if (networkMismatch) return "danger";
  return "success";
};

// 棋盘覆盖文案：只处理“当前不能直接操作棋盘”的入口态和等待态。
export const buildBoardOverlayMessage = ({
  isConnected,
  gameId,
  gameStatus,
}: Pick<BaseUiInput, "isConnected" | "gameId" | "gameStatus">) => {
  if (!isConnected) return "请先连接钱包";
  if (gameId === undefined) return "创建新对局或加入已有对局";
  if (!gameStatus) return "正在同步对局状态…";
  if (gameStatus.state === 0) return "等待对手加入";
  return null;
};

export const buildStatusBanner = ({
  isConnected,
  gameStatus,
  playerAddress,
  networkMismatch,
  rulesMeta,
  chainId,
  runtimeChainId,
}: StatusBannerInput): StatusBanner => {
  // 局内状态 Banner 先处理连接/网络，再处理同步中、等待邀请、已结束，
  // 最后才落到“进行中”的超时/轮到谁两个运行态。
  if (!isConnected) {
    return {
      tone: "warning",
      title: "请先连接钱包",
      description: "重新连接钱包后，即可继续同步当前对局并执行链上操作。",
    };
  }

  if (networkMismatch) {
    return {
      tone: "danger",
      title: "当前网络不匹配",
      description: `当前链 ID 为 ${chainId ?? "--"}，请切换到本地测试链 ${runtimeChainId} 后继续。`,
    };
  }

  if (!gameStatus) {
    return {
      tone: "default",
      title: "正在同步对局状态",
      description: "请稍候，系统正在从链上读取当前对局信息。",
    };
  }

  if (gameStatus.state === 0) {
    return {
      tone: "warning",
      title: "对局已创建，等待对手加入",
      description: "把邀请链接发给对手即可加入这一局，等待阶段可由创建者主动取消。",
    };
  }

  if (gameStatus.state === 2) {
    const resultSummary = buildResultSummary({ gameStatus, playerAddress, rulesMeta });
    return {
      tone:
        resultSummary.kind === "win"
          ? "success"
          : resultSummary.kind === "loss"
            ? "danger"
            : "default",
      title: resultSummary.title,
      description: resultSummary.description,
    };
  }

  const remainingTurnSeconds = getRemainingTurnSeconds(gameStatus);
  const timeoutReady = isTimeoutClaimable({
    gameStatus,
    playerAddress,
    remainingTurnSeconds,
  });
  if (timeoutReady) {
    return {
      tone: "danger",
      title: "对手已超时，可发起判胜",
      description: `当前回合已超过 ${Math.round(
        rulesMeta.turnTimeoutSeconds / 60
      )} 分钟，你现在可以直接发起超时判胜。`,
    };
  }

  if (isCurrentPlayerTurn(gameStatus, playerAddress)) {
    return {
      tone: "success",
      title: "轮到你落子",
      description: "请选择棋盘中的一个空位完成当前回合。",
    };
  }

  return {
    tone: "default",
    title: "等待对手落子",
    description: "系统会自动同步最新链上状态，你可以先查看规则或排行榜。",
  };
};

export const buildGameSummaryItems = ({
  isConnected,
  gameId,
  gameStatus,
  playerAddress,
  networkMismatch,
  runtimeChainId,
  chainId,
}: SummaryItemsInput): GameSummaryItem[] => {
  // 摘要卡只保留稳定、高频的局内维度，避免和状态 Banner 重复解释同一件事。
  const remainingTurnSeconds = getRemainingTurnSeconds(gameStatus);
  const playerPiece = getPlayerPiece(gameStatus, playerAddress);

  return [
    {
      label: "当前对局",
      value: `#${gameId.toString()}`,
    },
    {
      label: "我的棋子",
      value: playerPiece || "--",
    },
    {
      label: "当前回合",
      value: getTurnLabel(gameStatus, playerAddress),
      tone:
        gameStatus?.state === 1 && isCurrentPlayerTurn(gameStatus, playerAddress)
          ? "success"
          : "default",
    },
    {
      label: "回合剩余",
      value:
        typeof remainingTurnSeconds === "number"
          ? `${remainingTurnSeconds} 秒`
          : "--",
      tone:
        typeof remainingTurnSeconds === "number" && remainingTurnSeconds <= 10
          ? "danger"
          : "default",
    },
    {
      label: "网络状态",
      value: getNetworkLabel({
        isConnected,
        networkMismatch,
        runtimeChainId,
        chainId,
      }),
      tone: toneForNetwork({ isConnected, networkMismatch }),
    },
  ];
};

export const buildResultSummary = ({
  gameStatus,
  playerAddress,
  rulesMeta,
}: ResultSummaryInput): ResultSummary => {
  // 结算摘要先区分“数据未同步 / 等待局取消 / 平局 / 胜负”，
  // 再补对手信息与积分口径，确保弹窗、Banner 与历史口径保持一致。
  const opponentAddress = getOpponentAddress(gameStatus, playerAddress);
  const playerLower = playerAddress?.toLowerCase();
  const winnerLower = gameStatus?.winner.toLowerCase();
  const opponentLabel =
    opponentAddress && opponentAddress !== zeroAddress ? "对手地址" : "对手信息";

  if (!gameStatus) {
    return {
      kind: "draw",
      title: "本局已结束",
      description: "当前对局已结束，结果数据正在同步。",
      opponentLabel,
      opponentAddress,
      scoreDelta: 0,
      countsTowardStats: false,
    };
  }

  if (isCancelledWaitingGame(gameStatus)) {
    return {
      kind: "cancelled",
      title: "等待中的对局已取消",
      description: "该局在等待加入阶段被取消，不计入历史与排行榜。",
      opponentLabel: "对手信息",
      opponentAddress: undefined,
      scoreDelta: 0,
      countsTowardStats: false,
    };
  }

  if (gameStatus.winner === zeroAddress) {
    return {
      kind: "draw",
      title: "本局平局",
      description: "双方未分胜负，本局会按平局计入历史与排行榜。",
      opponentLabel,
      opponentAddress,
      scoreDelta: rulesMeta.scoring.draw,
      countsTowardStats: true,
    };
  }

  const isWinner = Boolean(
    playerLower && winnerLower && playerLower === winnerLower
  );
  return {
    kind: isWinner ? "win" : "loss",
    title: isWinner ? "恭喜，你赢了！" : "本局失利",
    description: isWinner
      ? "这一局的胜利会计入你的历史与排行榜。"
      : "这局结果已经结算，仍会计入你的历史与排行榜。",
    opponentLabel,
    opponentAddress,
    scoreDelta: isWinner ? rulesMeta.scoring.win : rulesMeta.scoring.loss,
    countsTowardStats: true,
  };
};
