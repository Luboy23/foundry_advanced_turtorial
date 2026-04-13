"use client";

import { useMemo } from "react";

// 大学工作台的统一守卫。
// 它把钱包、链一致性、workbench 读取状态和“当前是否本校管理员”压成一套稳定的禁用原因。
export function useUniversityWorkflowState(args: {
  isConnected: boolean;
  wrongChain: boolean;
  chainConsistencyChecking: boolean;
  chainConsistencyError: boolean;
  chainConsistent: boolean;
  chainConsistencyMessage: string | null;
  isWorkbenchLoading: boolean;
  isWorkbenchError: boolean;
  walletAddress?: `0x${string}`;
  currentAdmin: `0x${string}` | null;
  createDraftGuardReason: string | null;
  backendCanCreateDraft: boolean;
}) {
  const {
    isConnected,
    wrongChain,
    chainConsistencyChecking,
    chainConsistencyError,
    chainConsistent,
    chainConsistencyMessage,
    isWorkbenchLoading,
    isWorkbenchError,
    walletAddress,
    currentAdmin,
    createDraftGuardReason,
    backendCanCreateDraft
  } = args;

  const managementGuardReason = useMemo(() => {
    if (!isConnected) {
      return "请先连接学校管理员账户。";
    }
    if (wrongChain) {
      return "请先切换到项目链。";
    }
    if (chainConsistencyChecking) {
      return "正在校验当前钱包连接的本地链，请稍候。";
    }
    if (chainConsistencyError || !chainConsistent) {
      return chainConsistencyMessage ?? "当前钱包连接的链与项目运行链不一致。";
    }
    if (isWorkbenchLoading) {
      return "正在读取本校规则，请稍候。";
    }
    if (isWorkbenchError) {
      return "当前无法读取本校规则，暂时不能继续操作。";
    }
    if (currentAdmin && walletAddress?.toLowerCase() !== currentAdmin.toLowerCase()) {
      return "当前账户不是该校管理员。";
    }
    return null;
  }, [
    chainConsistencyChecking,
    chainConsistencyError,
    chainConsistencyMessage,
    chainConsistent,
    currentAdmin,
    isConnected,
    isWorkbenchError,
    isWorkbenchLoading,
    walletAddress,
    wrongChain
  ]);

  // canEdit 只表示“当前有资格操作大学工作台”；
  // 是否能新建规则草稿还要继续叠加当前成绩源和后端 canCreateDraft 的业务限制。
  const canEdit = useMemo(
    () =>
      !managementGuardReason &&
      (!currentAdmin || walletAddress?.toLowerCase() === currentAdmin.toLowerCase()),
    [currentAdmin, managementGuardReason, walletAddress]
  );

  const resolvedCreateDraftDisabledReason = managementGuardReason ?? createDraftGuardReason;

  return {
    managementGuardReason,
    canEdit,
    canCreateDraft: !resolvedCreateDraftDisabledReason && backendCanCreateDraft,
    createDraftDisabledReason: resolvedCreateDraftDisabledReason
  };
}
