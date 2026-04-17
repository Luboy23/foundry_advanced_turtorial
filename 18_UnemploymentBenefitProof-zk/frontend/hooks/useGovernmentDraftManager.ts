"use client";

import { useCallback, useEffect, useMemo, useReducer } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { isAddress } from "viem";
import type { Address, RuntimeConfig } from "@/types/contract-config";
import type {
  CredentialSetDraftInput,
  EditableApplicantRecord,
  GovernmentCredentialSetState
} from "@/types/domain";
import {
  createEmptyApplicantRecord,
  type ApplicantRowErrors,
  draftsAreEqual,
  validateCredentialSetDraftInput
} from "@/lib/credential-set-management.shared";
import { prepareGovernmentCredentialSetDraft } from "@/lib/government-credential-sets.client";
import {
  buildGovernmentDraftResetTarget,
  buildGovernmentDraftRowErrors,
  createGovernmentDraftManagerInitialState,
  governmentDraftManagerReducer,
  normalizeGovernmentEntryFieldValue
} from "@/lib/government-draft-manager";
import { queryKeys } from "@/lib/query-keys";

type GovernmentSessionController = {
  ensureSession: () => Promise<string>;
};

/**
 * 政府端草稿编辑与预发布状态的聚合 Hook。
 *
 * 这个 Hook 负责把页面本地的大量并列状态收敛成一套 reducer 驱动的工作流，包括草稿同步、
 * 新增记录录入、前端校验、预发布快照准备和发布中的局部状态。
 */
