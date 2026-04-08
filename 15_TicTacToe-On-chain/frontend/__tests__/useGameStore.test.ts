import { useGameStore } from "@/store/useGameStore";
import {
  getAccount,
  readContract,
  simulateContract,
  waitForTransactionReceipt,
  writeContract,
} from "wagmi/actions";
import {
  clearSession,
  getSessionStatus,
  setupRoundSession,
} from "@/lib/sessionClient";
import { toast } from "sonner";

const mockRuntimeConfig = {
  tictactoeAddress: "0x0000000000000000000000000000000000000001",
  sessionFactoryAddress: "0x0000000000000000000000000000000000000002",
  rpcUrl: "http://127.0.0.1:8545",
  chainId: 31337,
};

// mock wagmi config，避免真实钱包/链交互。
jest.mock("@/components/web3/config", () => ({
  getAppConfig: jest.fn(() => ({})),
}));

jest.mock("@/constants", () => ({
  CONTRACT_ABI: [
    {
      type: "function",
      name: "createGame",
      stateMutability: "nonpayable",
      inputs: [],
      outputs: [],
    },
    {
      type: "function",
      name: "joinGame",
      stateMutability: "nonpayable",
      inputs: [{ name: "gameId", type: "uint256" }],
      outputs: [],
    },
    {
      type: "function",
      name: "makeMove",
      stateMutability: "nonpayable",
      inputs: [
        { name: "gameId", type: "uint256" },
        { name: "position", type: "uint8" },
      ],
      outputs: [],
    },
    {
      type: "function",
      name: "cancelGame",
      stateMutability: "nonpayable",
      inputs: [{ name: "gameId", type: "uint256" }],
      outputs: [],
    },
    {
      type: "function",
      name: "resign",
      stateMutability: "nonpayable",
      inputs: [{ name: "gameId", type: "uint256" }],
      outputs: [],
    },
    {
      type: "function",
      name: "claimTimeoutWin",
      stateMutability: "nonpayable",
      inputs: [{ name: "gameId", type: "uint256" }],
      outputs: [],
    },
  ],
  SESSION_FACTORY_ABI: [],
  ContractConfig: {
    address: "0x0000000000000000000000000000000000000001",
    abi: [],
  },
  SessionFactoryConfig: {
    address: "0x0000000000000000000000000000000000000002",
    abi: [],
  },
  getResolvedRuntimeConfig: jest.fn(() => mockRuntimeConfig),
  loadRuntimeContractConfig: jest.fn(async () => mockRuntimeConfig),
}));

// mock toast，便于断言且避免测试日志噪音。
jest.mock("sonner", () => {
  const toast = jest.fn();
  (toast as unknown as { success: jest.Mock; error: jest.Mock }).success = jest.fn();
  (toast as unknown as { success: jest.Mock; error: jest.Mock }).error = jest.fn();
  return { toast };
});

// mock wagmi actions，只测试 store 行为编排。
jest.mock("wagmi/actions", () => ({
  readContract: jest.fn(),
  getAccount: jest.fn(() => ({ address: undefined })),
  simulateContract: jest.fn(),
  waitForTransactionReceipt: jest.fn(),
  writeContract: jest.fn(),
}));

// mock 会话客户端，隔离会话创建与交易发送副作用。
jest.mock("@/lib/sessionClient", () => ({
  clearSession: jest.fn(),
  getPlayerAddress: jest.fn(async (owner) => owner),
  getSession: jest.fn(() => undefined),
  getSessionStatus: jest.fn(() => "idle"),
  refreshSession: jest.fn(),
  sendGameAction: jest.fn(),
  setupRoundSession: jest.fn(),
}));

const mockedReadContract = readContract as jest.MockedFunction<typeof readContract>;
const mockedGetAccount = getAccount as jest.MockedFunction<typeof getAccount>;
const mockedSimulateContract =
  simulateContract as jest.MockedFunction<typeof simulateContract>;
const mockedWriteContract = writeContract as jest.MockedFunction<typeof writeContract>;
const mockedWaitForTransactionReceipt =
  waitForTransactionReceipt as jest.MockedFunction<typeof waitForTransactionReceipt>;
const mockedSetupRoundSession =
  setupRoundSession as jest.MockedFunction<typeof setupRoundSession>;
