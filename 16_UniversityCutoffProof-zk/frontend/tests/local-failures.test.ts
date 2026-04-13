import { describe, expect, it } from "vitest";
import {
  getLocalFailureFingerprint,
  normalizeLocalFailureHistory
} from "@/lib/history/local-failures";
import type { LocalFailureHistoryItem } from "@/types/history";

const blockedPku: LocalFailureHistoryItem = {
  schoolId: "0x706b750000000000000000000000000000000000000000000000000000000000",
  schoolName: "北京大学",
  walletAddress: "0x0000000000000000000000000000000000000002",
  score: 60,
  cutoffScore: 100,
  createdAt: 1000,
  message: "60 分未达到北京大学当前录取线 100 分。",
  versionId: "pku-v1"
};

describe("local failure history", () => {
  it("builds a stable fingerprint for the same blocked application", () => {
    expect(
      getLocalFailureFingerprint(blockedPku)
    ).toBe(
      "0x0000000000000000000000000000000000000002:0x706b750000000000000000000000000000000000000000000000000000000000:60:100:pku-v1"
    );
  });

  it("deduplicates repeated blocked records caused by page refreshes", () => {
    expect(
      normalizeLocalFailureHistory([
        blockedPku,
        {
          ...blockedPku,
          createdAt: 2000
        }
      ])
    ).toEqual([blockedPku]);
  });
});
