import { create } from "zustand";
import { toast } from "sonner";
import {
  Address,
  encodeFunctionData,
  zeroAddress,
} from "viem";
import {
  getAccount,
  readContract,
  simulateContract,
  waitForTransactionReceipt,
  writeContract,
} from "wagmi/actions";
import { getAppConfig } from "@/components/web3/config";
import {
  CONTRACT_ABI,
  RuntimeContractConfig,
  SESSION_FACTORY_ABI,
  getResolvedRuntimeConfig,
  loadRuntimeContractConfig,
} from "@/constants";
import {
  clearSession,
  GameActionName,
  getPlayerAddress,
  getSession,
  getSessionStatus,
  refreshSession,
  sendGameAction,
  setupRoundSession,
} from "@/lib/sessionClient";
import { compareLeaderboardRecords } from "@/lib/leaderboard";
import { PAGE_SIZE, clampPage, pageOffsets, slicePage } from "@/lib/pagination";
import { createDefaultRulesMeta } from "@/lib/rulesConfig";
import {
  ActionKind,
  Board,
  GameStatus,
  GameStore,
  GameSummary,
  HistoryRecord,
  LeaderboardRecord,
  Player,
} from "@/types/types";

// 原始对局返回元组类型（来自 getGameState）。
type RawGameTuple = [
  Address,
  Address,
  Address,
  readonly (bigint | number)[],
  number | bigint,
  Address
];

// 原始历史记录行（来自 getPlayerHistoryPage）。
type RawHistoryRow = {
  gameId: bigint | number;
  opponent: Address;
  result: number | bigint;
  scoreDelta: number | bigint;
  endedAt: bigint | number;
};

// 原始排行榜行（来自 getLeaderboardPage）。
type RawLeaderboardRow = {
  player: Address;
  gamesPlayed: bigint | number;
  totalScore: bigint | number;
};

// 排行榜缓存快照：保存全量排序结果与缓存时间戳。
type LeaderboardCacheState = {
  cacheKey: string;
  records: LeaderboardRecord[];
  total: number;
  updatedAt: number;
};

type OpeningActionFunctionName = "createGame" | "joinGame";
type InGameActionFunctionName =
  | "makeMove"
  | "cancelGame"
  | "resign"
  | "claimTimeoutWin";

type ActionPhaseHandler = (
  phase: "awaiting_signature" | "confirming"
) => void;

type InGameActionContext = {
  owner: Address;
  gameId: bigint;
  gameStatus: GameStatus;
  player: Address;
};

// 空棋盘常量，所有“重置棋盘”场景都复用该模板。
const EMPTY_BOARD: Board = Array.from({ length: 9 }, () => null);
// 排行榜缓存 TTL，过期后重新从链上拉取全量数据。
const LEADERBOARD_CACHE_TTL_MS = 30_000;

// 地址格式守卫。
const isAddress = (value: unknown): value is Address =>
  typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);

// 地址归一化：非法值回退到 zeroAddress。
const asAddress = (value: unknown): Address =>
  isAddress(value) ? value : zeroAddress;

// bigint 归一化：兼容 number/string 输入并提供回退值。
const asBigInt = (value: unknown, fallback = BigInt(0)): bigint => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }
  if (typeof value === "string" && value.length > 0) {
    try {
      return BigInt(value);
    } catch {
      return fallback;
    }
  }
  return fallback;
};

// number 归一化：统一做截断并处理 bigint/string 输入。
const asNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return fallback;
};

// 将链上 uint8[9] 棋盘映射为前端 Board（X/O/null）。
const toBoard = (board: readonly (bigint | number)[]): Board =>
  Array.from({ length: 9 }, (_, index) => {
    const value = asNumber(board[index], 0);
    if (value === 1) return "X";
    if (value === 2) return "O";
    return null;
  }) as Player[];

// 历史结果码映射：2=WIN、1=DRAW、其余视为 LOSS。
const mapHistoryResult = (result: number): "WIN" | "DRAW" | "LOSS" => {
  if (result === 2) return "WIN";
  if (result === 1) return "DRAW";
  return "LOSS";
};

// 统一动作错误文案映射，降低原始 RPC 错误的用户理解成本。
const classifyActionError = (error: unknown, fallback: string): string => {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const text = raw.toLowerCase();

  if (
    text.includes("user rejected") ||
    text.includes("user denied") ||
    text.includes("rejected") ||
    text.includes("denied")
  ) {
    return "你已取消钱包签名，交易未提交。";
  }
  if (text.includes("session") || text.includes("会话")) {
    return "操作授权已过期，请重新确认一次签名后继续。";
  }
  if (
    text.includes("rpc") ||
    text.includes("network") ||
    text.includes("failed to fetch") ||
    text.includes("timeout")
  ) {
    return "网络连接异常，请稍后重试。";
  }
  if (
    text.includes("revert") ||
    text.includes("execution reverted") ||
    text.includes("invalid")
  ) {
    return "当前操作条件不满足，请刷新状态后重试。";
  }

  return fallback;
};

// 读取并合并 runtime 配置，确保后续链读写地址一致。
const withRuntimeConfig = async () => loadRuntimeContractConfig();