export function useGovernmentDraftManager(args: {
  managementState?: GovernmentCredentialSetState;
  governmentSession: GovernmentSessionController;
  queryClient: QueryClient;
  config: RuntimeConfig;
  walletAddress?: Address;
}) {
  const { managementState, governmentSession, queryClient, config, walletAddress } = args;
  const [state, dispatch] = useReducer(
    governmentDraftManagerReducer,
    undefined,
    createGovernmentDraftManagerInitialState
  );

  useEffect(() => {
    if (!managementState) {
      return;
    }

    dispatch({
      type: "hydrate-from-management-state",
      payload: {
        draft: managementState.editorDraft,
        latestDraftSnapshot: managementState.latestDraftSnapshot,
        pendingApplicantAddresses: managementState.draftPendingApplicantAddresses
      }
    });
  }, [managementState]);

  const draft = state.draft ?? managementState?.editorDraft ?? null;
  const rowErrors = useMemo<ApplicantRowErrors[]>(() => {
    if (!state.draft && draft) {
      return buildGovernmentDraftRowErrors(draft);
    }

    return state.rowErrors;
  }, [draft, state.draft, state.rowErrors]);

  const isDirty = useMemo(() => {
    if (!managementState || !draft) {
      return false;
    }

    return !draftsAreEqual(draft, managementState.editorDraft);
  }, [draft, managementState]);

  /** 用新草稿替换当前编辑器内容，并重置绑定旧草稿的校验与预发布结果。 */
  const updateDraft = useCallback((draft: CredentialSetDraftInput) => {
    dispatch({
      type: "replace-draft",
      payload: { draft }
    });
  }, []);

  /** 更新新增申请记录录入框。 */
  const handleEntryChange = useCallback((field: keyof EditableApplicantRecord, value: string) => {
    dispatch({
      type: "set-entry-field",
      payload: {
        field,
        value: normalizeGovernmentEntryFieldValue(field, value)
      }
    });
  }, []);

  /** 把当前录入的一条新增地址追加到草稿末尾；成功时返回 `true` 供页面处理聚焦。 */
  const handleAddRecord = useCallback(() => {
    if (!draft) {
      return false;
    }

    const applicantAddress = state.entryDraft.applicantAddress.trim();
    const applicantLabel = state.entryDraft.applicantLabel?.trim() ?? "";

    if (!applicantAddress) {
      dispatch({
        type: "set-entry-error",
        payload: { error: "请输入申请钱包地址。" }
      });
      return false;
    }

    if (!isAddress(applicantAddress)) {
      dispatch({
        type: "set-entry-error",
        payload: { error: "请输入有效的钱包地址。" }
      });
      return false;
    }

    if (
      draft.records.some(
        (record) => record.applicantAddress.toLowerCase() === applicantAddress.toLowerCase()
      )
    ) {
      dispatch({
        type: "set-entry-error",
        payload: { error: "该申请钱包地址已录入，无需重复添加。" }
      });
      return false;
    }

    dispatch({
      type: "replace-draft",
      payload: {
        draft: {
          ...draft,
          records: [
            ...draft.records,
            {
              applicantAddress,
              applicantLabel
            }
          ]
        }
      }
    });
    dispatch({
      type: "set-entry-draft",
      payload: { entryDraft: createEmptyApplicantRecord() }
    });
    return true;
  }, [draft, state.entryDraft]);

  /** 恢复到当前已发布名单对应的可编辑基线。 */
  const handleResetDraft = useCallback(() => {
    if (!managementState) {
      return;
    }

    dispatch({
      type: "reset-editor-draft",
      payload: {
        draft: buildGovernmentDraftResetTarget(managementState)
      }
    });
  }, [managementState]);

  /** 对当前草稿执行前端侧基础校验，并把错误同步回 reducer 状态。 */
  const applyValidationErrors = useCallback((draft: CredentialSetDraftInput) => {
    const validation = validateCredentialSetDraftInput(draft);
    dispatch({
      type: "set-validation-state",
      payload: {
        rowErrors: validation.rowErrors,
        referenceDateError: validation.referenceDateError ?? null,
        draftError: validation.errors[0] ?? null
      }
    });
    return validation;
  }, []);

  /**
   * 为发布动作准备快照。
   *
   * 如果当前草稿没有新改动，就直接复用服务端最近一次待发布草稿；否则重新请求服务端生成新快照。
   */
  const prepareSnapshotForPublish = useCallback(async () => {
    if (!draft) {
      throw new Error("当前没有可发布的资格名单草稿。");
    }

    const validation = applyValidationErrors(draft);
    if (!validation.valid) {
      throw new Error(validation.errors[0] ?? "资格名单数据无效。");
    }

    const latestDraftSnapshot = managementState?.latestDraftSnapshot ?? null;
    if (latestDraftSnapshot && !isDirty) {
      const pendingApplicantAddresses = managementState?.draftPendingApplicantAddresses ?? [];
      dispatch({
        type: "set-prepared-result",
        payload: {
          snapshot: latestDraftSnapshot,
          pendingApplicantAddresses
        }
      });
      return {
        snapshot: latestDraftSnapshot,
        pendingApplicantAddresses
      };
    }

    const token = await governmentSession.ensureSession();
    const result = await prepareGovernmentCredentialSetDraft(token, validation.normalizedInput);
    dispatch({
      type: "set-prepared-result",
      payload: {
        snapshot: result.snapshot,
        pendingApplicantAddresses: result.pendingApplicantAddresses
      }
    });
    await queryClient.invalidateQueries({
      queryKey: queryKeys.governmentCredentialSetState(config, walletAddress)
    });
    return result;
  }, [applyValidationErrors, config, draft, governmentSession, isDirty, managementState, queryClient, walletAddress]);

  /** 更新草稿层面的错误提示。 */
  const setDraftError = useCallback((error: string | null) => {
    dispatch({
      type: "set-draft-error",
      payload: { error }
    });
  }, []);

  /** 更新发布中的局部状态。 */
  const setPublishing = useCallback((value: boolean) => {
    dispatch({
      type: "set-publishing",
      payload: { value }
    });
  }, []);

  return {
    ...state,
    draft,
    rowErrors,
    isDirty,
    updateDraft,
    handleEntryChange,
    handleAddRecord,
    handleResetDraft,
    applyValidationErrors,
    prepareSnapshotForPublish,
    setDraftError,
    setPublishing
  };
}
