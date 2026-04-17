import { describe, expect, it, vi } from "vitest";
import {
  readClaimHistory,
  readCredentialSetPublishHistory,
  readCurrentCredentialSetOrNull,
  readProgram,
  readRoleStatus
} from "@/lib/contracts/query";
import type { RuntimeConfig } from "@/types/contract-config";

const baseConfig: RuntimeConfig = {
  roleRegistryAddress: "0x1111111111111111111111111111111111111111",
  rootRegistryAddress: "0x2222222222222222222222222222222222222222",
  benefitDistributorAddress: "0x3333333333333333333333333333333333333333",
  verifierAddress: "0x4444444444444444444444444444444444444444",
  chainId: 31337,
  rpcUrl: "http://127.0.0.1:8545",
  deploymentId: "test",
  deploymentStartBlock: 12,
  demoAddresses: {
    government: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    applicant: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    agency: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    ineligibleApplicant: "0x90F79bf6EB2c4f870365E785982E1f101E93b906"
  },
  zkArtifactPaths: {
    wasm: "/zk/unemployment_benefit_proof.wasm",
    zkey: "/zk/unemployment_benefit_proof_final.zkey"
  }
};

describe("contract query helpers", () => {
  it("reads role status and program data through readContract calls", async () => {
    const readContract = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(["0x1234", 99n, 100000000000000000000n, true, 1_700_000_000n, 3n, 300000000000000000000n])
      .mockResolvedValueOnce(700000000000000000000n);
    const publicClient = {
      readContract
    } as const;

    const roleStatus = await readRoleStatus(publicClient as never, baseConfig, baseConfig.demoAddresses.government);
    const program = await readProgram(publicClient as never, baseConfig);

    expect(readContract).toHaveBeenCalledTimes(5);
    expect(readContract).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        address: baseConfig.roleRegistryAddress,
        functionName: "isGovernment",
        args: [baseConfig.demoAddresses.government]
      })
    );
    expect(readContract).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        address: baseConfig.roleRegistryAddress,
        functionName: "isApplicant",
        args: [baseConfig.demoAddresses.government]
      })
    );
    expect(readContract).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        address: baseConfig.roleRegistryAddress,
        functionName: "isAgency",
        args: [baseConfig.demoAddresses.government]
      })
    );
    expect(readContract).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        address: baseConfig.benefitDistributorAddress,
        functionName: "getProgram"
      })
    );
    expect(readContract).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({
        address: baseConfig.benefitDistributorAddress,
        functionName: "getProgramBalance"
      })
    );
    expect(roleStatus).toEqual({
      isGovernment: true,
      isApplicant: false,
      isAgency: true
    });
    expect(program).toMatchObject({
      programId: "0x1234",
      programIdField: 99n,
      amountWei: 100000000000000000000n,
      active: true,
      totalClaims: 3,
      totalDisbursedWei: 300000000000000000000n,
      poolBalanceWei: 700000000000000000000n
    });
  });

  it("reads claim history from deploymentStartBlock and reuses block timestamps within one batch", async () => {
    const getContractEvents = vi.fn().mockResolvedValue([
      {
        args: {
          programId: "0x1234",
          recipient: baseConfig.demoAddresses.applicant,
          nullifierHash: "0xaaa1",
          amountWei: 100000000000000000000n,
          rootVersion: 2n
        },
        transactionHash: "0xhash1",
        blockHash: "0xblock1"
      },
      {
        args: {
          programId: "0x1234",
          recipient: baseConfig.demoAddresses.applicant,
          nullifierHash: "0xaaa2",
          amountWei: 100000000000000000000n,
          rootVersion: 2n
        },
        transactionHash: "0xhash2",
        blockHash: "0xblock1"
      }
    ]);
    const getBlock = vi.fn().mockResolvedValue({ timestamp: 1_700_000_123n });
    const publicClient = {
      getContractEvents,
      getBlock
    } as const;

    const records = await readClaimHistory(publicClient as never, baseConfig, baseConfig.demoAddresses.applicant);

    expect(getContractEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        fromBlock: 12n
      })
    );
    expect(getBlock).toHaveBeenCalledTimes(1);
    expect(records).toHaveLength(2);
    expect(records[0]?.claimedAt).toBe(1_700_000_123);
  });

  it("falls back to earliest when deploymentStartBlock is not configured", async () => {
    const getContractEvents = vi.fn().mockResolvedValue([]);
    const publicClient = {
      getContractEvents
    } as const;

    await readCredentialSetPublishHistory(publicClient as never, {
      ...baseConfig,
      deploymentStartBlock: undefined
    });

    expect(getContractEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        fromBlock: "earliest"
      })
    );
  });

  it("treats missing credential sets as an empty state instead of a query failure", async () => {
    const publicClient = {
      readContract: vi.fn().mockRejectedValue(new Error("CredentialSetNotFound(0x00)"))
    } as const;

    await expect(readCurrentCredentialSetOrNull(publicClient as never, baseConfig)).resolves.toBeNull();
  });
});