// 统一读取当前 wagmi 配置，保证链读写使用同一初始化结果。
const getWagmiConfig = () => getAppConfig();

// 排行榜缓存命名空间：链、游戏合约和会话工厂任一变化都视为不同快照。
const buildLeaderboardCacheKey = (runtime: RuntimeContractConfig) =>
  [
    runtime.chainId,
    runtime.tictactoeAddress.toLowerCase(),
    runtime.sessionFactoryAddress.toLowerCase(),
  ].join(":");

// 展示地址缓存：key=工厂地址+账户地址，value=EOA 展示地址。
const displayAddressCache = new Map<string, Address>();

// 将链上参与地址解析为可展示地址（优先 ownerOfAccount 映射）。
const resolveDisplayAddress = async (
  sessionFactoryAddress: Address,
  address: Address
): Promise<Address> => {
  if (!isAddress(address) || address === zeroAddress) {
    return zeroAddress;
  }

  const cacheKey = `${sessionFactoryAddress.toLowerCase()}:${address.toLowerCase()}`;
  const cachedAddress = displayAddressCache.get(cacheKey);
  if (cachedAddress) {
    return cachedAddress;
  }

  let displayAddress = address;
  try {
    const owner = (await readContract(getWagmiConfig(), {
      address: sessionFactoryAddress,
      abi: SESSION_FACTORY_ABI,
      functionName: "ownerOfAccount",
      args: [address],
    })) as Address;
    if (isAddress(owner) && owner !== zeroAddress) {
      displayAddress = owner;
    }
  } catch {
    displayAddress = address;
  }

  displayAddressCache.set(cacheKey, displayAddress);
  return displayAddress;
};

// 查询剩余会话调用次数，若无会话则返回 undefined。
const getSessionLeft = (owner?: Address): number | undefined => {
  if (!owner) return undefined;
  const session = getSession(owner);
  if (!session) return undefined;
  return Math.max(session.maxCalls - session.callsUsed, 0);
};

// 将链上对局原始结构构造成前端状态对象。
const buildGameStatus = (
  gameId: bigint,
  gameTuple: RawGameTuple,
  timeTuple?: readonly [bigint, bigint]
): GameStatus => {
  const [player1, player2, currentTurn, rawBoard, stateRaw, winner] = gameTuple;
  const lastMoveAt = asBigInt(timeTuple?.[0], BigInt(0));
  const turnTimeoutSeconds = asBigInt(timeTuple?.[1], BigInt(0));

  return {
    gameId,
    player1: asAddress(player1),
    player2: asAddress(player2),
    currentTurn: asAddress(currentTurn),
    board: toBoard(rawBoard || []),
    state: asNumber(stateRaw, 0),
    winner: asAddress(winner),
    lastMoveAt,
    turnTimeoutSeconds,
  };
};

// 构建大厅/自动探测用的轻量对局摘要对象。
const buildGameSummary = (gameId: bigint, gameTuple: RawGameTuple): GameSummary => {
  const [player1, player2, currentTurn, , stateRaw, winner] = gameTuple;
  return {
    id: gameId,
    player1: asAddress(player1),
    player2: asAddress(player2),
    currentTurn: asAddress(currentTurn),
    state: asNumber(stateRaw, 0),
    winner: asAddress(winner),
  };
};

// 直连钱包写链动作：用于会话失败后的兜底路径。
const executeDirectContractAction = async (
  functionName: OpeningActionFunctionName | InGameActionFunctionName,
  args: readonly unknown[],
  onPhaseChange?: ActionPhaseHandler
) => {
  const runtime = await withRuntimeConfig();
  const wagmiConfig = getWagmiConfig();
  const simulation = await simulateContract(wagmiConfig, {
    address: runtime.tictactoeAddress,
    abi: CONTRACT_ABI,
    functionName,
    args,
  });
  onPhaseChange?.("awaiting_signature");
  const hash = await writeContract(wagmiConfig, simulation.request);
  onPhaseChange?.("confirming");
  await waitForTransactionReceipt(wagmiConfig, { hash, timeout: 30_000 });
};

// 会话优先写链：会话不可用时自动降级到直连钱包写链。
const executeWithSessionFallback = async ({
  owner,
  action,
  args,
  fallbackFunctionName,
  onPhaseChange,
}: {
  owner: Address;
  action: GameActionName;
  args: readonly unknown[];
  fallbackFunctionName: InGameActionFunctionName;
  onPhaseChange?: ActionPhaseHandler;
}) => {
  try {
    if (getSessionStatus(owner) !== "active") {
      await refreshSession(owner, onPhaseChange);
    }
    await sendGameAction({ owner, action, args, onPhaseChange });
    return;
  } catch {
    await executeDirectContractAction(fallbackFunctionName, args, onPhaseChange);
  }
};

// 对局状态同步 in-flight 锁：防止事件/轮询触发并发风暴。
let gameStatusSyncInFlight: Promise<void> | null = null;
// 排行榜全量缓存：用于翻页本地切片与短时复用。
const leaderboardCacheByKey = new Map<string, LeaderboardCacheState>();
// 动作反馈自动清理计时器，避免成功提示长期滞留。
let actionFeedbackClearTimer: ReturnType<typeof setTimeout> | null = null;

