import { render, screen, waitFor } from "@testing-library/react";

import GameList from "@/components/GameList";

const mockUseAccount = jest.fn();
const mockUseGameStore = jest.fn();
const baseStoreState = {
  gameList: [],
  continueGame: jest.fn(),
  joinGame: jest.fn(),
  createGame: jest.fn(),
  refreshGameList: jest.fn(),
  isLoading: false,
  isGameListLoading: false,
  activeAction: undefined,
  actionPhase: "idle",
  highlightedGameId: undefined,
  networkMismatch: false,
  playerAddress: "0x00000000000000000000000000000000000000AA",
  smartAccountAddress: undefined,
};

jest.mock("wagmi", () => ({
  useAccount: () => mockUseAccount(),
}));

jest.mock("@/constants", () => ({
  getResolvedRuntimeConfig: () => ({
    chainId: 31337,
  }),
}));

jest.mock("@/store/useGameStore", () => ({
  useGameStore: () => mockUseGameStore(),
}));

describe("GameList", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: "0x00000000000000000000000000000000000000AA",
    });
    mockUseGameStore.mockReturnValue(baseStoreState);

    window.HTMLElement.prototype.scrollIntoView = jest.fn();
  });

  it("only renders waiting games and unfinished games related to the current player", async () => {
    mockUseGameStore.mockReturnValue({
      ...baseStoreState,
      gameList: [
        {
          id: BigInt(1),
          player1: "0x00000000000000000000000000000000000000AA",
          player2: "0x00000000000000000000000000000000000000BB",
          currentTurn: "0x00000000000000000000000000000000000000BB",
          state: 1,
          winner: "0x0000000000000000000000000000000000000000",
        },
        {
          id: BigInt(2),
          player1: "0x00000000000000000000000000000000000000CC",
          player2: "0x0000000000000000000000000000000000000000",
          currentTurn: "0x00000000000000000000000000000000000000CC",
          state: 0,
          winner: "0x0000000000000000000000000000000000000000",
        },
        {
          id: BigInt(3),
          player1: "0x00000000000000000000000000000000000000DD",
          player2: "0x00000000000000000000000000000000000000EE",
          currentTurn: "0x00000000000000000000000000000000000000EE",
          state: 1,
          winner: "0x0000000000000000000000000000000000000000",
        },
      ],
    });

    render(<GameList />);

    await waitFor(() => {
      expect(screen.getByText("对局 #1")).toBeInTheDocument();
      expect(screen.getByText("对局 #2")).toBeInTheDocument();
    });

    expect(screen.queryByText("对局 #3")).not.toBeInTheDocument();
    expect(screen.queryByText("仅旁观")).not.toBeInTheDocument();
  });

  it("shows the new empty-state copy when no actionable games are available", async () => {
    mockUseGameStore.mockReturnValue({
      ...baseStoreState,
      gameList: [
        {
          id: BigInt(4),
          player1: "0x00000000000000000000000000000000000000DD",
          player2: "0x00000000000000000000000000000000000000EE",
          currentTurn: "0x00000000000000000000000000000000000000EE",
          state: 1,
          winner: "0x0000000000000000000000000000000000000000",
        },
      ],
    });

    render(<GameList />);

    await waitFor(() => {
      expect(
        screen.getByText("当前暂无与你相关或可加入的对局")
      ).toBeInTheDocument();
    });
  });
});
