import { describe, expect, it } from "vitest";
import { normalizeAuthorityDraftPayload } from "@/lib/authority/draft";

describe("normalizeAuthorityDraftPayload", () => {
  it("normalizes backend nested authority import payload into a flat draft", () => {
    const draft = normalizeAuthorityDraftPayload({
      scoreSource: {
        scoreSourceIdLabel: "GAOKAO_2026",
        sourceTitle: "2026 全国统一高考",
        maxScore: 100,
        merkleDepth: 20
      },
      records: [
        {
          candidateLabel: "demo-student",
          candidateIdHash: "100001",
          score: 60,
          secretSalt: "910001",
          boundStudentAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
        }
      ]
    });

    expect(draft).toEqual({
      scoreSourceIdLabel: "GAOKAO_2026",
      sourceTitle: "2026 全国统一高考",
      maxScore: 100,
      merkleDepth: 20,
      records: [
        {
          candidateLabel: "demo-student",
          candidateIdHash: "100001",
          score: 60,
          secretSalt: "910001",
          boundStudentAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
        }
      ]
    });
  });

  it("keeps legacy flat draft payload compatible", () => {
    const draft = normalizeAuthorityDraftPayload({
      scoreSourceIdLabel: "GAOKAO_2026",
      sourceTitle: "2026 全国统一高考",
      maxScore: 100,
      merkleDepth: 20,
      records: [
        {
          candidateLabel: "demo-student",
          candidateIdHash: "100001",
          score: 60,
          secretSalt: "910001",
          boundStudentAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
        }
      ]
    });

    expect(draft?.scoreSourceIdLabel).toBe("GAOKAO_2026");
    expect(draft?.records).toHaveLength(1);
  });
});
