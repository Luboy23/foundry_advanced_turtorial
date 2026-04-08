const mockGetDefaultConfig = jest.fn((input) => input);

jest.mock("wagmi", () => ({
  fallback: jest.fn((transports) => ({ kind: "fallback", transports })),
  http: jest.fn((url) => ({ kind: "http", url })),
  webSocket: jest.fn((url) => ({ kind: "ws", url })),
}));

jest.mock("@rainbow-me/rainbowkit", () => ({
  getDefaultConfig: (input: unknown) => mockGetDefaultConfig(input),
}));

jest.mock("@rainbow-me/rainbowkit/wallets", () => ({
  injectedWallet: jest.fn(),
}));

describe("web3 config factory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates wagmi config from the runtime chain descriptor instead of a hardcoded chain", async () => {
    const { createAppConfig } = await import("@/components/web3/config");

    const runtimeConfig = {
      tictactoeAddress: "0x00000000000000000000000000000000000000A1",
      sessionFactoryAddress: "0x00000000000000000000000000000000000000B2",
      rpcUrl: "https://rpc.example.test",
      chainId: 421614,
    } as const;

    const config = createAppConfig(runtimeConfig) as unknown as {
      chains: Array<{
        id: number;
        rpcUrls: { default: { http: string[] } };
      }>;
      transports: Record<string, unknown>;
    };

    expect(mockGetDefaultConfig).toHaveBeenCalledTimes(1);
    expect(config.chains[0].id).toBe(421614);
    expect(config.chains[0].rpcUrls.default.http).toEqual([
      "https://rpc.example.test",
    ]);
    expect(Object.keys(config.transports)).toEqual(["421614"]);
  });
});
