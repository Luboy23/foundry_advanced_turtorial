import { afterEach, describe, expect, it, vi } from "vitest";

const historyStoreMocks = vi.hoisted(() => ({
  readAggregatedClaimHistory: vi.fn(),
  readAggregatedCredentialSetPublishHistory: vi.fn()
}));

vi.mock("@/lib/server/event-history-store", () => ({
  readAggregatedClaimHistory: historyStoreMocks.readAggregatedClaimHistory,
  readAggregatedCredentialSetPublishHistory: historyStoreMocks.readAggregatedCredentialSetPublishHistory
}));

import { GET as getClaimHistory } from "@/app/api/history/claims/route";
import { GET as getCredentialSetHistory } from "@/app/api/history/credential-sets/route";

describe("history api routes", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid claim history filters before reading aggregated data", async () => {
    const response = await getClaimHistory(new Request("http://localhost/api/history/claims?recipient=broken"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "领取记录筛选地址无效。"
    });
    expect(historyStoreMocks.readAggregatedClaimHistory).not.toHaveBeenCalled();
  });

  it("serializes aggregated claim history records for JSON responses", async () => {
    const recipient = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

    historyStoreMocks.readAggregatedClaimHistory.mockResolvedValueOnce([
      {
        programId: "0x1234",
        recipient,
        nullifierHash: "0xaaa1",
        amountWei: 100000000000000000000n,
        rootVersion: 2,
        claimedAt: 1_744_681_600,
        txHash: "0xhash1"
      }
    ]);

    const response = await getClaimHistory(new Request(`http://localhost/api/history/claims?recipient=${recipient}`));

    expect(response.status).toBe(200);
    expect(historyStoreMocks.readAggregatedClaimHistory).toHaveBeenCalledWith(recipient);
    await expect(response.json()).resolves.toEqual({
      records: [
        {
          programId: "0x1234",
          recipient,
          nullifierHash: "0xaaa1",
          amountWei: "100000000000000000000",
          rootVersion: 2,
          claimedAt: 1_744_681_600,
          txHash: "0xhash1"
        }
      ]
    });
  });

  it("serializes aggregated credential set publish history", async () => {
    historyStoreMocks.readAggregatedCredentialSetPublishHistory.mockResolvedValueOnce([
      {
        setId: "0x5678",
        version: 3,
        merkleRoot: 123456789n,
        referenceDate: 1_744_681_600,
        eligibleCount: 4,
        issuer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        timestamp: 1_744_681_680,
        txHash: "0xhash2"
      }
    ]);

    const response = await getCredentialSetHistory();

    expect(response.status).toBe(200);
    expect(historyStoreMocks.readAggregatedCredentialSetPublishHistory).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual({
      records: [
        {
          setId: "0x5678",
          version: 3,
          merkleRoot: "123456789",
          referenceDate: 1_744_681_600,
          eligibleCount: 4,
          issuer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
          timestamp: 1_744_681_680,
          txHash: "0xhash2"
        }
      ]
    });
  });
});
