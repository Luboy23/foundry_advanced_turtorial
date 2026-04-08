import { Address } from "viem";

// 前端会话与交互状态枚举：驱动按钮禁用、写链反馈与身份态展示。
export type SessionStatus = "idle" | "active" | "expired";
export type Player = "X" | "O" | null;
export type Board = Player[];
export type ActionPhase =
  | "idle"
  | "awaiting_signature"
  | "confirming"
  | "success"
  | "error";
export type ActionKind =
  | "create"
  | "join"
  | "move"
  | "cancel"
  | "resign"
  | "timeout";

export type SummaryTone = "default" | "success" | "warning" | "danger";

export type GameSummaryItem = {
  label: string;
  value: string;
  tone?: SummaryTone;
};
export type StatusBanner = {
  tone: SummaryTone;
  title: string;
  description: string;
};

// 对局结算摘要：作为结果弹窗和结束态 Banner 的共享数据模型。
export type ResultKind = "win" | "loss" | "draw" | "cancelled";

export type ResultSummary = {
  kind: ResultKind;
  title: string;
  description: string;
  opponentLabel: string;
  opponentAddress?: Address;
  scoreDelta: number;
  countsTowardStats: boolean;
};

// 对局列表项（简版状态），用于大厅与自动检测逻辑。
export type GameSummary = {
  id: bigint;
  player1: Address;
  player2: Address;
  currentTurn: Address;
  state: number;
  winner: Address;
};

// 对局详情状态（完整版），用于棋盘、回合与倒计时渲染。
export type GameStatus = {
  gameId: bigint;
  player1: Address;
  player2: Address;
  currentTurn: Address;
  board: Board;
  state: number;
  winner: Address;
  lastMoveAt: bigint;
  turnTimeoutSeconds: bigint;
};

// 历史战绩枚举：胜、平、负。
export type HistoryResult = "WIN" | "DRAW" | "LOSS";

// 历史记录项：包含结果与分数变化。
export type HistoryRecord = {
  gameId: bigint;
  opponent: Address;
  result: HistoryResult;
  scoreDelta: number;
  endedAt: bigint;
};

// 排行榜项：player 为链上主体地址，displayAddress 为展示地址。
export type LeaderboardRecord = {
  player: Address;
  displayAddress: Address;
  gamesPlayed: bigint;
  totalScore: bigint;
};

export type ContractEventLog<TArgs extends object> = {
  args?: Partial<TArgs>;
};

// 合约事件参数的最小前端视图：只保留当前订阅逻辑真正会读取的字段。
export type GameEventArgs = {
  gameId: bigint;
};

export type GameCreatedEventArgs = GameEventArgs & {
  player1: Address;
};

export type PlayerJoinedEventArgs = GameEventArgs & {
  player2: Address;
};

export type MoveMadeEventArgs = GameEventArgs;
export type GameWonEventArgs = GameEventArgs;
export type GameDrawnEventArgs = GameEventArgs;
export type GameCancelledEventArgs = GameEventArgs;

// 计分规则配置。
export type ScoringRule = {
  win: number;
  draw: number;
  loss: number;
  cancelCounts: boolean;
};

// 规则元信息：链上加载后的即时配置快照。
export type RulesMeta = {
  turnTimeoutSeconds: number;
  loaded: boolean;
  usingFallback: boolean;
  scoring: ScoringRule;
};

// 规则说明文案结构：用于规则弹窗分区渲染。
export type RulesConfig = {
  quickFacts: string[];
  basicRules: string[];
  gameFlow: string[];
  scoringNotes: string[];
  timeoutNotes: string[];
  statsNotes: string[];
};

// Zustand store 对外契约：集中管理页面状态与业务动作。
export type GameStore = {
  gameId?: bigint;
  gameStatus?: GameStatus;
  board: Board;
  gameList: GameSummary[];
  historyRecords: HistoryRecord[];
  leaderboardRecords: LeaderboardRecord[];
  historyTotal: number;
  leaderboardTotal: number;
  historyPage: number;
  leaderboardPage: number;
  showGameList: boolean;
  showHistoryDialog: boolean;
  showLeaderboardDialog: boolean;
  showRulesDialog: boolean;
  showResult: boolean;
  isLoading: boolean;
  isAutoRestoringGame: boolean;
  isGameListLoading: boolean;
  isHistoryLoading: boolean;
  isLeaderboardLoading: boolean;
  isRulesLoading: boolean;
  // 动作反馈三元组：页面顶部进度提示与按钮文案都依赖这组状态。
  activeAction?: ActionKind;
  actionPhase: ActionPhase;
  actionMessage?: string;
  highlightedGameId?: bigint;
  restoredGameId?: bigint;
  leaderboardLastUpdatedAt?: number;
  // 网络与身份态：既决定写入闸门，也决定大厅/历史中的“我方”展示。
  networkMismatch: boolean;
  playerAddress?: Address;
  smartAccountAddress?: Address;
  sessionStatus: SessionStatus;
  sessionCallsLeft?: number;
  // 规则元数据：驱动规则弹窗、计分摘要和超时提示文案。
  rulesMeta: RulesMeta;
  // UI 开关与高亮控制：让页面编排层只消费 store，不重复管理局部来源。
  setShowGameList: (open: boolean) => void;
  setShowHistoryDialog: (open: boolean) => void;
  setShowLeaderboardDialog: (open: boolean) => void;
  setShowRulesDialog: (open: boolean) => void;
  setShowResult: (open: boolean) => void;
  setHighlightedGameId: (gameId?: bigint) => void;
  setRestoredGameId: (gameId?: bigint) => void;
  setNetworkMismatch: (mismatch: boolean) => void;
  // 动作反馈控制与快速同步入口：事件订阅、轮询和手动刷新共用这里。
  clearActionFeedback: () => void;
  syncGameStatusFast: () => Promise<void>;
  // 邀请链接处理：返回值用于区分继续/浏览/无效。
  handleInviteGame: (
    targetGameId: bigint,
    ownerAddress: Address
  ) => Promise<"continue" | "browse" | "invalid">;
  invalidateLeaderboardCache: () => void;
  returnToHome: () => void;
  // 读取与列表同步动作。
  autoDetectGame: (isConnected: boolean, ownerAddress?: Address) => Promise<void>;
  refreshGameList: () => Promise<void>;
  fetchGameStatus: () => Promise<void>;
  fetchMyHistory: (page?: number) => Promise<void>;
  fetchLeaderboard: (page?: number, forceRefresh?: boolean) => Promise<void>;
  fetchRulesMeta: () => Promise<void>;
  // 链写动作入口。
  createGame: () => Promise<void>;
  joinGame: (targetGameId: bigint) => Promise<void>;
  continueGame: (targetGameId: bigint) => Promise<void>;
  makeMove: (position: number) => Promise<void>;
  cancelGame: () => Promise<void>;
  resign: () => Promise<void>;
  claimTimeoutWin: () => Promise<void>;
};
