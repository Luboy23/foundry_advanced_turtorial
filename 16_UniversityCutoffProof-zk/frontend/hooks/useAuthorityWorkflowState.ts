"use client";

import { useMemo } from "react";
import type { SampleScoreSource, ScoreSourceDraft } from "@/types/admission";

// 考试院页面的按钮守卫收口。
// publishDisabledReason 的优先级必须稳定，页面和弹窗才能给出一致解释。
export function useAuthorityWorkflowState(args: {
  isConfigured: boolean;
  isConnected: boolean;
  wrongChain: boolean;
  isWorkbenchLoading: boolean;
  isWorkbenchError: boolean;
  draft: ScoreSourceDraft | null;
  latestActiveSource: { scoreSourceId: `0x${string}` } | null;
  generatedScoreSource: SampleScoreSource | null;
}) {
  const {
    isConfigured,
    isConnected,
    wrongChain,
    isWorkbenchLoading,
    isWorkbenchError,
    draft,
    latestActiveSource,
    generatedScoreSource
  } = args;

  const publishDisabledReason = useMemo(() => {
    if (!isConnected) {
      return "请先连接考试院账户。";
    }
    if (wrongChain) {
      return "请先切换到项目链。";
    }
    if (isWorkbenchLoading) {
      return "正在读取当前发布状态，请稍候。";
    }
    if (isWorkbenchError) {
      return "当前无法确认链上发布状态，请稍后重试。";
    }
    if (!isConfigured) {
      return "系统配置未完成，暂时不能发布成绩源。";
    }
    if (!draft) {
      return "请先导入本届成绩。";
    }
    if (
      latestActiveSource?.scoreSourceId &&
      latestActiveSource.scoreSourceId === generatedScoreSource?.scoreSourceIdBytes32
    ) {
      return "本届成绩源已经发布，无需重复发布。";
    }
    if (!generatedScoreSource) {
      return "请先完成成绩数据校验。";
    }
    return null;
  }, [
    draft,
    generatedScoreSource,
    isConfigured,
    isConnected,
    isWorkbenchError,
    isWorkbenchLoading,
    latestActiveSource?.scoreSourceId,
    wrongChain
  ]);

  return {
    publishDisabledReason,
    canPublish: !publishDisabledReason
  };
}
