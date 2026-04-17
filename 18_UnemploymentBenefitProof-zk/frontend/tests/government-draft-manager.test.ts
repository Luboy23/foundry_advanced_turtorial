import { describe, expect, it } from "vitest";
import {
  buildGovernmentDraftResetTarget,
  createGovernmentDraftManagerInitialState,
  governmentDraftManagerReducer,
  normalizeGovernmentEntryFieldValue
} from "@/lib/government-draft-manager";
import type { GeneratedCredentialSetSnapshot, GovernmentCredentialSetState } from "@/types/domain";

const publishedSnapshot: GeneratedCredentialSetSnapshot = {
  version: 2,
  createdAt: 1_744_681_600,
  input: {
    version: 2,
    referenceDate: 1_744_595_200,
    records: [
      {
        applicantAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        identityHash: "101",
        secretSalt: "201",
        applicantLabel: "Alice"
      }
    ]
  },
  set: {
    setIdLabel: "unemployment-credential-set",
    setIdBytes32: "0x1111111111111111111111111111111111111111111111111111111111111111",
    sourceTitle: "失业资格审核名单",
    version: 2,
    referenceDate: 1_744_595_200,
    merkleDepth: 20,
    merkleRoot: "123456",
    merkleRootHex: "0x2222222222222222222222222222222222222222222222222222222222222222",
    eligibleCount: 1
  }
};

const draftSnapshot: GeneratedCredentialSetSnapshot = {
  ...publishedSnapshot,
  version: 3,
  createdAt: 1_744_768_000,
  input: {
    version: 3,
    referenceDate: 1_744_681_600,
    records: [
      ...publishedSnapshot.input.records,
      {
        applicantAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        identityHash: "102",
        secretSalt: "202",
        applicantLabel: "Bob"
      }
    ]
  },
  set: {
    ...publishedSnapshot.set,
    version: 3,
    referenceDate: 1_744_681_600,
    merkleRoot: "789012",
    merkleRootHex: "0x3333333333333333333333333333333333333333333333333333333333333333",
    eligibleCount: 2
  }
};

const managementState: GovernmentCredentialSetState = {
  currentChainSet: null,
  currentPublishedSnapshot: publishedSnapshot,
  latestDraftSnapshot: draftSnapshot,
  editorDraft: {
    version: 3,
    referenceDate: 1_744_681_600,
    records: [
      {
        applicantAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        applicantLabel: "Alice"
      },
      {
        applicantAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        applicantLabel: "Bob"
      }
    ]
  },
  draftPendingApplicantAddresses: ["0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"]
};

describe("government draft manager", () => {
  it("normalizes newly entered applicant addresses to trimmed lowercase values", () => {
    expect(normalizeGovernmentEntryFieldValue("applicantAddress", " 0xABcD ")).toBe("0xabcd");
    expect(normalizeGovernmentEntryFieldValue("applicantLabel", " Alice ")).toBe(" Alice ");
  });

  it("builds reset targets from the current published snapshot while keeping the latest reference date", () => {
    expect(buildGovernmentDraftResetTarget(managementState)).toEqual({
      version: publishedSnapshot.version + 1,
      referenceDate: managementState.editorDraft.referenceDate,
      records: [
        {
          applicantAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
          applicantLabel: "Alice"
        }
      ]
    });
  });

  it("hydrates reducer state from management data and clears prepared results when the draft changes", () => {
    const initialState = createGovernmentDraftManagerInitialState();
    const hydratedState = governmentDraftManagerReducer(initialState, {
      type: "hydrate-from-management-state",
      payload: {
        draft: managementState.editorDraft,
        latestDraftSnapshot: draftSnapshot,
        pendingApplicantAddresses: managementState.draftPendingApplicantAddresses
      }
    });

    expect(hydratedState.draft).toEqual(managementState.editorDraft);
    expect(hydratedState.rowErrors).toHaveLength(managementState.editorDraft.records.length);
    expect(hydratedState.preparedSnapshot).toEqual(draftSnapshot);
    expect(hydratedState.preparedPendingApplicantAddresses).toEqual(
      managementState.draftPendingApplicantAddresses
    );

    const replacedDraft = {
      ...managementState.editorDraft,
      records: [
        ...managementState.editorDraft.records,
        {
          applicantAddress: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
          applicantLabel: "Carol"
        }
      ]
    };
    const replacedState = governmentDraftManagerReducer(
      {
        ...hydratedState,
        entryError: "该申请钱包地址已录入，无需重复添加。"
      },
      {
        type: "replace-draft",
        payload: {
          draft: replacedDraft
        }
      }
    );

    expect(replacedState.draft).toEqual(replacedDraft);
    expect(replacedState.rowErrors).toHaveLength(replacedDraft.records.length);
    expect(replacedState.entryError).toBeNull();
    expect(replacedState.preparedSnapshot).toBeNull();
    expect(replacedState.preparedPendingApplicantAddresses).toEqual([]);
  });

  it("resets the editor back to the published baseline and clears transient add-entry state", () => {
    const hydratedState = governmentDraftManagerReducer(createGovernmentDraftManagerInitialState(), {
      type: "hydrate-from-management-state",
      payload: {
        draft: managementState.editorDraft,
        latestDraftSnapshot: draftSnapshot,
        pendingApplicantAddresses: managementState.draftPendingApplicantAddresses
      }
    });

    const resetState = governmentDraftManagerReducer(
      {
        ...hydratedState,
        entryDraft: {
          applicantAddress: "0x1234",
          applicantLabel: "temp"
        },
        entryError: "请输入有效的钱包地址。"
      },
      {
        type: "reset-editor-draft",
        payload: {
          draft: buildGovernmentDraftResetTarget(managementState)
        }
      }
    );

    expect(resetState.draft).toEqual({
      version: 3,
      referenceDate: 1_744_681_600,
      records: [
        {
          applicantAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
          applicantLabel: "Alice"
        }
      ]
    });
    expect(resetState.entryDraft).toEqual({
      applicantAddress: "",
      applicantLabel: ""
    });
    expect(resetState.entryError).toBeNull();
    expect(resetState.preparedSnapshot).toBeNull();
    expect(resetState.preparedPendingApplicantAddresses).toEqual([]);
  });
});
