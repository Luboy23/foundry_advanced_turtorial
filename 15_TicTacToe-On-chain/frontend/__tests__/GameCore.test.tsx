import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import GameCore from "@/components/GameCore";
import { PROJECT_NAME_ZH } from "@/lib/projectBrand";

const mockUseAccount = jest.fn();
const mockUseChainId = jest.fn();
const mockUseSwitchChain = jest.fn();
const mockUseWatchContractEvent = jest.fn();
const mockRefreshGameList = jest.fn();
const mockFetchMyHistory = jest.fn();
const mockFetchLeaderboard = jest.fn();
const mockFetchRulesMeta = jest.fn();
const mockSyncGameStatusFast = jest.fn();
const mockHandleInviteGame = jest.fn();

type MockGameStatus = {
  gameId: bigint;
  player1: string;
  player2: string;
  currentTurn: string;
  board: Array<string | null>;
  state: number;
  winner: string;
  lastMoveAt: bigint;
  turnTimeoutSeconds: bigint;
};

type MockStore = {
  [key: string]: unknown;
  gameId: bigint | undefined;
  setShowGameList: jest.Mock;
  showGameList: boolean;
  showHistoryDialog: boolean;
  showLeaderboardDialog: boolean;
  showRulesDialog: boolean;
  setShowHistoryDialog: jest.Mock;
  setShowLeaderboardDialog: jest.Mock;
  setShowRulesDialog: jest.Mock;
  createGame: jest.Mock;
  isLoading: boolean;
  isGameListLoading: boolean;
  autoDetectGame: jest.Mock;
  refreshGameList: jest.Mock;
  fetchMyHistory: jest.Mock;
  fetchLeaderboard: jest.Mock;
  fetchRulesMeta: jest.Mock;
  syncGameStatusFast: jest.Mock;
  historyRecords: unknown[];
  leaderboardRecords: unknown[];
  historyTotal: number;
  leaderboardTotal: number;
  historyPage: number;
  leaderboardPage: number;
  setShowResult: jest.Mock;
  setNetworkMismatch: jest.Mock;
  clearActionFeedback: jest.Mock;
  isAutoRestoringGame: boolean;
  gameStatus: MockGameStatus | undefined;
  board: Array<string | null>;
  winner: string | null;
  cancelGame: jest.Mock;
  resign: jest.Mock;
  claimTimeoutWin: jest.Mock;
  handleInviteGame: jest.Mock;
  invalidateLeaderboardCache: jest.Mock;
  activeAction: string | undefined;
  actionPhase: string;
  actionMessage: string | undefined;
  networkMismatch: boolean;
  playerAddress: string | undefined;
  restoredGameId: bigint | undefined;
  setRestoredGameId: jest.Mock;
  sessionStatus: string;
  sessionCallsLeft: number | undefined;
  rulesMeta: {
    turnTimeoutSeconds: number;
    loaded: boolean;
    usingFallback: boolean;
    scoring: {
      win: number;
      draw: number;
      loss: number;
      cancelCounts: boolean;
    };
  };
  returnToHome: jest.Mock;
};

// 模拟 wagmi 相关 hooks，隔离外部钱包与链连接依赖。
jest.mock("wagmi", () => ({
  useAccount: () => mockUseAccount(),
  useChainId: () => mockUseChainId(),
  useSwitchChain: () => mockUseSwitchChain(),
  useWatchContractEvent: (config: unknown) => mockUseWatchContractEvent(config),
}));

// 搜索参数在该测试集中不关注，统一返回空。
jest.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: jest.fn(() => null),
  }),
}));

// 连接按钮对本测试不重要，使用空组件替代。
jest.mock("@rainbow-me/rainbowkit", () => ({
  ConnectButton: function MockConnectButton() {
    return null;
  },
}));

// 运行时配置仅保留链 ID，满足网络判断逻辑即可。
jest.mock("@/constants", () => ({
  ContractConfig: {},
  getResolvedRuntimeConfig: () => ({
    chainId: 31337,
  }),
}));