const mockedGetSessionStatus =
  getSessionStatus as jest.MockedFunction<typeof getSessionStatus>;
const mockedClearSession = clearSession as jest.MockedFunction<typeof clearSession>;
const mockedToastError = (toast as unknown as { error: jest.Mock }).error;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const toAddress = (index: number) =>
  `0x${index.toString(16).padStart(40, "0")}`;
const initialStoreMethods = {
  autoDetectGame: useGameStore.getState().autoDetectGame,
  syncGameStatusFast: useGameStore.getState().syncGameStatusFast,
  refreshGameList: useGameStore.getState().refreshGameList,
  fetchMyHistory: useGameStore.getState().fetchMyHistory,
  fetchLeaderboard: useGameStore.getState().fetchLeaderboard,
};

// 构造最小化 game state 返回值，便于复用。
const mockGameState = (
  player1: string,
  player2: string,
  state: number
): [
  string,
  string,
  string,
  bigint[],
  number,
  string
] => [player1, player2, player1, Array(9).fill(BigInt(0)), state, "0x0000000000000000000000000000000000000000"];

describe("useGameStore.refreshGameList", () => {
  // 每个用例重置 store 与 readContract 默认行为。
  beforeEach(() => {
    jest.clearAllMocks();
    mockedReadContract.mockReset();
    mockedSimulateContract.mockReset();
    mockedWriteContract.mockReset();
    mockedWaitForTransactionReceipt.mockReset();
    mockedSetupRoundSession.mockReset();
    mockedGetSessionStatus.mockReset();
    mockedClearSession.mockReset();
    Object.assign(mockRuntimeConfig, {
      tictactoeAddress: "0x0000000000000000000000000000000000000001",
      sessionFactoryAddress: "0x0000000000000000000000000000000000000002",
      rpcUrl: "http://127.0.0.1:8545",
      chainId: 31337,
    });
    mockedGetAccount.mockReturnValue({ address: undefined } as never);
    mockedGetSessionStatus.mockReturnValue("idle");
    useGameStore.setState({
      gameId: undefined,
      gameList: [],
      isGameListLoading: false,
      isLoading: false,
      showResult: false,
      activeAction: undefined,
      actionPhase: "idle",
      actionMessage: undefined,
      isAutoRestoringGame: false,
      highlightedGameId: undefined,
      leaderboardLastUpdatedAt: undefined,
      networkMismatch: false,
      historyRecords: [],
      leaderboardRecords: [],
      historyTotal: 0,
      leaderboardTotal: 0,
      historyPage: 1,
      leaderboardPage: 1,
      autoDetectGame: initialStoreMethods.autoDetectGame,
      syncGameStatusFast: initialStoreMethods.syncGameStatusFast,
      refreshGameList: initialStoreMethods.refreshGameList,
      fetchMyHistory: initialStoreMethods.fetchMyHistory,
      fetchLeaderboard: initialStoreMethods.fetchLeaderboard,
      rulesMeta: {
        turnTimeoutSeconds: 600,
        loaded: false,
        usingFallback: true,
        scoring: { win: 1, draw: 0, loss: -1, cancelCounts: false },
      },
    });
    useGameStore.getState().invalidateLeaderboardCache();
    mockedReadContract.mockImplementation(async (_cfg, params) => {
      const fn = (params as { functionName?: string }).functionName;
      if (fn === "ownerOfAccount") return ZERO_ADDRESS as never;
      throw new Error(`unexpected fn ${fn}`);
    });
  });

  // 断言：刷新列表会读取 counter 与各局状态并写入 store。
  it("reads game counter and updates gameList", async () => {
    mockedReadContract.mockImplementation(async (_cfg, params) => {
      const fn = (params as { functionName?: string }).functionName;
      const args = (params as { args?: readonly unknown[] }).args ?? [];
      if (fn === "gameCounter") return BigInt(2) as never;
      if (fn === "getGameState") {
        if ((args[0] as bigint) === BigInt(0)) {
          return mockGameState(
            "0x0000000000000000000000000000000000000011",
            "0x0000000000000000000000000000000000000000",
            0
          ) as never;
        }
        if ((args[0] as bigint) === BigInt(1)) {
          return mockGameState(
            "0x0000000000000000000000000000000000000012",
            "0x0000000000000000000000000000000000000013",
            1
          ) as never;
        }
      }
      if (fn === "ownerOfAccount") return ZERO_ADDRESS as never;
      throw new Error(`unexpected fn ${fn}`);
    });

    await useGameStore.getState().refreshGameList();

    const { gameList, isGameListLoading } = useGameStore.getState();
    expect(isGameListLoading).toBe(false);
    expect(gameList).toHaveLength(2);
    expect(gameList[0]).toMatchObject({
      id: BigInt(0),
      state: 0,
      player1: "0x0000000000000000000000000000000000000011",
    });
    expect(gameList[1]).toMatchObject({
      id: BigInt(1),
      state: 1,
      player2: "0x0000000000000000000000000000000000000013",
    });
  });

  // 断言：刷新列表不应覆盖当前正在进行的 gameId。
  it("does not override current gameId during list refresh", async () => {
    useGameStore.setState({ gameId: BigInt(42) });

    mockedReadContract.mockImplementation(async (_cfg, params) => {
      const fn = (params as { functionName?: string }).functionName;
      if (fn === "gameCounter") return BigInt(1) as never;
      if (fn === "getGameState") {
        return mockGameState(
          "0x00000000000000000000000000000000000000AA",
          "0x00000000000000000000000000000000000000BB",
          1
        ) as never;
      }
      if (fn === "ownerOfAccount") return ZERO_ADDRESS as never;
      throw new Error(`unexpected fn ${fn}`);
    });

    await useGameStore.getState().refreshGameList();

    expect(useGameStore.getState().gameId).toBe(BigInt(42));
    expect(useGameStore.getState().gameList).toHaveLength(1);
  });

  it("handleInviteGame continues directly when the owner is already in an unfinished game", async () => {
    const syncGameStatusFast = jest.fn(async () => undefined);
    useGameStore.setState({ syncGameStatusFast });

    mockedReadContract.mockImplementation(async (_cfg, params) => {
      const fn = (params as { functionName?: string }).functionName;
      if (fn === "getGameState") {
        return mockGameState(
          "0x00000000000000000000000000000000000000AA",
          "0x00000000000000000000000000000000000000BB",
          1
        ) as never;
      }
      throw new Error(`unexpected fn ${fn}`);
    });

    const result = await useGameStore
      .getState()
      .handleInviteGame(BigInt(7), "0x00000000000000000000000000000000000000AA");

    expect(result).toBe("continue");
    expect(useGameStore.getState().gameId).toBe(BigInt(7));
    expect(useGameStore.getState().showGameList).toBe(false);
    expect(syncGameStatusFast).toHaveBeenCalledTimes(1);
  });

  it("handleInviteGame opens the lobby and highlights waiting games for non-participants", async () => {
    const refreshGameList = jest.fn(async () => undefined);
    useGameStore.setState({ refreshGameList });

    mockedReadContract.mockImplementation(async (_cfg, params) => {
      const fn = (params as { functionName?: string }).functionName;
      if (fn === "getGameState") {
        return mockGameState(
          "0x00000000000000000000000000000000000000AA",
          ZERO_ADDRESS,
          0
        ) as never;
      }
      throw new Error(`unexpected fn ${fn}`);
    });

    const result = await useGameStore
      .getState()
      .handleInviteGame(BigInt(8), "0x00000000000000000000000000000000000000CC");

    expect(result).toBe("browse");
    expect(useGameStore.getState().showGameList).toBe(true);
    expect(useGameStore.getState().highlightedGameId).toBe(BigInt(8));
    expect(refreshGameList).toHaveBeenCalledTimes(1);
  });

  it("handleInviteGame rejects already-started games for non-participants", async () => {
    mockedReadContract.mockImplementation(async (_cfg, params) => {
      const fn = (params as { functionName?: string }).functionName;
      if (fn === "getGameState") {
        return mockGameState(
          "0x00000000000000000000000000000000000000AA",
          "0x00000000000000000000000000000000000000BB",
          1
        ) as never;
      }
      throw new Error(`unexpected fn ${fn}`);
    });

    const result = await useGameStore
      .getState()
      .handleInviteGame(BigInt(9), "0x00000000000000000000000000000000000000CC");

    expect(result).toBe("invalid");
    expect(useGameStore.getState().showGameList).toBe(false);
    expect(useGameStore.getState().highlightedGameId).toBeUndefined();
    expect(mockedToastError).toHaveBeenCalledWith("该对局已开始，无法加入。");
  });

  it("autoDetectGame exposes a loading state while scanning for unfinished games", async () => {
    const owner = "0x00000000000000000000000000000000000000AA";

    mockedReadContract.mockImplementation(async (_cfg, params) => {
      const fn = (params as { functionName?: string }).functionName;
      if (fn === "gameCounter") {
        await new Promise((resolve) => {
          setTimeout(resolve, 0);
        });
        return BigInt(1) as never;
      }
      if (fn === "getGameState") {
        return mockGameState(owner, ZERO_ADDRESS, 0) as never;
      }
      throw new Error(`unexpected fn ${fn}`);
    });

    const pending = useGameStore.getState().autoDetectGame(true, owner);

    expect(useGameStore.getState().isAutoRestoringGame).toBe(true);

    await pending;

    expect(useGameStore.getState().isAutoRestoringGame).toBe(false);
  });

  // 断言：历史查询会优先使用智能账户地址并正确映射分页结果。
  it("fetchMyHistory resolves EOA to smart account and reads paged history", async () => {
    mockedGetAccount.mockReturnValue({
      address: "0x00000000000000000000000000000000000000AA",
    } as never);

    mockedReadContract.mockImplementation(async (_cfg, params) => {
      const fn = (params as { functionName?: string }).functionName;
      const args = (params as { args?: readonly unknown[] }).args ?? [];
      if (fn === "accountOf") return "0x00000000000000000000000000000000000000BB" as never;
      if (fn === "getPlayerHistoryCount") return BigInt(1) as never;
      if (fn === "getPlayerHistoryPage") {
        return [
          {
            gameId: BigInt(7),
            opponent: "0x00000000000000000000000000000000000000CC",
            result: 2,
            scoreDelta: 1,
            endedAt: BigInt(1710000000),
          },
        ] as never;
      }
      if (fn === "ownerOfAccount") {
        if ((args[0] as string).toLowerCase() === "0x00000000000000000000000000000000000000cc") {
          return "0x00000000000000000000000000000000000000DD" as never;
        }
        return ZERO_ADDRESS as never;
      }
      throw new Error(`unexpected fn ${fn}`);
    });

    await useGameStore.getState().fetchMyHistory(1);

    const state = useGameStore.getState();
    expect(state.historyTotal).toBe(1);
    expect(state.historyPage).toBe(1);
    expect(state.historyRecords).toHaveLength(1);
    expect(state.historyRecords[0]).toMatchObject({
      gameId: BigInt(7),
      opponent: "0x00000000000000000000000000000000000000DD",
      result: "WIN",
      scoreDelta: 1,
    });
  });

  // 断言：排行榜会映射展示地址并按分数/场次/地址排序。
  it("fetchLeaderboard maps owner and sorts by score then games then address", async () => {
    mockedReadContract
      .mockResolvedValueOnce(BigInt(2) as never) // leaderboard count
      .mockResolvedValueOnce(
        [
          {
            player: "0x00000000000000000000000000000000000000B2",
            gamesPlayed: BigInt(3),
            totalScore: BigInt(1),
          },
          {
            player: "0x00000000000000000000000000000000000000A1",
            gamesPlayed: BigInt(4),
            totalScore: BigInt(1),
          },
        ] as never
      )
      .mockResolvedValueOnce(ZERO_ADDRESS as never) // ownerOfAccount(B2)
      .mockResolvedValueOnce("0x00000000000000000000000000000000000000F1" as never); // ownerOfAccount(A1)

    await useGameStore.getState().fetchLeaderboard(1);

    const state = useGameStore.getState();
    expect(state.leaderboardTotal).toBe(2);
    expect(state.leaderboardRecords).toHaveLength(2);
    // 同分时按对局数降序，因此 A1 在前
    expect(state.leaderboardRecords[0]).toMatchObject({
      player: "0x00000000000000000000000000000000000000A1",
      displayAddress: "0x00000000000000000000000000000000000000F1",
      gamesPlayed: BigInt(4),
      totalScore: BigInt(1),
    });
    expect(state.leaderboardRecords[1]).toMatchObject({
      player: "0x00000000000000000000000000000000000000B2",
      displayAddress: "0x00000000000000000000000000000000000000B2",
      gamesPlayed: BigInt(3),
      totalScore: BigInt(1),
    });
  });

  // 断言：排行榜应先全局排序后分页，跨页顺序保持一致。
  it("fetchLeaderboard globally sorts before pagination and keeps cross-page order consistent", async () => {
    const lowScoreRows = Array.from({ length: 20 }, (_, i) => ({
      player: toAddress(i + 1),
      gamesPlayed: BigInt(1),
      totalScore: BigInt(0),
    }));
    const highScoreRows = [
      { player: toAddress(21), gamesPlayed: BigInt(1), totalScore: BigInt(10) },
      { player: toAddress(22), gamesPlayed: BigInt(1), totalScore: BigInt(9) },
      { player: toAddress(23), gamesPlayed: BigInt(1), totalScore: BigInt(8) },
      { player: toAddress(24), gamesPlayed: BigInt(1), totalScore: BigInt(7) },
      { player: toAddress(25), gamesPlayed: BigInt(1), totalScore: BigInt(6) },
    ];

    mockedReadContract.mockImplementation(async (_cfg, params) => {
      const fn = (params as { functionName?: string }).functionName;
      if (fn === "getLeaderboardCount") return BigInt(25) as never;
      if (fn === "getLeaderboardPage") {
        const offset = Number(
          ((params as { args?: readonly unknown[] }).args?.[0] as bigint | undefined) ?? BigInt(0)
        );
        if (offset === 0) return lowScoreRows as never;
        if (offset === 20) return highScoreRows as never;
        return [] as never;
      }
      if (fn === "ownerOfAccount") return ZERO_ADDRESS as never;
      throw new Error(`unexpected fn ${fn}`);
    });

    const expectedOrder = [
      ...highScoreRows.map((row) => row.player),
      ...lowScoreRows.map((row) => row.player),
    ];

    await useGameStore.getState().fetchLeaderboard(1);
    const pageCallsForPage1 = mockedReadContract.mock.calls
      .filter(([, args]) => (args as { functionName?: string }).functionName === "getLeaderboardPage")
      .map(([, args]) =>
        Number(
          (((args as { args?: readonly unknown[] }).args?.[0] as bigint | undefined) ?? BigInt(0))
        )
      );

    expect(pageCallsForPage1).toEqual([0, 20]);
    expect(useGameStore.getState().leaderboardRecords.map((item) => item.player)).toEqual(
      expectedOrder.slice(0, 20)
    );

    mockedReadContract.mockClear();

    await useGameStore.getState().fetchLeaderboard(2);
    expect(useGameStore.getState().leaderboardRecords.map((item) => item.player)).toEqual(
      expectedOrder.slice(20)
    );
  });

  // 断言：同分同场次时按 displayAddress 升序作为稳定 tie-breaker。
  it("fetchLeaderboard uses displayAddress ascending as tie breaker when score and games are equal", async () => {
    mockedReadContract
      .mockResolvedValueOnce(BigInt(2) as never)
      .mockResolvedValueOnce(
        [
          {
            player: "0x00000000000000000000000000000000000000A1",
            gamesPlayed: BigInt(3),
            totalScore: BigInt(1),
          },
          {
            player: "0x00000000000000000000000000000000000000B2",
            gamesPlayed: BigInt(3),
            totalScore: BigInt(1),
          },
        ] as never
      )
      .mockResolvedValueOnce("0x00000000000000000000000000000000000000C1" as never)
      .mockResolvedValueOnce("0x00000000000000000000000000000000000000B1" as never);

    await useGameStore.getState().fetchLeaderboard(1);

    const players = useGameStore.getState().leaderboardRecords.map((item) => item.player);
    expect(players).toEqual([
      "0x00000000000000000000000000000000000000B2",
      "0x00000000000000000000000000000000000000A1",
    ]);
  });

  // 断言：规则读取成功时应采用链上超时值并标记非回退。
  it("fetchRulesMeta uses on-chain timeout when read succeeds", async () => {
    mockedReadContract.mockResolvedValueOnce(BigInt(900) as never);

    await useGameStore.getState().fetchRulesMeta();

    const { rulesMeta, isRulesLoading } = useGameStore.getState();
    expect(isRulesLoading).toBe(false);
    expect(rulesMeta.turnTimeoutSeconds).toBe(900);
    expect(rulesMeta.loaded).toBe(true);
    expect(rulesMeta.usingFallback).toBe(false);
  });

  // 断言：规则读取失败时应回退默认超时值并标记回退来源。
  it("fetchRulesMeta falls back to defaults when read fails", async () => {
    mockedReadContract.mockRejectedValueOnce(new Error("rpc error"));

    await useGameStore.getState().fetchRulesMeta();

    const { rulesMeta, isRulesLoading } = useGameStore.getState();
    expect(isRulesLoading).toBe(false);
    expect(rulesMeta.turnTimeoutSeconds).toBe(600);
    expect(rulesMeta.loaded).toBe(true);
    expect(rulesMeta.usingFallback).toBe(true);
  });

  it("createGame prefers session setup and updates session state on success", async () => {
    const owner = "0x00000000000000000000000000000000000000AA";
    const autoDetectGame = jest.fn(async () => undefined);
    mockedGetAccount.mockReturnValue({ address: owner, chainId: 31337 } as never);
    mockedGetSessionStatus.mockReturnValue("active");
    mockedSetupRoundSession.mockResolvedValue({} as never);
    useGameStore.setState({ autoDetectGame, showResult: true });

    await useGameStore.getState().createGame();

    expect(mockedSetupRoundSession).toHaveBeenCalledTimes(1);
    expect(autoDetectGame).toHaveBeenCalledWith(true, owner);
    expect(mockedClearSession).not.toHaveBeenCalled();
    expect(useGameStore.getState().sessionStatus).toBe("active");
    expect(useGameStore.getState().actionPhase).toBe("success");
    expect(useGameStore.getState().actionMessage).toBe("对局创建成功");
    expect(useGameStore.getState().showResult).toBe(false);
  });

  it("createGame falls back to direct contract write when session setup fails", async () => {
    const owner = "0x00000000000000000000000000000000000000AA";
    const autoDetectGame = jest.fn(async () => undefined);
    mockedGetAccount.mockReturnValue({ address: owner, chainId: 31337 } as never);
    mockedSetupRoundSession.mockRejectedValueOnce(new Error("session failed"));
    mockedSimulateContract.mockResolvedValueOnce({
      request: { to: mockRuntimeConfig.tictactoeAddress },
    } as never);
    mockedWriteContract.mockResolvedValueOnce("0xhash" as never);
    mockedWaitForTransactionReceipt.mockResolvedValueOnce({} as never);
    useGameStore.setState({ autoDetectGame, showResult: true });

    await useGameStore.getState().createGame();

    expect(mockedSimulateContract).toHaveBeenCalledTimes(1);
    expect(mockedWriteContract).toHaveBeenCalledTimes(1);
    expect(mockedWaitForTransactionReceipt).toHaveBeenCalledTimes(1);
    expect(mockedClearSession).toHaveBeenCalledWith(owner);
    expect(autoDetectGame).toHaveBeenCalledWith(true, owner);
    expect(useGameStore.getState().sessionStatus).toBe("idle");
    expect(useGameStore.getState().actionPhase).toBe("success");
    expect(useGameStore.getState().showResult).toBe(false);
  });

  it("joinGame falls back to direct contract write when session setup fails", async () => {
    const owner = "0x00000000000000000000000000000000000000AA";
    const autoDetectGame = jest.fn(async () => undefined);
    mockedGetAccount.mockReturnValue({ address: owner, chainId: 31337 } as never);
    mockedSetupRoundSession.mockRejectedValueOnce(new Error("session failed"));
    mockedSimulateContract.mockResolvedValueOnce({
      request: { to: mockRuntimeConfig.tictactoeAddress },
    } as never);
    mockedWriteContract.mockResolvedValueOnce("0xhash" as never);
    mockedWaitForTransactionReceipt.mockResolvedValueOnce({} as never);
    useGameStore.setState({ autoDetectGame });

    await useGameStore.getState().joinGame(BigInt(9));

    expect(mockedSimulateContract).toHaveBeenCalledTimes(1);
    expect(mockedWriteContract).toHaveBeenCalledTimes(1);
    expect(mockedClearSession).toHaveBeenCalledWith(owner);
    expect(useGameStore.getState().showGameList).toBe(false);
    expect(useGameStore.getState().actionMessage).toBe("加入对局成功");
  });

  it("makeMove rejects when it is not the player's turn", async () => {
    mockedGetAccount.mockReturnValue({
      address: "0x00000000000000000000000000000000000000AA",
      chainId: 31337,
    } as never);
    useGameStore.setState({
      gameId: BigInt(5),
      playerAddress: "0x00000000000000000000000000000000000000AA",
      gameStatus: {
        gameId: BigInt(5),
        player1: "0x00000000000000000000000000000000000000AA",
        player2: "0x00000000000000000000000000000000000000BB",
        currentTurn: "0x00000000000000000000000000000000000000BB",
        board: Array(9).fill(null),
        state: 1,
        winner: ZERO_ADDRESS,
        lastMoveAt: BigInt(0),
        turnTimeoutSeconds: BigInt(600),
      },
    });

    await useGameStore.getState().makeMove(2);

    expect(mockedSimulateContract).not.toHaveBeenCalled();
    expect(mockedWriteContract).not.toHaveBeenCalled();
    expect(useGameStore.getState().actionPhase).toBe("idle");
  });

  it("cancelGame, resign, and claimTimeoutWin short-circuit on invalid preconditions", async () => {
    mockedGetAccount.mockReturnValue({
      address: "0x00000000000000000000000000000000000000AA",
      chainId: 31337,
    } as never);

    useGameStore.setState({
      gameId: BigInt(6),
      playerAddress: "0x00000000000000000000000000000000000000AA",
      gameStatus: {
        gameId: BigInt(6),
        player1: "0x00000000000000000000000000000000000000AA",
        player2: "0x00000000000000000000000000000000000000BB",
        currentTurn: "0x00000000000000000000000000000000000000AA",
        board: Array(9).fill(null),
        state: 1,
        winner: ZERO_ADDRESS,
        lastMoveAt: BigInt(0),
        turnTimeoutSeconds: BigInt(600),
      },
    });

    await useGameStore.getState().cancelGame();
    expect(mockedSimulateContract).not.toHaveBeenCalled();

    useGameStore.setState({
      playerAddress: "0x00000000000000000000000000000000000000CC",
    });
    await useGameStore.getState().resign();
    expect(mockedSimulateContract).not.toHaveBeenCalled();

    useGameStore.setState({
      playerAddress: "0x00000000000000000000000000000000000000AA",
      gameStatus: {
        gameId: BigInt(6),
        player1: "0x00000000000000000000000000000000000000AA",
        player2: "0x00000000000000000000000000000000000000BB",
        currentTurn: "0x00000000000000000000000000000000000000AA",
        board: Array(9).fill(null),
        state: 1,
        winner: ZERO_ADDRESS,
        lastMoveAt: BigInt(0),
        turnTimeoutSeconds: BigInt(600),
      },
    });
    await useGameStore.getState().claimTimeoutWin();
    expect(mockedSimulateContract).not.toHaveBeenCalled();
  });

  it("fetchLeaderboard invalidates cache automatically when runtime cache key changes", async () => {
    mockedReadContract.mockImplementation(async (_cfg, params) => {
      const fn = (params as { functionName?: string }).functionName;
      if (fn === "getLeaderboardCount") return BigInt(1) as never;
      if (fn === "getLeaderboardPage") {
        return [
          {
            player: "0x00000000000000000000000000000000000000A1",
            gamesPlayed: BigInt(2),
            totalScore: BigInt(5),
          },
        ] as never;
      }
      if (fn === "ownerOfAccount") return ZERO_ADDRESS as never;
      throw new Error(`unexpected fn ${fn}`);
    });

    await useGameStore.getState().fetchLeaderboard(1);
    const firstCountCalls = mockedReadContract.mock.calls.filter(
      ([, params]) => (params as { functionName?: string }).functionName === "getLeaderboardCount"
    );
    expect(firstCountCalls).toHaveLength(1);

    mockedReadContract.mockClear();
    Object.assign(mockRuntimeConfig, { chainId: 11155111 });

    await useGameStore.getState().fetchLeaderboard(1);
    const secondCountCalls = mockedReadContract.mock.calls.filter(
      ([, params]) => (params as { functionName?: string }).functionName === "getLeaderboardCount"
    );
    expect(secondCountCalls).toHaveLength(1);
  });
});
