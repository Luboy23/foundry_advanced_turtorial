import { describe, expect, it, vi } from "vitest";
import { IndexerService } from "./indexer.service";

describe("IndexerService school rule projection", () => {
  it("re-reads touched schools when SchoolConfigUpdated is observed", async () => {
    const schoolId = "0x706b752d76310000000000000000000000000000000000000000000000000000";
    const txHashCreate =
      "0x1111111111111111111111111111111111111111111111111111111111111111";
    const txHashUpdate =
      "0x2222222222222222222222222222222222222222222222222222222222222222";

    const prisma = {
      chainSyncState: {
        findUnique: vi.fn().mockResolvedValue({ projectionName: "school-rules", lastSyncedBlock: 1 }),
        upsert: vi.fn().mockResolvedValue(undefined)
      },
      schoolRuleVersion: {
        upsert: vi.fn().mockResolvedValue(undefined)
      }
    };

    const publicClient = {
      getLogs: vi
        .fn()
        .mockResolvedValueOnce([
          {
            args: { schoolId },
            transactionHash: txHashCreate,
            blockNumber: 2n,
            logIndex: 0
          }
        ])
        .mockResolvedValueOnce([
          {
            args: { schoolId },
            transactionHash: txHashUpdate,
            blockNumber: 3n,
            logIndex: 0
          }
        ])
    };

    const chainService = {
      getPublicClient: vi.fn(() => publicClient),
      getContractConfig: vi.fn(() => ({
        universityAdmissionVerifierAddress:
          "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
        deploymentBlockNumber: 1
      })),
      schoolCreatedEvent: {} as never,
      schoolConfigUpdatedEvent: {} as never,
      readSchool: vi.fn().mockResolvedValue({
        universityKey:
          "0x706b750000000000000000000000000000000000000000000000000000000000",
        schoolName: "北京大学",
        scoreSourceId:
          "0x47414f4b414f5f32303236000000000000000000000000000000000000000000",
        cutoffScore: 60,
        admin: "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
        active: true,
        cutoffFrozen: true,
        updatedAt: 1710000000n
      })
    };

    const service = new IndexerService(prisma as never, chainService as never);

    await (
      service as unknown as { syncSchoolRules: (latestBlock: number) => Promise<void> }
    ).syncSchoolRules(5);

    expect(publicClient.getLogs).toHaveBeenCalledTimes(2);
    expect(chainService.readSchool).toHaveBeenCalledWith(schoolId);
    expect(prisma.schoolRuleVersion.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { schoolId },
        update: expect.objectContaining({
          active: true,
          cutoffFrozen: true,
          txHash: txHashUpdate
        })
      })
    );
    expect(prisma.chainSyncState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectionName: "school-rules" },
        update: expect.objectContaining({ lastSyncedBlock: 5 })
      })
    );
  });
});