// 子组件全部替换为占位组件，聚焦 GameCore 编排逻辑测试。
jest.mock("@/components/GameList", () => function MockGameList() {
  return <div>mock-game-list</div>;
});
jest.mock("@/components/GameBoard", () => function MockGameBoard() {
  return <div>mock-game-board</div>;
});
jest.mock("@/components/GameStatus", () => function MockGameStatus() {
  return <div>mock-game-status</div>;
});
jest.mock("@/components/GameResult", () => function MockGameResult() {
  return <div>mock-game-result</div>;
});
jest.mock("@/components/RulesDialogContent", () => function MockRulesDialogContent() {
  return <div>mock-rules-content</div>;
});

// store mock：仅保留本测试用到的字段与动作。
const mockStore: MockStore = {
  gameId: undefined,
  setShowGameList: jest.fn(),
  showGameList: false,
  showHistoryDialog: false,
  showLeaderboardDialog: false,
  showRulesDialog: false,
  setShowHistoryDialog: jest.fn(),
  setShowLeaderboardDialog: jest.fn(),
  setShowRulesDialog: jest.fn(),
  createGame: jest.fn(),
  isLoading: false,
  isGameListLoading: false,
  autoDetectGame: jest.fn(),
  refreshGameList: mockRefreshGameList,
  fetchMyHistory: mockFetchMyHistory,
  fetchLeaderboard: mockFetchLeaderboard,
  fetchRulesMeta: mockFetchRulesMeta,
  syncGameStatusFast: mockSyncGameStatusFast,
  historyRecords: [],
  leaderboardRecords: [],
  historyTotal: 0,
  leaderboardTotal: 0,
  historyPage: 1,
  leaderboardPage: 1,
  setShowResult: jest.fn(),
  setNetworkMismatch: jest.fn(),
  clearActionFeedback: jest.fn(),
  isAutoRestoringGame: false,
  gameStatus: undefined,
  board: Array<string | null>(9).fill(null),
  winner: null,
  cancelGame: jest.fn(),
  resign: jest.fn(),
  claimTimeoutWin: jest.fn(),
  handleInviteGame: mockHandleInviteGame,
  invalidateLeaderboardCache: jest.fn(),
  activeAction: undefined,
  actionPhase: "idle",
  actionMessage: undefined,
  networkMismatch: false,
  playerAddress: undefined,
  restoredGameId: undefined,
  setRestoredGameId: jest.fn(),
  sessionStatus: "idle",
  sessionCallsLeft: undefined,
  rulesMeta: {
    turnTimeoutSeconds: 600,
    loaded: true,
    usingFallback: false,
    scoring: {
      win: 1,
      draw: 0,
      loss: -1,
      cancelCounts: false,
    },
  },
  returnToHome: jest.fn(),
};

jest.mock("@/store/useGameStore", () => ({
  useGameStore: () => mockStore,
}));

