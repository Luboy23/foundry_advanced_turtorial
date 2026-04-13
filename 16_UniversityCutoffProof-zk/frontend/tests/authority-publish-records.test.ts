import { describe, expect, it } from "vitest";
import { toAuthorityPublishHistoryItems } from "@/hooks/useAuthorityPublishRecords";
import type { ScoreSourceSummary } from "@/hooks/useScoreSources";

describe("toAuthorityPublishHistoryItems", () => {
  it("maps onchain score sources into authority publish history items", () => {
    const sources: ScoreSourceSummary[] = [
      {
        scoreSourceId: "0x47414f4b414f5f32303236000000000000000000000000000000000000000000",
        scoreSourceIdLabel: "GAOKAO_2026",
        sourceTitle: "2026 全国统一高考",
        merkleRoot: 123n,
        maxScore: 100,
        issuedAt: 1760000000,
        issuer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        active: true,
        txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
        blockNumber: 12n
      }
    ];

    const records = toAuthorityPublishHistoryItems(sources);

    expect(records).toEqual([
      {
        scoreSourceId: sources[0].scoreSourceId,
        scoreSourceIdLabel: "GAOKAO_2026",
        sourceTitle: "2026 全国统一高考",
        issuer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        issuedAt: 1760000000 * 1000,
        txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
        blockNumber: 12n
      }
    ]);
  });
});
