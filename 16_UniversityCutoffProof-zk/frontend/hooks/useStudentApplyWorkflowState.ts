"use client";

import { useMemo } from "react";

// 学生申请页的禁用原因优先级。
// 这里故意把“链与工作台真相”放在最前面，让页面始终先解释系统级阻断，再解释学生个人资格不足。
export function useStudentApplyWorkflowState(args: {
  chainConsistencyGuardReason: string | null;
  publishedSourceGuardReason: string | null;
  ruleReadGuardReason: string | null;
  historyReadGuardReason: string | null;
  generateDisabledReason: string | null;
}) {
  const {
    chainConsistencyGuardReason,
    publishedSourceGuardReason,
    ruleReadGuardReason,
    historyReadGuardReason,
    generateDisabledReason
  } = args;

  const resolvedGenerateDisabledReason = useMemo(
    () =>
      chainConsistencyGuardReason ??
      publishedSourceGuardReason ??
      ruleReadGuardReason ??
      historyReadGuardReason ??
      generateDisabledReason,
    [
      chainConsistencyGuardReason,
      generateDisabledReason,
      historyReadGuardReason,
      publishedSourceGuardReason,
      ruleReadGuardReason
    ]
  );

  return {
    resolvedGenerateDisabledReason,
    resolvedSubmitDisabledReason: resolvedGenerateDisabledReason
  };
}