describe("GameCore", () => {
  let visibilityState: "visible" | "hidden" = "visible";

  // 驱动 visibilitychange 事件，模拟页面前后台切换。
  const setVisibilityState = (state: "visible" | "hidden") => {
    visibilityState = state;
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
  };

  // 每个用例初始化定时器、可见性与 mock 返回值。
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    window.history.replaceState({}, "", "/");
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibilityState,
    });
    visibilityState = "visible";

    mockUseAccount.mockReturnValue({
      isConnected: false,
      address: undefined,
    });
    mockUseChainId.mockReturnValue(31337);
    mockUseSwitchChain.mockReturnValue({
      switchChainAsync: jest.fn(),
      isPending: false,
    });
    mockRefreshGameList.mockResolvedValue(undefined);
    mockFetchMyHistory.mockResolvedValue(undefined);
    mockFetchLeaderboard.mockResolvedValue(undefined);
    mockFetchRulesMeta.mockResolvedValue(undefined);
    mockSyncGameStatusFast.mockResolvedValue(undefined);
    mockHandleInviteGame.mockResolvedValue("browse");
    mockStore.showGameList = false;
    mockStore.showHistoryDialog = false;
    mockStore.showLeaderboardDialog = false;
    mockStore.showRulesDialog = false;
    mockStore.gameId = undefined;
    mockStore.gameStatus = undefined;
    mockStore.activeAction = undefined;
    mockStore.actionPhase = "idle";
    mockStore.actionMessage = undefined;
    mockStore.playerAddress = undefined;
    mockStore.restoredGameId = undefined;
    mockStore.isAutoRestoringGame = false;
    mockStore.historyRecords = [];
    mockStore.leaderboardRecords = [];
    mockStore.historyTotal = 0;
    mockStore.leaderboardTotal = 0;
  });

  // 释放 fake timers，避免跨用例残留。
  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  // 断言：首页保留标题与精简操作区，不再展示顶部步骤引导。
  it("renders the simplified homepage header without staged guidance", () => {
    render(<GameCore />);
    expect(screen.getByText(PROJECT_NAME_ZH)).toBeInTheDocument();
    expect(screen.queryByText("1 连接钱包")).not.toBeInTheDocument();
    expect(screen.queryByText("创建或加入一局对战")).not.toBeInTheDocument();
    expect(screen.queryByText("准备开始新对局")).not.toBeInTheDocument();
  });

  // 断言：首页主入口应收敛到紧凑按钮栏，并沿用原有动作。
  it("shows home actions in the compact action bar and wires them to the existing handlers", () => {
    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: "0x0000000000000000000000000000000000000001",
    });

    render(<GameCore />);

    fireEvent.click(screen.getByRole("button", { name: "创建对局" }));
    expect(mockStore.createGame).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "进入大厅" }));
    expect(mockStore.setShowGameList).toHaveBeenCalledWith(true);
  });

  it("shows compact home feedback for create and join actions", () => {
    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: "0x0000000000000000000000000000000000000001",
    });
    mockStore.activeAction = "create";
    mockStore.actionPhase = "awaiting_signature";
    mockStore.actionMessage = "请在钱包中确认创建对局";

    render(<GameCore />);

    expect(screen.getByText("等待签名")).toBeInTheDocument();
    expect(screen.getByText("请在钱包中确认创建对局")).toBeInTheDocument();
  });

  it("shows a lightweight auto-restore hint while scanning for unfinished games", () => {
    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: "0x0000000000000000000000000000000000000001",
    });
    mockStore.isAutoRestoringGame = true;

    render(<GameCore />);

    expect(screen.getByText("正在检查可继续对局...")).toBeInTheDocument();
  });

  // 断言：大厅打开后应立刻刷新一次并每 3 秒轮询。
  it("refreshes game list immediately and every 3s while dialog is open", async () => {
    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: "0x0000000000000000000000000000000000000001",
    });
    mockStore.showGameList = true;

    const { unmount } = render(<GameCore />);

    await waitFor(() => {
      expect(mockRefreshGameList).toHaveBeenCalledTimes(1);
    });

    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(mockRefreshGameList).toHaveBeenCalledTimes(2);

    act(() => {
      jest.advanceTimersByTime(6000);
    });
    expect(mockRefreshGameList).toHaveBeenCalledTimes(4);

    unmount();
    act(() => {
      jest.advanceTimersByTime(6000);
    });
    expect(mockRefreshGameList).toHaveBeenCalledTimes(4);
  });

  // 断言：进行中对局应立刻同步一次并每 1 秒轮询。
  it("syncs active game immediately and every 1s while page is visible", async () => {
    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: "0x0000000000000000000000000000000000000001",
    });
    mockStore.gameId = BigInt(1);
    mockStore.gameStatus = {
      gameId: BigInt(1),
      player1: "0x0000000000000000000000000000000000000001",
      player2: "0x0000000000000000000000000000000000000002",
      currentTurn: "0x0000000000000000000000000000000000000001",
      board: Array(9).fill(null),
      state: 1,
      winner: "0x0000000000000000000000000000000000000000",
      lastMoveAt: BigInt(0),
      turnTimeoutSeconds: BigInt(600),
    };

    const { unmount } = render(<GameCore />);

    await waitFor(() => {
      expect(mockSyncGameStatusFast).toHaveBeenCalledTimes(1);
    });

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(mockSyncGameStatusFast).toHaveBeenCalledTimes(3);

    unmount();
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(mockSyncGameStatusFast).toHaveBeenCalledTimes(3);
  });

  // 断言：页面隐藏时暂停轮询，恢复可见后立即补拉一次。
  it("pauses polling when page is hidden and immediately syncs when visible again", async () => {
    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: "0x0000000000000000000000000000000000000001",
    });
    mockStore.gameId = BigInt(2);
    mockStore.gameStatus = {
      gameId: BigInt(2),
      player1: "0x0000000000000000000000000000000000000001",
      player2: "0x0000000000000000000000000000000000000002",
      currentTurn: "0x0000000000000000000000000000000000000002",
      board: Array(9).fill(null),
      state: 1,
      winner: "0x0000000000000000000000000000000000000000",
      lastMoveAt: BigInt(0),
      turnTimeoutSeconds: BigInt(600),
    };

    render(<GameCore />);

    await waitFor(() => {
      expect(mockSyncGameStatusFast).toHaveBeenCalledTimes(1);
    });

    setVisibilityState("hidden");
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(mockSyncGameStatusFast).toHaveBeenCalledTimes(1);

    setVisibilityState("visible");
    expect(mockSyncGameStatusFast).toHaveBeenCalledTimes(2);

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(mockSyncGameStatusFast).toHaveBeenCalledTimes(3);
  });

  // 断言：MoveMade 事件命中当前局时应走快速同步通道。
  it("uses fast sync path when MoveMade event matches current game", () => {
    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: "0x0000000000000000000000000000000000000001",
    });
    mockStore.gameId = BigInt(3);
    mockStore.gameStatus = {
      gameId: BigInt(3),
      player1: "0x0000000000000000000000000000000000000001",
      player2: "0x0000000000000000000000000000000000000002",
      currentTurn: "0x0000000000000000000000000000000000000002",
      board: Array(9).fill(null),
      state: 0,
      winner: "0x0000000000000000000000000000000000000000",
      lastMoveAt: BigInt(0),
      turnTimeoutSeconds: BigInt(600),
    };

    render(<GameCore />);

    const watcherConfig = mockUseWatchContractEvent.mock.calls
      .map(([config]) => config as { eventName?: string; onLogs?: (logs: unknown[]) => void })
      .find((config) => config.eventName === "MoveMade");

    expect(watcherConfig?.onLogs).toBeDefined();
    act(() => {
      watcherConfig?.onLogs?.([{ args: { gameId: BigInt(3) } }]);
    });

    expect(mockSyncGameStatusFast).toHaveBeenCalledTimes(1);
  });

  // 断言：未连接钱包时只保留最小入口，不再显示旧的连接引导按钮。
  it("keeps the homepage minimal when wallet is not connected", () => {
    render(<GameCore />);
    expect(screen.getByRole("button", { name: "规则说明" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "创建对局" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "进入大厅" })).not.toBeInTheDocument();
  });

  // 断言：点击规则按钮会触发 store 的打开动作。
  it("opens rules dialog via store action", () => {
    render(<GameCore />);
    screen.getByRole("button", { name: "规则说明" }).click();
    expect(mockStore.setShowRulesDialog).toHaveBeenCalledWith(true);
  });

  it("shows restored game banner when restoredGameId exists", () => {
    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: "0x0000000000000000000000000000000000000001",
    });
    mockStore.restoredGameId = BigInt(12);

    render(<GameCore />);

    expect(
      screen.getByText("已自动恢复你未结束的对局 #12")
    ).toBeInTheDocument();
  });

  it("handles the same invite link only once for the same address and gameId", async () => {
    window.history.replaceState({}, "", "/?gameId=7");
    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: "0x0000000000000000000000000000000000000001",
    });

    const firstHandler = jest.fn().mockResolvedValue("browse");
    const secondHandler = jest.fn().mockResolvedValue("browse");
    mockStore.handleInviteGame = firstHandler;

    const { rerender } = render(<GameCore />);

    await waitFor(() => {
      expect(firstHandler).toHaveBeenCalledWith(
        BigInt(7),
        "0x0000000000000000000000000000000000000001"
      );
    });

    mockStore.handleInviteGame = secondHandler;
    rerender(<GameCore />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(secondHandler).not.toHaveBeenCalled();
  });

  it("runs shared settlement refresh effects for GameWon on the current game", async () => {
    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: "0x0000000000000000000000000000000000000001",
    });
    mockStore.gameId = BigInt(8);
    mockStore.showGameList = true;
    mockStore.showHistoryDialog = true;
    mockStore.showLeaderboardDialog = true;
    mockStore.gameStatus = {
      gameId: BigInt(8),
      player1: "0x0000000000000000000000000000000000000001",
      player2: "0x0000000000000000000000000000000000000002",
      currentTurn: "0x0000000000000000000000000000000000000002",
      board: Array(9).fill(null),
      state: 1,
      winner: "0x0000000000000000000000000000000000000000",
      lastMoveAt: BigInt(0),
      turnTimeoutSeconds: BigInt(600),
    };

    render(<GameCore />);

    await waitFor(() => {
      expect(mockRefreshGameList).toHaveBeenCalledTimes(1);
    });
    mockRefreshGameList.mockClear();
    mockFetchMyHistory.mockClear();
    mockFetchLeaderboard.mockClear();
    mockSyncGameStatusFast.mockClear();
    mockStore.setShowResult.mockClear();
    mockStore.invalidateLeaderboardCache.mockClear();

    const watcherConfig = mockUseWatchContractEvent.mock.calls
      .map(([config]) => config as { eventName?: string; onLogs?: (logs: unknown[]) => void })
      .find((config) => config.eventName === "GameWon");

    act(() => {
      watcherConfig?.onLogs?.([{ args: { gameId: BigInt(8) } }]);
    });

    expect(mockSyncGameStatusFast).toHaveBeenCalledTimes(1);
    expect(mockStore.setShowResult).toHaveBeenCalledWith(true);
    expect(mockStore.invalidateLeaderboardCache).toHaveBeenCalledTimes(1);
    expect(mockFetchMyHistory).toHaveBeenCalledWith(1);
    expect(mockFetchLeaderboard).toHaveBeenCalledWith(1, true);
    expect(mockRefreshGameList).toHaveBeenCalledTimes(1);
  });

  it("keeps GameCancelled settlement refresh scoped to result and lobby only", () => {
    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: "0x0000000000000000000000000000000000000001",
    });
    mockStore.gameId = BigInt(9);
    mockStore.showGameList = true;
    mockStore.showHistoryDialog = true;
    mockStore.showLeaderboardDialog = true;
    mockStore.gameStatus = {
      gameId: BigInt(9),
      player1: "0x0000000000000000000000000000000000000001",
      player2: "0x0000000000000000000000000000000000000002",
      currentTurn: "0x0000000000000000000000000000000000000002",
      board: Array(9).fill(null),
      state: 1,
      winner: "0x0000000000000000000000000000000000000000",
      lastMoveAt: BigInt(0),
      turnTimeoutSeconds: BigInt(600),
    };

    render(<GameCore />);
    mockRefreshGameList.mockClear();
    mockFetchMyHistory.mockClear();
    mockFetchLeaderboard.mockClear();
    mockSyncGameStatusFast.mockClear();
    mockStore.setShowResult.mockClear();
    mockStore.invalidateLeaderboardCache.mockClear();

    const watcherConfig = mockUseWatchContractEvent.mock.calls
      .map(([config]) => config as { eventName?: string; onLogs?: (logs: unknown[]) => void })
      .find((config) => config.eventName === "GameCancelled");

    act(() => {
      watcherConfig?.onLogs?.([{ args: { gameId: BigInt(9) } }]);
    });

    expect(mockSyncGameStatusFast).toHaveBeenCalledTimes(1);
    expect(mockStore.setShowResult).toHaveBeenCalledWith(true);
    expect(mockRefreshGameList).toHaveBeenCalledTimes(1);
    expect(mockFetchMyHistory).not.toHaveBeenCalled();
    expect(mockFetchLeaderboard).not.toHaveBeenCalled();
    expect(mockStore.invalidateLeaderboardCache).not.toHaveBeenCalled();
  });

  it("shows switch-network entry and blocks create action on wrong chain", () => {
    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: "0x0000000000000000000000000000000000000001",
    });
    mockUseChainId.mockReturnValue(1);

    render(<GameCore />);

    expect(screen.getByRole("button", { name: "切换到本地测试链" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "创建对局" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "进入大厅" })).not.toBeInTheDocument();
  });
});
