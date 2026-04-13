import { describe, expect, it } from "vitest";
import {
  createRuntimeReadClient,
  resolveReadClientState,
  toWalletReadClient,
  type ReadClient
} from "@/lib/blockchain/read-client";

const config = {
  admissionRoleRegistryAddress: "0x0000000000000000000000000000000000000000",
  scoreRootRegistryAddress: "0x0000000000000000000000000000000000000000",
  universityAdmissionVerifierAddress: "0x0000000000000000000000000000000000000000",
  chainId: 31337,
  rpcUrl: "http://127.0.0.1:8545"
} as const;

describe("read client selection", () => {
  // 保护目标：即使钱包已连接，只要链不对，就不能错误地把钱包读源当成真实链上真相。
  it("does not use a wallet client when it is connected to the wrong chain", () => {
    const walletClient = {
      chain: { id: 1 },
      extend() {
        return { source: "wallet" } as unknown as ReadClient;
      }
    };

    expect(toWalletReadClient(walletClient as never, 31337)).toBeNull();
  });

  // 保护目标：运行时读客户端至少要具备合约读取、日志查询和回执等待三类能力。
  it("creates a runtime read client with the expected public actions", () => {
    const client = createRuntimeReadClient(config);

    expect(typeof client.readContract).toBe("function");
    expect(typeof client.getLogs).toBe("function");
    expect(typeof client.waitForTransactionReceipt).toBe("function");
  });

  // 保护目标：未连接钱包时，前端仍然能用运行时 RPC 完成只读链查询。
  it("uses the runtime rpc client when no wallet is connected", () => {
    const fallbackReadClient = { source: "runtime" } as unknown as ReadClient;

    const state = resolveReadClientState({
      config,
      fallbackReadClient,
      walletConnected: false,
      walletReadClient: null
    });

    expect(state.mode).toBe("runtime");
    expect(state.client).toBe(fallbackReadClient);
    expect(state.isReady).toBe(true);
    expect(state.isUsingFallback).toBe(true);
    expect(state.sourceKey).toContain("rpc:");
  });

  // 保护目标：钱包已连接但钱包读源未 ready 时，关键页面要保持 pending，而不是偷跑 fallback 查询。
  it("stays pending when a wallet is connected but its read client is not ready yet", () => {
    const state = resolveReadClientState({
      config,
      fallbackReadClient: { source: "runtime" } as unknown as ReadClient,
      walletConnected: true,
      walletAddress: "0x0000000000000000000000000000000000000001",
      walletChainId: 31337,
      walletReadClient: null
    });

    expect(state.mode).toBe("pending-wallet");
    expect(state.client).toBeNull();
    expect(state.isReady).toBe(false);
    expect(state.isUsingFallback).toBe(false);
    expect(state.sourceKey).toBe("pending-wallet:0x0000000000000000000000000000000000000001:31337");
  });

  // 保护目标：钱包读源准备好后，后续关键查询都应切换到和钱包写交易同源的读客户端。
  it("switches to the wallet-scoped read client once the wallet read client becomes ready", () => {
    const walletReadClient = { source: "wallet" } as unknown as ReadClient;

    const state = resolveReadClientState({
      config,
      fallbackReadClient: { source: "runtime" } as unknown as ReadClient,
      walletConnected: true,
      walletAddress: "0x0000000000000000000000000000000000000001",
      walletChainId: 31337,
      walletReadClient
    });

    expect(state.mode).toBe("wallet");
    expect(state.client).toBe(walletReadClient);
    expect(state.isReady).toBe(true);
    expect(state.isUsingFallback).toBe(false);
    expect(state.sourceKey).toBe("wallet:0x0000000000000000000000000000000000000001:31337");
  });
});
