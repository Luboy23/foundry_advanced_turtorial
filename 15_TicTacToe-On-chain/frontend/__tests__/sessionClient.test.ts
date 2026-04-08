import {
  resetSessionCacheForTests,
  sendGameAction,
  setSessionForTests,
} from "@/lib/sessionClient";

const mockRuntimeConfig = {
  tictactoeAddress: "0x00000000000000000000000000000000000000A1",
  sessionFactoryAddress: "0x00000000000000000000000000000000000000B2",
  rpcUrl: "http://127.0.0.1:9545",
  chainId: 421614,
};

const mockCreateWalletClient = jest.fn();
const mockCreatePublicClient = jest.fn();
const mockEncodeFunctionData = jest.fn((...args: unknown[]) => {
  void args;
  return "0xencoded-call";
});
const mockHttp = jest.fn((url: string) => ({ url }));

jest.mock("@/components/web3/config", () => ({
  getAppConfig: jest.fn(() => ({})),
}));

jest.mock("@/constants", () => ({
  CONTRACT_ABI: [
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
  ],
  SESSION_ACCOUNT_ABI: [
    {
      type: "function",
      name: "executeWithSession",
      stateMutability: "nonpayable",
      inputs: [
        { name: "target", type: "address" },
        { name: "callData", type: "bytes" },
      ],
      outputs: [],
    },
  ],
  SESSION_ALLOWED_SELECTORS: [],
  SESSION_DURATION_SECONDS: 1800,
  SESSION_FACTORY_ABI: [],
  SESSION_MAX_CALLS: 12,
  SESSION_PREFUND_WEI: BigInt(0),
  buildRuntimeChain: jest.fn((runtimeConfig) => ({
    id: runtimeConfig.chainId,
    name: "Runtime Test Chain",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: [runtimeConfig.rpcUrl] },
      public: { http: [runtimeConfig.rpcUrl] },
    },
    testnet: true,
  })),
  getResolvedRuntimeConfig: jest.fn(() => mockRuntimeConfig),
}));

jest.mock("wagmi/actions", () => ({
  readContract: jest.fn(),
  simulateContract: jest.fn(),
  waitForTransactionReceipt: jest.fn(),
  writeContract: jest.fn(),
}));

jest.mock("viem", () => {
  const actual = jest.requireActual("viem");
  return {
    ...actual,
    createWalletClient: (config: unknown) => mockCreateWalletClient(config),
    createPublicClient: (config: unknown) => mockCreatePublicClient(config),
    encodeFunctionData: (config: unknown) => mockEncodeFunctionData(config),
    http: (url: string) => mockHttp(url),
  };
});

jest.mock("viem/accounts", () => ({
  privateKeyToAccount: jest.fn(() => ({
    address: "0x00000000000000000000000000000000000000C3",
  })),
  generatePrivateKey: jest.fn(() => "0x1234"),
}));

describe("session client runtime chain usage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetSessionCacheForTests();
  });

  it("uses the runtime chain descriptor for wallet and public clients", async () => {
    const walletWriteContract = jest.fn().mockResolvedValue("0xtxhash");
    const publicWaitForReceipt = jest.fn().mockResolvedValue({});
    mockCreateWalletClient.mockReturnValue({
      writeContract: walletWriteContract,
    });
    mockCreatePublicClient.mockReturnValue({
      waitForTransactionReceipt: publicWaitForReceipt,
    });

    setSessionForTests({
      owner: "0x00000000000000000000000000000000000000D4",
      smartAccount: "0x00000000000000000000000000000000000000E5",
      sessionKey: "0x00000000000000000000000000000000000000F6",
      privateKey: "0x1111111111111111111111111111111111111111111111111111111111111111",
      expiresAt: Math.floor(Date.now() / 1000) + 600,
      maxCalls: 2,
      callsUsed: 0,
    });

    await sendGameAction({
      owner: "0x00000000000000000000000000000000000000D4",
      action: "makeMove",
      args: [BigInt(3), 4],
    });

    expect(mockCreateWalletClient).toHaveBeenCalledWith(
      expect.objectContaining({
        chain: expect.objectContaining({ id: 421614 }),
        transport: { url: "http://127.0.0.1:9545" },
      })
    );
    expect(mockCreatePublicClient).toHaveBeenCalledWith(
      expect.objectContaining({
        chain: expect.objectContaining({ id: 421614 }),
        transport: { url: "http://127.0.0.1:9545" },
      })
    );
    expect(walletWriteContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: "0x00000000000000000000000000000000000000E5",
      })
    );
    expect(publicWaitForReceipt).toHaveBeenCalledWith({ hash: "0xtxhash" });
  });
});