// 全局游戏 store：统一管理链读写、页面状态与动作反馈。
export const useGameStore = create<GameStore>((set, get) => {
  // 读取当前 gameId 对应的链上状态，并同步棋盘快照。
  const readCurrentGameStatus = async (showErrorToast: boolean) => {
    const gameId = get().gameId;
    if (gameId === undefined) {
      set({ gameStatus: undefined, board: [...EMPTY_BOARD] });
      return;
    }

    try {
      const runtime = await withRuntimeConfig();
      const gameTuple = (await readContract(getWagmiConfig(), {
        address: runtime.tictactoeAddress,
        abi: CONTRACT_ABI,
        functionName: "getGameState",
        args: [gameId],
      })) as RawGameTuple;

      let timeTuple: [bigint, bigint] | undefined;
      try {
        const tuple = (await readContract(getWagmiConfig(), {
          address: runtime.tictactoeAddress,
          abi: CONTRACT_ABI,
          functionName: "getTimeInfo",
          args: [gameId],
        })) as readonly [bigint, bigint];
        timeTuple = [asBigInt(tuple[0]), asBigInt(tuple[1])];
      } catch {
        timeTuple = undefined;
      }

      const gameStatus = buildGameStatus(gameId, gameTuple, timeTuple);
      set({ gameStatus, board: [...gameStatus.board] });
    } catch (error) {
      console.error(error);
      if (showErrorToast) {
        toast.error("读取对局状态失败");
      }
    }
  };

  // 统一同步入口：同一时刻最多只执行一次状态读取。
  const runGameStatusSync = (showErrorToast: boolean) => {
    if (gameStatusSyncInFlight) return gameStatusSyncInFlight;

    gameStatusSyncInFlight = readCurrentGameStatus(showErrorToast).finally(() => {
      gameStatusSyncInFlight = null;
    });

    return gameStatusSyncInFlight;
  };

  // 清理动作反馈定时器，防止重复 setTimeout 累积。
  const clearActionFeedbackTimer = () => {
    if (!actionFeedbackClearTimer) return;
    clearTimeout(actionFeedbackClearTimer);
    actionFeedbackClearTimer = null;
  };

  // 更新动作反馈三元组（动作/阶段/文案）。
  const updateActionFeedback = ({
    action,
    phase,
    message,
  }: {
    action?: ActionKind;
    phase: "idle" | "awaiting_signature" | "confirming" | "success" | "error";
    message?: string;
  }) => {
    set({
      activeAction: action,
      actionPhase: phase,
      actionMessage: message,
    });
  };

  // 成功提示自动回落到 idle，避免界面长期显示“完成”态。
  const scheduleActionFeedbackReset = (action: ActionKind) => {
    clearActionFeedbackTimer();
    actionFeedbackClearTimer = setTimeout(() => {
      if (get().activeAction === action) {
        updateActionFeedback({ action: undefined, phase: "idle", message: undefined });
      }
      actionFeedbackClearTimer = null;
    }, 1200);
  };

  // 动作失败统一处理：映射可读错误并弹出提示。
  const markActionError = (action: ActionKind, error: unknown, fallbackMessage: string) => {
    const message = classifyActionError(error, fallbackMessage);
    updateActionFeedback({ action, phase: "error", message });
    toast.error(message);
  };

  // 链 ID 校验：写操作前置闸门，避免误写到错误网络。
  const ensureExpectedNetwork = (): boolean => {
    const runtime = getResolvedRuntimeConfig();
    const current = (getAccount(getWagmiConfig()) as { chainId?: number }).chainId;
    if (typeof current === "number" && current !== runtime.chainId) {
      set({ networkMismatch: true });
      toast.error(`当前网络链ID(${current})与项目链ID(${runtime.chainId})不一致。`);
      return false;
    }
    set({ networkMismatch: false });
    return true;
  };

  // 将会话剩余次数压缩成一次 set patch，供动作成功后统一回写到 UI。
  const getSessionStatePatch = (owner: Address) => ({
    sessionStatus: getSessionStatus(owner),
    sessionCallsLeft: getSessionLeft(owner),
  });

  // 读取当前连接的钱包地址；缺失时直接给出用户提示，避免后续重复判空。
  const requireConnectedOwner = (): Address | undefined => {
    const owner = getAccount(getWagmiConfig()).address as Address | undefined;
    if (!owner) {
      toast.error("请先连接钱包");
      return undefined;
    }
    return owner;
  };

  // 校验“已经进入对局”这组最小前置条件。
  // 该 helper 同时返回 owner / player / gameStatus，避免每个动作重复拼装上下文。
  const requireInGameContext = (): InGameActionContext | undefined => {
    const owner = getAccount(getWagmiConfig()).address as Address | undefined;
    const gameId = get().gameId;
    const gameStatus = get().gameStatus;
    const player = get().playerAddress;

    if (!owner || gameId === undefined || !gameStatus || !player) {
      toast.error("请先连接钱包并进入对局");
      return undefined;
    }

    return {
      owner,
      gameId,
      gameStatus,
      player,
    };
  };

  // 在局内上下文基础上再补“当前地址确实属于该局参与方”的约束。
  // 主要用于认输、取消、超时判胜等必须绑定参与者身份的动作。
  const requireParticipantContext = (): InGameActionContext | undefined => {
    const context = requireInGameContext();
    if (!context) {
      return undefined;
    }

    const isParticipant =
      context.gameStatus.player1.toLowerCase() === context.player.toLowerCase() ||
      context.gameStatus.player2.toLowerCase() === context.player.toLowerCase();
    if (!isParticipant) {
      toast.error("你不是该对局参与方");
      return undefined;
    }

    return context;
  };

  const runOpeningAction = async ({
    owner,
    action,
    functionName,
    args,
    awaitingMessage,
    confirmingMessage,
    successMessage,
    errorMessage,
    successState,
    postSuccess,
  }: {
    owner: Address;
    action: "create" | "join";
    functionName: OpeningActionFunctionName;
    args: readonly unknown[];
    awaitingMessage: string;
    confirmingMessage: string;
    successMessage: string;
    errorMessage: string;
    successState: Partial<GameStore>;
    postSuccess?: () => Promise<void> | void;
  }) => {
    // 开局类动作共用同一条执行链：
    // 1. 先做网络闸门与进度提示；
    // 2. 优先通过 setupRoundSession 一次完成“业务调用 + 会话激活 + 预充值”；
    // 3. 若会话链路失败，则回退到直连钱包写链；
    // 4. 成功后统一回写会话状态、自动探测当前局并刷新 UI。
    if (!ensureExpectedNetwork()) {
      return;
    }

    set({ isLoading: true });
    updateActionFeedback({
      action,
      phase: "awaiting_signature",
      message: awaitingMessage,
    });

    const handlePhaseChange: ActionPhaseHandler = (phase) => {
      updateActionFeedback({
        action,
        phase,
        message: phase === "awaiting_signature" ? awaitingMessage : confirmingMessage,
      });
    };

    try {
      await withRuntimeConfig();
      const openingCallData = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName,
        args,
      });

      await setupRoundSession({
        owner,
        openingCallData,
        onPhaseChange: handlePhaseChange,
      });

      set({
        ...getSessionStatePatch(owner),
        ...successState,
      });
      await get().autoDetectGame(true, owner);
      await postSuccess?.();
      updateActionFeedback({
        action,
        phase: "success",
        message: successMessage,
      });
      toast.success(successMessage);
      scheduleActionFeedbackReset(action);
    } catch {
      try {
        // 会话开局失败时降级到普通钱包写链，并清理本地会话快照，避免 UI 误判为仍可复用。
        await executeDirectContractAction(functionName, args, handlePhaseChange);
        clearSession(owner);
        set({
          sessionStatus: "idle",
          sessionCallsLeft: undefined,
          ...successState,
        });
        await get().autoDetectGame(true, owner);
        await postSuccess?.();
        updateActionFeedback({
          action,
          phase: "success",
          message: successMessage,
        });
        toast.success(successMessage);
        scheduleActionFeedbackReset(action);
      } catch (error) {
        console.error(error);
        markActionError(action, error, errorMessage);
      }
    } finally {
      set({ isLoading: false });
    }
  };

  const runInGameAction = async ({
    context,
    action,
    sessionAction,
    args,
    awaitingMessage,
    confirmingMessage,
    successMessage,
    errorMessage,
    successState,
    postSuccess,
  }: {
    context: InGameActionContext;
    action: Exclude<ActionKind, "create" | "join">;
    sessionAction: GameActionName;
    args: readonly unknown[];
    awaitingMessage: string;
    confirmingMessage: string;
    successMessage: string;
    errorMessage: string;
    successState?: Partial<GameStore>;
    postSuccess?: () => Promise<void>;
  }) => {
    // 局内动作沿用“会话优先、直连兜底”的统一执行器。
    // executeWithSessionFallback 内部会先尝试刷新会话，再执行免签调用；
    // 任一步失败都会切到直连钱包，因此这里的职责只剩进度反馈和成功后的状态收口。
    if (!ensureExpectedNetwork()) {
      return;
    }

    set({ isLoading: true });
    updateActionFeedback({
      action,
      phase: "awaiting_signature",
      message: awaitingMessage,
    });

    try {
      await executeWithSessionFallback({
        owner: context.owner,
        action: sessionAction,
        args,
        fallbackFunctionName: sessionAction,
        onPhaseChange: (phase) => {
          updateActionFeedback({
            action,
            phase,
            message: phase === "awaiting_signature" ? awaitingMessage : confirmingMessage,
          });
        },
      });

      set({
        ...getSessionStatePatch(context.owner),
        ...successState,
      });
      await postSuccess?.();
      updateActionFeedback({
        action,
        phase: "success",
        message: successMessage,
      });
      scheduleActionFeedbackReset(action);
    } catch (error) {
      console.error(error);
      markActionError(action, error, errorMessage);
    } finally {
      set({ isLoading: false });
    }
  };

  return {
    gameId: undefined,
    gameStatus: undefined,
    board: [...EMPTY_BOARD],
    gameList: [],
    historyRecords: [],
    leaderboardRecords: [],
    historyTotal: 0,
    leaderboardTotal: 0,
    historyPage: 1,
    leaderboardPage: 1,
    showGameList: false,
    showHistoryDialog: false,
    showLeaderboardDialog: false,
    showRulesDialog: false,
    showResult: false,
    isLoading: false,
    isAutoRestoringGame: false,
    isGameListLoading: false,
    isHistoryLoading: false,
    isLeaderboardLoading: false,
    isRulesLoading: false,
    activeAction: undefined,
    actionPhase: "idle",
    actionMessage: undefined,
    highlightedGameId: undefined,
    restoredGameId: undefined,
    leaderboardLastUpdatedAt: undefined,
    networkMismatch: false,
    playerAddress: undefined,
    smartAccountAddress: undefined,
    sessionStatus: "idle",
    sessionCallsLeft: undefined,
    rulesMeta: createDefaultRulesMeta(),

    // 对话框开关：关闭大厅时顺带清理高亮目标局。
    setShowGameList: (open) =>
      set({
        showGameList: open,
        highlightedGameId: open ? get().highlightedGameId : undefined,
      }),
    // 基础弹窗显隐控制。
    setShowHistoryDialog: (open) => set({ showHistoryDialog: open }),
    setShowLeaderboardDialog: (open) => set({ showLeaderboardDialog: open }),
    setShowRulesDialog: (open) => set({ showRulesDialog: open }),
    setShowResult: (open) => set({ showResult: open }),
    // 邀请高亮与网络错链状态写入入口。
    setHighlightedGameId: (gameId) => set({ highlightedGameId: gameId }),
    setRestoredGameId: (gameId) => set({ restoredGameId: gameId }),
    setNetworkMismatch: (mismatch) => set({ networkMismatch: mismatch }),
    // 清空动作反馈并取消自动清理计时器。
    clearActionFeedback: () => {
      clearActionFeedbackTimer();
      updateActionFeedback({ action: undefined, phase: "idle", message: undefined });
    },
    // 快速同步入口：事件监听、轮询和用户动作都统一走该函数。
    syncGameStatusFast: async () => {
      await runGameStatusSync(false);
    },
    // 处理邀请链接：本人在局内则直进，等待局打开大厅高亮，其余无效目标直接提示。
    handleInviteGame: async (targetGameId, ownerAddress) => {
      try {
        const runtime = await withRuntimeConfig();
        const tuple = (await readContract(getWagmiConfig(), {
          address: runtime.tictactoeAddress,
          abi: CONTRACT_ABI,
          functionName: "getGameState",
          args: [targetGameId],
        })) as RawGameTuple;
        const game = buildGameSummary(targetGameId, tuple);
        const player = (await getPlayerAddress(ownerAddress)) ?? ownerAddress;
        const isParticipant =
          game.player1.toLowerCase() === player.toLowerCase() ||
          game.player2.toLowerCase() === player.toLowerCase();

        if (isParticipant && game.state < 2) {
          set({
            gameId: targetGameId,
            showGameList: false,
            highlightedGameId: undefined,
          });
          await get().syncGameStatusFast();
          return "continue";
        }

        if (game.state >= 2) {
          set({
            showGameList: false,
            highlightedGameId: undefined,
          });
          toast.error("邀请链接中的对局已结束。");
          return "invalid";
        }

        if (game.state === 1) {
          set({
            showGameList: false,
            highlightedGameId: undefined,
          });
          toast.error("该对局已开始，无法加入。");
          return "invalid";
        }

        set({
          highlightedGameId: targetGameId,
          showGameList: true,
        });
        await get().refreshGameList();
        return "browse";
      } catch {
        toast.error("邀请链接中的对局无效或不存在。");
        return "invalid";
      }
    },
    // 强制失效排行榜缓存，下一次读取时重新全量拉取。
    invalidateLeaderboardCache: () => {
      const runtime = getResolvedRuntimeConfig();
      leaderboardCacheByKey.delete(buildLeaderboardCacheKey(runtime));
    },
    // 返回首页：重置局内状态、弹窗状态与动作反馈。
    returnToHome: () => {
      clearActionFeedbackTimer();
      set({
        gameId: undefined,
        gameStatus: undefined,
        board: [...EMPTY_BOARD],
        showResult: false,
        showGameList: false,
        showHistoryDialog: false,
        showLeaderboardDialog: false,
        showRulesDialog: false,
        isAutoRestoringGame: false,
        highlightedGameId: undefined,
        restoredGameId: undefined,
        activeAction: undefined,
        actionPhase: "idle",
        actionMessage: undefined,
      });
    },

    // 自动探测当前地址可继续的未结束对局，并更新玩家身份地址。
    autoDetectGame: async (isConnected, ownerAddress) => {
      const previousGameId = get().gameId;
      const shouldTrackRestoreHint = get().activeAction === undefined;
      if (!isConnected || !ownerAddress) {
        set({
          gameId: undefined,
          gameStatus: undefined,
          board: [...EMPTY_BOARD],
          highlightedGameId: undefined,
          restoredGameId: undefined,
          isAutoRestoringGame: false,
          networkMismatch: false,
          playerAddress: undefined,
          smartAccountAddress: undefined,
          sessionStatus: "idle",
          sessionCallsLeft: undefined,
        });
        return;
      }

      set({ isAutoRestoringGame: true });

      try {
        const runtime = await withRuntimeConfig();
        const playerAddress = (await getPlayerAddress(ownerAddress)) ?? ownerAddress;
        const sessionStatus = getSessionStatus(ownerAddress);

        set({
          playerAddress,
          smartAccountAddress:
            playerAddress.toLowerCase() === ownerAddress.toLowerCase()
              ? undefined
              : playerAddress,
          sessionStatus,
          sessionCallsLeft: getSessionLeft(ownerAddress),
          networkMismatch: false,
        });

        let targetGameId: bigint | undefined;
        try {
          const gameCounter = asNumber(
            await readContract(getWagmiConfig(), {
              address: runtime.tictactoeAddress,
              abi: CONTRACT_ABI,
              functionName: "gameCounter",
            }),
            0
          );

          // 从最新对局向前扫描：用户更可能回到最近一局，这样通常能更快命中未结束对局。
          for (let index = gameCounter - 1; index >= 0; index -= 1) {
            const tuple = (await readContract(getWagmiConfig(), {
              address: runtime.tictactoeAddress,
              abi: CONTRACT_ABI,
              functionName: "getGameState",
              args: [BigInt(index)],
            })) as RawGameTuple;

            const game = buildGameSummary(BigInt(index), tuple);
            const isParticipant =
              game.player1.toLowerCase() === playerAddress.toLowerCase() ||
              game.player2.toLowerCase() === playerAddress.toLowerCase();
            if (isParticipant && game.state < 2) {
              targetGameId = game.id;
              break;
            }
          }
        } catch {
          // 自动探测失败时不阻断页面使用，保持当前 UI 可交互。
        }

        set({
          gameId: targetGameId,
          restoredGameId:
            shouldTrackRestoreHint &&
            previousGameId === undefined &&
            targetGameId !== undefined
              ? targetGameId
              : undefined,
        });
        if (targetGameId !== undefined) {
          await get().syncGameStatusFast();
        } else {
          set({ gameStatus: undefined, board: [...EMPTY_BOARD] });
        }
      } finally {
        set({ isAutoRestoringGame: false });
      }
    },

    // 刷新大厅列表：拉取全部对局并解析展示地址。
    refreshGameList: async () => {
      set({ isGameListLoading: true });
      try {
        const runtime = await withRuntimeConfig();
        const gameCounter = asNumber(
          await readContract(getWagmiConfig(), {
            address: runtime.tictactoeAddress,
            abi: CONTRACT_ABI,
            functionName: "gameCounter",
          }),
          0
        );

        const summaries = await Promise.all(
          Array.from({ length: gameCounter }, async (_, index) => {
            const tuple = (await readContract(getWagmiConfig(), {
              address: runtime.tictactoeAddress,
              abi: CONTRACT_ABI,
              functionName: "getGameState",
              args: [BigInt(index)],
            })) as RawGameTuple;
            return buildGameSummary(BigInt(index), tuple);
          })
        );

        const gameList = await Promise.all(
          summaries.map(async (summary) => {
            const [player1, player2] = await Promise.all([
              resolveDisplayAddress(runtime.sessionFactoryAddress, summary.player1),
              resolveDisplayAddress(runtime.sessionFactoryAddress, summary.player2),
            ]);

            return {
              ...summary,
              player1,
              player2,
            };
          })
        );

        set({ gameList });
      } catch (error) {
        console.error(error);
        toast.error("刷新对局列表失败");
      } finally {
        set({ isGameListLoading: false });
      }
    },

    // 显式状态同步入口（带错误提示）。
    fetchGameStatus: async () => {
      await runGameStatusSync(true);
    },

    // 读取当前账户历史战绩：分页查询并映射为前端展示结构。
    fetchMyHistory: async (page = 1) => {
    set({ isHistoryLoading: true });
    try {
      const runtime = await withRuntimeConfig();
      const owner = getAccount(getWagmiConfig()).address as Address | undefined;
      if (!owner) {
        set({
          historyRecords: [],
          historyTotal: 0,
          historyPage: 1,
          isHistoryLoading: false,
        });
        return;
      }

      const accountOf = (await readContract(getWagmiConfig(), {
        address: runtime.sessionFactoryAddress,
        abi: SESSION_FACTORY_ABI,
        functionName: "accountOf",
        args: [owner],
      })) as Address;

      const historyOwner =
        isAddress(accountOf) && accountOf !== zeroAddress ? accountOf : owner;

      const historyTotal = asNumber(
        await readContract(getWagmiConfig(), {
          address: runtime.tictactoeAddress,
          abi: CONTRACT_ABI,
          functionName: "getPlayerHistoryCount",
          args: [historyOwner],
        }),
        0
      );

      const targetPage = clampPage(page, historyTotal, PAGE_SIZE);
      const offset = BigInt((targetPage - 1) * PAGE_SIZE);
      const rows =
        historyTotal > 0
          ? ((await readContract(getWagmiConfig(), {
              address: runtime.tictactoeAddress,
              abi: CONTRACT_ABI,
              functionName: "getPlayerHistoryPage",
              args: [historyOwner, offset, BigInt(PAGE_SIZE)],
            })) as RawHistoryRow[])
          : [];

      const historyRecords: HistoryRecord[] = await Promise.all(
        rows.map(async (row) => ({
          gameId: asBigInt(row.gameId),
          opponent: await resolveDisplayAddress(
            runtime.sessionFactoryAddress,
            asAddress(row.opponent)
          ),
          result: mapHistoryResult(asNumber(row.result, 0)),
          scoreDelta: asNumber(row.scoreDelta, 0),
          endedAt: asBigInt(row.endedAt),
        }))
      );

      set({
        historyRecords,
        historyTotal,
        historyPage: targetPage,
      });
    } catch (error) {
      console.error(error);
      toast.error("读取历史记录失败");
    } finally {
      set({ isHistoryLoading: false });
    }
    },

    // 读取排行榜：优先命中本地缓存，失效后重新全量拉取并排序分页。
    fetchLeaderboard: async (page = 1, forceRefresh = false) => {
    set({ isLeaderboardLoading: true });
    try {
      const runtime = await withRuntimeConfig();
      const cacheKey = buildLeaderboardCacheKey(runtime);
      const cached = leaderboardCacheByKey.get(cacheKey);
      const cacheStillValid =
        !forceRefresh &&
        cached &&
        Date.now() - cached.updatedAt < LEADERBOARD_CACHE_TTL_MS;
      if (cacheStillValid && cached) {
        const targetPage = clampPage(page, cached.total, PAGE_SIZE);
        set({
          leaderboardTotal: cached.total,
          leaderboardPage: targetPage,
          leaderboardRecords: slicePage(cached.records, targetPage, PAGE_SIZE),
          leaderboardLastUpdatedAt: cached.updatedAt,
        });
        return;
      }

      const leaderboardTotal = asNumber(
        await readContract(getWagmiConfig(), {
          address: runtime.tictactoeAddress,
          abi: CONTRACT_ABI,
          functionName: "getLeaderboardCount",
        }),
        0
      );

      // 先拉全量、再本地排序、最后分页，才能保证跨页排名与排序规则完全一致。
      // 如果直接向合约按页读取并展示，会因为合约返回的是原始顺序而打乱全局名次。
      const offsets = pageOffsets(leaderboardTotal, PAGE_SIZE);
      const rawRows: RawLeaderboardRow[] = [];

      for (const offset of offsets) {
        const rows = (await readContract(getWagmiConfig(), {
          address: runtime.tictactoeAddress,
          abi: CONTRACT_ABI,
          functionName: "getLeaderboardPage",
          args: [BigInt(offset), BigInt(PAGE_SIZE)],
        })) as RawLeaderboardRow[];
        rawRows.push(...rows);
      }

      const allRecords: LeaderboardRecord[] = [];
      for (const row of rawRows) {
        const player = asAddress(row.player);
        const displayAddress = await resolveDisplayAddress(
          runtime.sessionFactoryAddress,
          player
        );

        allRecords.push({
          player,
          displayAddress,
          gamesPlayed: asBigInt(row.gamesPlayed),
          totalScore: asBigInt(row.totalScore),
        });
      }

      const sorted = [...allRecords].sort(compareLeaderboardRecords);
      const targetPage = clampPage(page, leaderboardTotal, PAGE_SIZE);
      const leaderboardRecords = slicePage(sorted, targetPage, PAGE_SIZE);
      const updatedAt = Date.now();
      leaderboardCacheByKey.set(cacheKey, {
        cacheKey,
        records: sorted,
        total: leaderboardTotal,
        updatedAt,
      });

      set({
        leaderboardTotal,
        leaderboardPage: targetPage,
        leaderboardRecords,
        leaderboardLastUpdatedAt: updatedAt,
      });
    } catch (error) {
      console.error(error);
      toast.error("读取排行榜失败");
    } finally {
      set({ isLeaderboardLoading: false });
    }
  },

    // 读取规则元信息：成功走链上值，失败回退默认配置。
    fetchRulesMeta: async () => {
    set({ isRulesLoading: true });
    try {
      const runtime = await withRuntimeConfig();
      const timeout = asNumber(
        await readContract(getWagmiConfig(), {
          address: runtime.tictactoeAddress,
          abi: CONTRACT_ABI,
          functionName: "DEFAULT_TURN_TIMEOUT",
        }),
        600
      );

      set({
        rulesMeta: {
          ...createDefaultRulesMeta(),
          turnTimeoutSeconds: timeout,
          loaded: true,
          usingFallback: false,
        },
      });
    } catch {
      set({
        rulesMeta: {
          ...createDefaultRulesMeta(),
          loaded: true,
          usingFallback: true,
        },
      });
    } finally {
      set({ isRulesLoading: false });
    }
  },

    // 创建对局：优先会话开局，失败后回退直连钱包写链。
    createGame: async () => {
      const owner = requireConnectedOwner();
      if (!owner) {
        return;
      }

      await runOpeningAction({
        owner,
        action: "create",
        functionName: "createGame",
        args: [],
        awaitingMessage: "请在钱包中确认创建对局",
        confirmingMessage: "交易已提交，等待链上确认...",
        successMessage: "对局创建成功",
        errorMessage: "创建对局失败，请重试。",
        successState: {
          highlightedGameId: undefined,
        },
        postSuccess: () => {
          set({ showResult: false });
        },
      });
    },

    // 加入对局：优先会话开局加入，失败后回退直连钱包写链。
    joinGame: async (targetGameId) => {
      const owner = requireConnectedOwner();
      if (!owner) {
        return;
      }

      await runOpeningAction({
        owner,
        action: "join",
        functionName: "joinGame",
        args: [targetGameId],
        awaitingMessage: "请在钱包中确认加入对局",
        confirmingMessage: "交易已提交，等待链上确认...",
        successMessage: "加入对局成功",
        errorMessage: "加入对局失败，请重试。",
        successState: {
          showGameList: false,
          highlightedGameId: undefined,
        },
      });
    },

    // 从大厅继续指定对局，并立即同步当前局状态。
    continueGame: async (targetGameId) => {
      set({
        gameId: targetGameId,
        showGameList: false,
        highlightedGameId: undefined,
        restoredGameId: undefined,
      });
      await get().syncGameStatusFast();
    },

    // 落子动作：包含回合校验、会话优先写链与完成后状态刷新。
    makeMove: async (position) => {
      const context = requireInGameContext();
      if (!context) {
        return;
      }
      if (context.gameStatus.state !== 1) {
        toast.error("当前对局不在进行中");
        return;
      }
      if (
        context.gameStatus.currentTurn.toLowerCase() !== context.player.toLowerCase()
      ) {
        toast.error("当前不是你的回合");
        return;
      }

      await runInGameAction({
        context,
        action: "move",
        sessionAction: "makeMove",
        args: [context.gameId, position],
        awaitingMessage: "请在钱包中确认落子",
        confirmingMessage: "落子已提交，等待链上确认...",
        successMessage: "落子成功",
        errorMessage: "落子失败，请重试。",
        postSuccess: async () => {
          await get().syncGameStatusFast();
          if (get().gameStatus?.state === 2) {
            get().invalidateLeaderboardCache();
          }
        },
      });
    },

    // 取消等待局：仅创建者可执行，成功后弹出结果并刷新大厅。
    cancelGame: async () => {
      const context = requireInGameContext();
      if (!context) {
        return;
      }
      if (context.gameStatus.state !== 0) {
        toast.error("仅等待阶段可取消对局");
        return;
      }
      if (
        context.gameStatus.player1.toLowerCase() !== context.player.toLowerCase()
      ) {
        toast.error("仅创建者可取消对局");
        return;
      }

      await runInGameAction({
        context,
        action: "cancel",
        sessionAction: "cancelGame",
        args: [context.gameId],
        awaitingMessage: "请在钱包中确认取消对局",
        confirmingMessage: "取消请求已提交，等待链上确认...",
        successMessage: "对局已取消",
        errorMessage: "取消对局失败，请重试。",
        successState: {
          showResult: true,
        },
        postSuccess: async () => {
          await get().syncGameStatusFast();
          await get().refreshGameList();
        },
      });
    },

    // 认输动作：成功后刷新历史与排行榜，并展示结算弹窗。
    resign: async () => {
      const context = requireParticipantContext();
      if (!context) {
        return;
      }
      if (context.gameStatus.state !== 1) {
        toast.error("仅进行中的对局可认输");
        return;
      }

      await runInGameAction({
        context,
        action: "resign",
        sessionAction: "resign",
        args: [context.gameId],
        awaitingMessage: "请在钱包中确认认输",
        confirmingMessage: "认输请求已提交，等待链上确认...",
        successMessage: "认输已提交",
        errorMessage: "认输失败，请重试。",
        successState: {
          showResult: true,
        },
        postSuccess: async () => {
          get().invalidateLeaderboardCache();
          await get().syncGameStatusFast();
          await Promise.all([
            get().fetchMyHistory(get().historyPage),
            get().fetchLeaderboard(get().leaderboardPage, true),
          ]);
        },
      });
    },

    // 超时判胜：仅非当前回合参与方可发起，成功后联动刷新统计。
    claimTimeoutWin: async () => {
      const context = requireParticipantContext();
      if (!context) {
        return;
      }
      if (context.gameStatus.state !== 1) {
        toast.error("仅进行中的对局可执行超时判胜");
        return;
      }
      if (
        context.gameStatus.currentTurn.toLowerCase() === context.player.toLowerCase()
      ) {
        toast.error("当前轮到你落子，无法发起超时判胜");
        return;
      }

      await runInGameAction({
        context,
        action: "timeout",
        sessionAction: "claimTimeoutWin",
        args: [context.gameId],
        awaitingMessage: "请在钱包中确认超时判胜",
        confirmingMessage: "请求已提交，等待链上确认...",
        successMessage: "超时判胜成功",
        errorMessage: "超时判胜失败，请重试。",
        successState: {
          showResult: true,
        },
        postSuccess: async () => {
          get().invalidateLeaderboardCache();
          await get().syncGameStatusFast();
          await Promise.all([
            get().fetchMyHistory(get().historyPage),
            get().fetchLeaderboard(get().leaderboardPage, true),
          ]);
        },
      });
    },
  };
});
