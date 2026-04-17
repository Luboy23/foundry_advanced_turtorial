import type { Address } from "@/types/contract-config";
import type {
  CredentialSetDraftInput,
  EditableApplicantRecord,
  GeneratedCredentialSetSnapshot,
  GovernmentCredentialSetState
} from "@/types/domain";
import { createEmptyApplicantRecord, type ApplicantRowErrors } from "@/lib/credential-set-management.shared";

/**
 * 政府端草稿编辑器的纯状态机。
 *
 * 页面层的本地状态较多，但大多数变化都属于“草稿被替换”“录入框变化”“校验结果回填”
 * 这几类固定转移。把这些纯状态转移收敛到 reducer 后，页面可以专注在链上发布和弹窗编排。
 */
export type GovernmentDraftManagerState = {
  draft: CredentialSetDraftInput | null;
  rowErrors: ApplicantRowErrors[];
  referenceDateError: string | null;
  draftError: string | null;
  entryDraft: EditableApplicantRecord;
  entryError: string | null;
  preparedSnapshot: GeneratedCredentialSetSnapshot | null;
  preparedPendingApplicantAddresses: Address[];
  isPublishing: boolean;
};

type GovernmentDraftManagerAction =
  | {
      type: "hydrate-from-management-state";
      payload: {
        draft: CredentialSetDraftInput;
        latestDraftSnapshot: GeneratedCredentialSetSnapshot | null;
        pendingApplicantAddresses: Address[];
      };
    }
  | {
      type: "replace-draft";
      payload: {
        draft: CredentialSetDraftInput;
      };
    }
  | {
      type: "reset-editor-draft";
      payload: {
        draft: CredentialSetDraftInput;
      };
    }
  | {
      type: "set-entry-field";
      payload: {
        field: keyof EditableApplicantRecord;
        value: string;
      };
    }
  | {
      type: "set-entry-draft";
      payload: {
        entryDraft: EditableApplicantRecord;
      };
    }
  | {
      type: "set-entry-error";
      payload: {
        error: string | null;
      };
    }
  | {
      type: "set-validation-state";
      payload: {
        rowErrors: ApplicantRowErrors[];
        referenceDateError: string | null;
        draftError: string | null;
      };
    }
  | {
      type: "set-prepared-result";
      payload: {
        snapshot: GeneratedCredentialSetSnapshot | null;
        pendingApplicantAddresses: Address[];
      };
    }
  | {
      type: "set-draft-error";
      payload: {
        error: string | null;
      };
    }
  | {
      type: "set-publishing";
      payload: {
        value: boolean;
      };
    };

/** 创建政府端草稿编辑器的初始状态。 */
export function createGovernmentDraftManagerInitialState(): GovernmentDraftManagerState {
  return {
    draft: null,
    rowErrors: [],
    referenceDateError: null,
    draftError: null,
    entryDraft: createEmptyApplicantRecord(),
    entryError: null,
    preparedSnapshot: null,
    preparedPendingApplicantAddresses: [],
    isPublishing: false
  };
}

/** 为当前草稿生成一份等长的空白行级错误结构。 */
export function buildGovernmentDraftRowErrors(draft: CredentialSetDraftInput) {
  return draft.records.map(() => ({} satisfies ApplicantRowErrors));
}

/** 规范化新增录入框的即时输入。 */
export function normalizeGovernmentEntryFieldValue(field: keyof EditableApplicantRecord, value: string) {
  return field === "applicantAddress" ? value.trim().toLowerCase() : value;
}

/** 根据当前链上与本地基线，生成“恢复为当前名单”时应回退到的草稿。 */
export function buildGovernmentDraftResetTarget(managementState: GovernmentCredentialSetState): CredentialSetDraftInput {
  return managementState.currentPublishedSnapshot
    ? {
        version: managementState.currentPublishedSnapshot.version + 1,
        referenceDate: managementState.editorDraft.referenceDate,
        records: managementState.currentPublishedSnapshot.input.records.map((record) => ({
          applicantAddress: record.applicantAddress,
          applicantLabel: record.applicantLabel ?? ""
        }))
      }
    : managementState.editorDraft;
}

/** 政府端草稿状态机 reducer。 */
export function governmentDraftManagerReducer(
  state: GovernmentDraftManagerState,
  action: GovernmentDraftManagerAction
): GovernmentDraftManagerState {
  switch (action.type) {
    case "hydrate-from-management-state": {
      const { draft, latestDraftSnapshot, pendingApplicantAddresses } = action.payload;
      return {
        ...state,
        draft,
        rowErrors: buildGovernmentDraftRowErrors(draft),
        referenceDateError: null,
        draftError: null,
        entryDraft: createEmptyApplicantRecord(),
        entryError: null,
        preparedSnapshot: latestDraftSnapshot,
        preparedPendingApplicantAddresses: pendingApplicantAddresses
      };
    }
    case "replace-draft": {
      const { draft } = action.payload;
      return {
        ...state,
        draft,
        rowErrors: buildGovernmentDraftRowErrors(draft),
        referenceDateError: null,
        draftError: null,
        entryError: null,
        preparedSnapshot: null,
        preparedPendingApplicantAddresses: []
      };
    }
    case "reset-editor-draft": {
      const { draft } = action.payload;
      return {
        ...state,
        draft,
        rowErrors: buildGovernmentDraftRowErrors(draft),
        referenceDateError: null,
        draftError: null,
        entryDraft: createEmptyApplicantRecord(),
        entryError: null,
        preparedSnapshot: null,
        preparedPendingApplicantAddresses: []
      };
    }
    case "set-entry-field":
      return {
        ...state,
        entryDraft: {
          ...state.entryDraft,
          [action.payload.field]: action.payload.value
        },
        entryError: null
      };
    case "set-entry-draft":
      return {
        ...state,
        entryDraft: action.payload.entryDraft
      };
    case "set-entry-error":
      return {
        ...state,
        entryError: action.payload.error
      };
    case "set-validation-state":
      return {
        ...state,
        rowErrors: action.payload.rowErrors,
        referenceDateError: action.payload.referenceDateError,
        draftError: action.payload.draftError
      };
    case "set-prepared-result":
      return {
        ...state,
        preparedSnapshot: action.payload.snapshot,
        preparedPendingApplicantAddresses: action.payload.pendingApplicantAddresses
      };
    case "set-draft-error":
      return {
        ...state,
        draftError: action.payload.error
      };
    case "set-publishing":
      return {
        ...state,
        isPublishing: action.payload.value
      };
    default:
      return state;
  }
}
