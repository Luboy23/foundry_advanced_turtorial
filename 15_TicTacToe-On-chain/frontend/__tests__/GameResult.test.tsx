import { fireEvent, render, screen } from "@testing-library/react";
import GameResult from "@/components/GameResult";

const mockUseGameStore = jest.fn();
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const PLAYER_1 = "0x0000000000000000000000000000000000000001";
const PLAYER_2 = "0x0000000000000000000000000000000000000002";

jest.mock("@/store/useGameStore", () => ({
  useGameStore: () => mockUseGameStore(),
}));

const buildStoreState = ({
  playerAddress = PLAYER_1,
  winner = PLAYER_1,
  player2 = PLAYER_2,
  ...storeOverrides
}: {
  playerAddress?: string;
  winner?: string;
  player2?: string;
  [key: string]: unknown;
} = {}) => ({
  showResult: true,
  setShowResult: jest.fn(),
  createGame: jest.fn(),
  returnToHome: jest.fn(),
  gameStatus: {
    gameId: BigInt(1),
    player1: PLAYER_1,
    player2,
    currentTurn: PLAYER_1,
    board: Array(9).fill(null),
    state: 2,
    winner,
    lastMoveAt: BigInt(0),
    turnTimeoutSeconds: BigInt(600),
  },
  playerAddress,
  isLoading: false,
  activeAction: undefined,
  actionPhase: "idle",
  actionMessage: undefined,
  rulesMeta: {
    scoring: {
      win: 1,
      draw: 0,
      loss: -1,
      cancelCounts: false,
    },
  },
  ...storeOverrides,
});

describe("GameResult", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a new game without returning home when play again is clicked", () => {
    const returnToHome = jest.fn();
    const createGame = jest.fn();
    const setShowResult = jest.fn();

    mockUseGameStore.mockReturnValue({
      ...buildStoreState(),
      setShowResult,
      createGame,
      returnToHome,
    });

    render(<GameResult />);

    fireEvent.click(screen.getByRole("button", { name: "再来一局" }));

    expect(returnToHome).not.toHaveBeenCalled();
    expect(createGame).toHaveBeenCalledTimes(1);
    expect(setShowResult).not.toHaveBeenCalledWith(false);
  });

  it("returns to home when the dialog close button is clicked", () => {
    const returnToHome = jest.fn();
    const setShowResult = jest.fn();

    mockUseGameStore.mockReturnValue({
      ...buildStoreState(),
      returnToHome,
      setShowResult,
    });

    render(<GameResult />);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(returnToHome).toHaveBeenCalledTimes(1);
    expect(setShowResult).not.toHaveBeenCalledWith(false);
  });

  it.each([
    ["win", "胜利图标", { winner: PLAYER_1, player2: PLAYER_2 }],
    ["loss", "失败图标", { winner: PLAYER_2, player2: PLAYER_2 }],
    ["draw", "平局图标", { winner: ZERO_ADDRESS, player2: PLAYER_2 }],
    ["cancelled", "取消图标", { winner: ZERO_ADDRESS, player2: ZERO_ADDRESS }],
  ])("renders the %s result icon", (_kind, iconLabel, stateOverrides) => {
    mockUseGameStore.mockReturnValue(buildStoreState(stateOverrides));

    render(<GameResult />);

    expect(screen.getByLabelText(iconLabel)).toBeInTheDocument();
  });

  it("shows the failure icon when the current player loses", () => {
    mockUseGameStore.mockReturnValue(
      buildStoreState({
        winner: PLAYER_2,
        player2: PLAYER_2,
      })
    );

    render(<GameResult />);

    expect(screen.getByLabelText("失败图标")).toBeInTheDocument();
    expect(screen.getByText("本局失利")).toBeInTheDocument();
  });

  it("locks the dialog while rematch creation is awaiting wallet confirmation", () => {
    mockUseGameStore.mockReturnValue(
      buildStoreState({
        activeAction: "create",
        actionPhase: "awaiting_signature",
        actionMessage: "请在钱包中确认创建对局",
      })
    );

    render(<GameResult />);

    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "请在钱包确认" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "返回首页" })).toBeDisabled();
    expect(screen.getByText("等待签名")).toBeInTheDocument();
    expect(screen.getByText("请在钱包中确认创建对局")).toBeInTheDocument();
  });

  it("keeps the result dialog context and exposes retry copy when rematch creation fails", () => {
    mockUseGameStore.mockReturnValue(
      buildStoreState({
        winner: PLAYER_2,
        player2: PLAYER_2,
        activeAction: "create",
        actionPhase: "error",
        actionMessage: "创建对局失败，请重试。",
      })
    );

    render(<GameResult />);

    expect(screen.getByRole("button", { name: "重试创建" })).toBeInTheDocument();
    expect(screen.getByText("需要处理")).toBeInTheDocument();
    expect(screen.getByText("创建对局失败，请重试。")).toBeInTheDocument();
    expect(screen.getByText("本局失利")).toBeInTheDocument();
  });
});
