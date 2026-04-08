describe("runtime config helpers", () => {
  const originalEnv = {
    tictactoeAddress: process.env.NEXT_PUBLIC_TICTACTOE_ADDRESS,
    sessionFactoryAddress: process.env.NEXT_PUBLIC_SESSION_FACTORY_ADDRESS,
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL,
    chainId: process.env.NEXT_PUBLIC_CHAIN_ID,
  };

  beforeEach(() => {
    jest.resetModules();
    delete (window as unknown as Record<string, unknown>).__TICTACTOE_RUNTIME_CONFIG__;
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_TICTACTOE_ADDRESS = originalEnv.tictactoeAddress;
    process.env.NEXT_PUBLIC_SESSION_FACTORY_ADDRESS = originalEnv.sessionFactoryAddress;
    process.env.NEXT_PUBLIC_RPC_URL = originalEnv.rpcUrl;
    process.env.NEXT_PUBLIC_CHAIN_ID = originalEnv.chainId;
  });

  it("loads runtime config only once and reuses the cached result", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tictactoeAddress: "0x00000000000000000000000000000000000000A1",
        sessionFactoryAddress: "0x00000000000000000000000000000000000000B2",
        rpcUrl: "http://127.0.0.1:9545",
        chainId: 31338,
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const constants = await import("@/constants");
    constants.resetRuntimeContractConfigForTests();

    const [first, second] = await Promise.all([
      constants.loadRuntimeContractConfig(),
      constants.loadRuntimeContractConfig(),
    ]);
    const third = await constants.loadRuntimeContractConfig();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(third).toEqual(first);
    expect(constants.getCachedRuntimeContractConfig()).toEqual(first);
  });

  it("prefers window config over env values when resolving runtime config", async () => {
    process.env.NEXT_PUBLIC_TICTACTOE_ADDRESS =
      "0x00000000000000000000000000000000000000C1";
    process.env.NEXT_PUBLIC_SESSION_FACTORY_ADDRESS =
      "0x00000000000000000000000000000000000000D2";
    process.env.NEXT_PUBLIC_RPC_URL = "http://127.0.0.1:8545";
    process.env.NEXT_PUBLIC_CHAIN_ID = "31337";

    const constants = await import("@/constants");
    constants.resetRuntimeContractConfigForTests();
    (window as unknown as Record<string, unknown>).__TICTACTOE_RUNTIME_CONFIG__ = {
      tictactoeAddress: "0x00000000000000000000000000000000000000E3",
      sessionFactoryAddress: "0x00000000000000000000000000000000000000F4",
      rpcUrl: "http://127.0.0.1:7545",
      chainId: 421614,
    };

    expect(constants.getResolvedRuntimeConfig()).toEqual({
      tictactoeAddress: "0x00000000000000000000000000000000000000E3",
      sessionFactoryAddress: "0x00000000000000000000000000000000000000F4",
      rpcUrl: "http://127.0.0.1:7545",
      chainId: 421614,
    });
  });

  it("allows resetting runtime config cache and reloading a new snapshot", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tictactoeAddress: "0x0000000000000000000000000000000000000011",
          sessionFactoryAddress: "0x0000000000000000000000000000000000000022",
          rpcUrl: "http://127.0.0.1:8545",
          chainId: 31337,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tictactoeAddress: "0x0000000000000000000000000000000000000033",
          sessionFactoryAddress: "0x0000000000000000000000000000000000000044",
          rpcUrl: "http://127.0.0.1:9545",
          chainId: 31338,
        }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    const constants = await import("@/constants");
    constants.resetRuntimeContractConfigForTests();

    const first = await constants.loadRuntimeContractConfig();
    constants.resetRuntimeContractConfigForTests();
    const second = await constants.loadRuntimeContractConfig();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(first).not.toEqual(second);
    expect(second.chainId).toBe(31338);
  });
});
