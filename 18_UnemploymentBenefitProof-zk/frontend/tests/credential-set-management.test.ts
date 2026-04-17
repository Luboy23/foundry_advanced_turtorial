import { describe, expect, it } from "vitest";
import {
  buildCredentialSetArtifacts,
  credentialSetRecordsAreEqual,
  CREDENTIAL_SET_MERKLE_DEPTH,
  validateCredentialSetDraftInput,
  validateResolvedCredentialSetDraftInput
} from "@/lib/credential-set-management";
import type { CredentialSetDraftInput, ResolvedCredentialSetDraftInput } from "@/types/domain";

const entryDraft: CredentialSetDraftInput = {
  version: 2,
  referenceDate: 1_744_681_600,
  records: [
    {
      applicantAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      applicantLabel: "applicant-a"
    },
    {
      applicantAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      applicantLabel: "applicant-b"
    }
  ]
};

const baseDraft: ResolvedCredentialSetDraftInput = {
  version: 2,
  referenceDate: 1_744_681_600,
  records: [
    {
      applicantAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      identityHash: "101",
      secretSalt: "201",
      applicantLabel: "applicant-a"
    },
    {
      applicantAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      identityHash: "102",
      secretSalt: "202",
      applicantLabel: "applicant-b"
    }
  ]
};

describe("credential set management", () => {
  it("validates append-only applicant rows before preparing a draft", () => {
    const result = validateCredentialSetDraftInput({
      version: 2,
      referenceDate: 0,
      records: [
        {
          applicantAddress: "not-an-address",
          applicantLabel: "broken-a"
        },
        {
          applicantAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
          applicantLabel: "broken-b"
        },
        {
          applicantAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
          applicantLabel: "broken-c"
        }
      ]
    });

    expect(result.valid).toBe(false);
    expect(result.referenceDateError).toBe("请选择有效的参考日期。");
    expect(result.rowErrors[0]).toEqual({
      applicantAddress: "请输入有效的钱包地址。"
    });
    expect(result.rowErrors[2]).toEqual({
      applicantAddress: "钱包地址不能重复。"
    });
  });

  it("validates resolved draft fields before generating merkle artifacts", () => {
    const result = validateResolvedCredentialSetDraftInput({
      ...entryDraft,
      records: [
        {
          applicantAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
          identityHash: "0",
          secretSalt: "abc",
          applicantLabel: "broken-a"
        },
        {
          applicantAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
          identityHash: "0",
          secretSalt: "202",
          applicantLabel: "broken-b"
        }
      ]
    });

    expect(result.valid).toBe(false);
    expect(result.rowErrors[0]).toEqual({
      identityHash: "identityHash 需要是正整数。",
      secretSalt: "secretSalt 需要是正整数。"
    });
    expect(result.rowErrors[1]).toEqual({
      identityHash: "identityHash 需要是正整数。"
    });
  });

  it("treats record lists as unchanged even when only version or reference date changes", () => {
    expect(
      credentialSetRecordsAreEqual(baseDraft, {
        version: 9,
        referenceDate: 1_744_768_000,
        records: [
          {
            applicantAddress: " 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 ",
            identityHash: "101",
            secretSalt: "201",
            applicantLabel: "applicant-a"
          },
          {
            applicantAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
            identityHash: "102",
            secretSalt: "202",
            applicantLabel: "applicant-b"
          }
        ]
      })
    ).toBe(true);
  });

  it("builds a merkle snapshot and per-applicant credentials for the current draft", async () => {
    const result = await buildCredentialSetArtifacts(baseDraft);

    expect(result.set.version).toBe(2);
    expect(result.set.referenceDate).toBe(baseDraft.referenceDate);
    expect(result.set.eligibleCount).toBe(2);
    expect(result.set.merkleDepth).toBe(CREDENTIAL_SET_MERKLE_DEPTH);
    expect(result.credentials).toHaveLength(2);

    for (const credential of result.credentials) {
      expect(credential.versionNumber).toBe(2);
      expect(credential.referenceDate).toBe(baseDraft.referenceDate);
      expect(credential.merkleRoot).toBe(result.set.merkleRoot);
      expect(credential.pathElements).toHaveLength(CREDENTIAL_SET_MERKLE_DEPTH);
      expect(credential.pathIndices).toHaveLength(CREDENTIAL_SET_MERKLE_DEPTH);
    }
  });
});
