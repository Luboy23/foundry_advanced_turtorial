import { fireEvent, render, screen } from "@testing-library/react";
import GameHistoryPanel from "@/components/GameHistoryPanel";
import LeaderboardPanel from "@/components/LeaderboardPanel";

const mockUseGameStore = jest.fn();

jest.mock("@/constants", () => ({
  getResolvedRuntimeConfig: () => ({
    chainId: 1,
  }),
}));

// 使用 store mock 隔离组件文案断言。
jest.mock("@/store/useGameStore", () => ({
  useGameStore: () => mockUseGameStore(),
}));

describe("Leaderboard and history panel copy", () => {
  // 每个用例前清理 mock，避免调用次数污染。
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 断言：排行榜面板应展示计分/排序/分页口径文案。
  it("shows scoring and stats scope copy in leaderboard panel", () => {
    mockUseGameStore.mockReturnValue({
      leaderboardRecords: [],
      leaderboardTotal: 0,
      leaderboardPage: 1,
      isLeaderboardLoading: false,
      leaderboardLastUpdatedAt: undefined,
      fetchLeaderboard: jest.fn(),
      createGame: jest.fn(),
      setShowGameList: jest.fn(),
      setShowLeaderboardDialog: jest.fn(),
      networkMismatch: false,
      rulesMeta: {
        scoring: {
          win: 1,
          draw: 0,
          loss: -1,
          cancelCounts: false,
        },
      },
    });

    render(<LeaderboardPanel />);

    expect(screen.getByText("玩家总数")).toBeInTheDocument();
    expect(screen.getByText("计分与统计口径")).toBeInTheDocument();
    expect(
      screen.getAllByText("胜 +1 分 / 平 0 分 / 负 -1 分").length
    ).toBeGreaterThan(0);
    expect(
      screen.getByText("取消等待局不计入积分统计；仅双方参与且已结束的有效对局计入统计。")
    ).toBeInTheDocument();
    expect(screen.getByText("排序规则：总分降序 > 对局数降序 > 地址升序。")).toBeInTheDocument();
    expect(screen.getByText("分页规则：先全局排序后分页，确保跨页排名一致。")).toBeInTheDocument();
  });

  // 断言：历史面板应展示计分与历史统计口径文案。
  it("shows scoring and stats scope copy in history panel", () => {
    mockUseGameStore.mockReturnValue({
      historyRecords: [],
      isHistoryLoading: false,
      historyPage: 1,
      historyTotal: 0,
      fetchMyHistory: jest.fn(),
      createGame: jest.fn(),
      setShowGameList: jest.fn(),
      setShowHistoryDialog: jest.fn(),
      networkMismatch: false,
      rulesMeta: {
        scoring: {
          win: 1,
          draw: 0,
          loss: -1,
          cancelCounts: false,
        },
      },
    });

    render(<GameHistoryPanel />);

    expect(screen.getByText("历史总局数")).toBeInTheDocument();
    expect(screen.getByText("计分与统计口径")).toBeInTheDocument();
    expect(
      screen.getAllByText("胜 +1 分 / 平 0 分 / 负 -1 分").length
    ).toBeGreaterThan(0);
    expect(
      screen.getByText("取消等待局不计入积分统计；仅双方参与且已结束的有效对局计入历史成绩。")
    ).toBeInTheDocument();
  });

  // 断言：历史面板应复用地址操作区，并正确切换分页按钮状态。
  it("renders shared address actions and pagination controls in history panel", () => {
    const fetchMyHistory = jest.fn();

    mockUseGameStore.mockReturnValue({
      historyRecords: [
        {
          gameId: BigInt(7),
          opponent: "0x00000000000000000000000000000000000000A1",
          result: "WIN",
          scoreDelta: 1,
          endedAt: BigInt(1710000000),
        },
      ],
      isHistoryLoading: false,
      historyPage: 1,
      historyTotal: 40,
      fetchMyHistory,
      createGame: jest.fn(),
      setShowGameList: jest.fn(),
      setShowHistoryDialog: jest.fn(),
      networkMismatch: false,
      rulesMeta: {
        scoring: {
          win: 1,
          draw: 0,
          loss: -1,
          cancelCounts: false,
        },
      },
    });

    render(<GameHistoryPanel />);

    expect(screen.getAllByText("查看链上").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "复制" }).length).toBeGreaterThan(0);

    const prevButton = screen.getByRole("button", { name: "上一页" });
    const nextButton = screen.getByRole("button", { name: "下一页" });
    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    fireEvent.click(nextButton);
    expect(fetchMyHistory).toHaveBeenCalledWith(2);
  });

  // 断言：排行榜面板应复用地址操作区，并保留刷新和分页行为。
  it("renders shared address actions and pagination controls in leaderboard panel", () => {
    const fetchLeaderboard = jest.fn();

    mockUseGameStore.mockReturnValue({
      leaderboardRecords: [
        {
          player: "0x00000000000000000000000000000000000000B1",
          displayAddress: "0x00000000000000000000000000000000000000B2",
          gamesPlayed: BigInt(12),
          totalScore: BigInt(9),
        },
      ],
      leaderboardTotal: 45,
      leaderboardPage: 2,
      isLeaderboardLoading: false,
      leaderboardLastUpdatedAt: 1710000000000,
      fetchLeaderboard,
      createGame: jest.fn(),
      setShowGameList: jest.fn(),
      setShowLeaderboardDialog: jest.fn(),
      networkMismatch: false,
      rulesMeta: {
        scoring: {
          win: 1,
          draw: 0,
          loss: -1,
          cancelCounts: false,
        },
      },
    });

    render(<LeaderboardPanel />);

    expect(screen.getAllByText("查看链上").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "复制" }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "刷新排行榜" }));
    expect(fetchLeaderboard).toHaveBeenCalledWith(2, true);

    fireEvent.click(screen.getByRole("button", { name: "上一页" }));
    expect(fetchLeaderboard).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByRole("button", { name: "下一页" }));
    expect(fetchLeaderboard).toHaveBeenCalledWith(3);
  });
});
