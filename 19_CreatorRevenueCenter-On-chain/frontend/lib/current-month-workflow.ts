import type { CreatorSettlementBill, RevenueBatchSummary } from "@/types/domain";
import type { WorkflowRailStatus } from "@/components/ui/WorkflowStageRail";

export type WorkflowNoticeTone = "neutral" | "info" | "success" | "warning" | "danger";
export type CurrentMonthWorkflowRole = "home" | "platform" | "creator" | "collaborator";
export type CurrentMonthWorkflowPhase = "activate" | "claim" | "settled" | "paused" | "closed";

export type WorkflowRailStep = {
  label: string;
  description: string;
  status: WorkflowRailStatus;
};

export type CurrentMonthWorkflowCopy = {
  phase: CurrentMonthWorkflowPhase;
  statusLabel: string;
  statusTone: WorkflowNoticeTone;
  title: string;
  description: string;
  nextStep: string;
  expectedResult: string;
  blockingReason: string | null;
  steps: WorkflowRailStep[];
};

const WORKFLOW_STEPS = [
  {
    label: "平台激活",
    description: "锁定月份与资金"
  },
  {
    label: "创作者领取",
    description: "确认收益并触发结算"
  },
  {
    label: "协作者到账",
    description: "自动分账到账"
  }
] as const;

const PHASE_META: Record<
  CurrentMonthWorkflowPhase,
  {
    statusLabel: string;
    statusTone: WorkflowNoticeTone;
    stepStatuses: WorkflowRailStatus[];
  }
> = {
  activate: {
    statusLabel: "待平台激活",
    statusTone: "neutral",
    stepStatuses: ["active", "pending", "pending"]
  },
  claim: {
    statusLabel: "待创作者领取",
    statusTone: "success",
    stepStatuses: ["complete", "active", "pending"]
  },
  settled: {
    statusLabel: "本月已完成",
    statusTone: "info",
    stepStatuses: ["complete", "complete", "active"]
  },
  paused: {
    statusLabel: "已暂停",
    statusTone: "warning",
    stepStatuses: ["complete", "warning", "pending"]
  },
  closed: {
    statusLabel: "已关闭",
    statusTone: "danger",
    stepStatuses: ["complete", "danger", "pending"]
  }
};

const HOME_COPY: Record<
  CurrentMonthWorkflowPhase,
  Omit<CurrentMonthWorkflowCopy, "phase" | "statusLabel" | "statusTone" | "steps">
> = {
  activate: {
    title: "等待平台激活本月收益",
    description: "当前月份还没有锁定，领取和分账会在平台完成激活后开启。",
    nextStep: "平台录入月份和收益总额，并完成保存并激活。",
    expectedResult: "激活后创作者可领取，协作者进入待到账状态。",
    blockingReason: "平台尚未完成本月激活。"
  },
  claim: {
    title: "本月已激活，等待创作者领取",
    description: "资金和账单都已准备好，下一步由创作者确认领取。",
    nextStep: "创作者连接可写钱包并确认领取。",
    expectedResult: "领取确认后，创作者到账，协作者自动分账。",
    blockingReason: null
  },
  settled: {
    title: "本月收益已完成分配",
    description: "领取和分账已经完成，各角色现在都可以直接查看结果与记录。",
    nextStep: "进入对应工作台查看账单、历史记录和流水。",
    expectedResult: "本月结果已经落链，后续只会跟随新月份更新。",
    blockingReason: null
  },
  paused: {
    title: "本月流程已暂停",
    description: "平台暂时冻结了当前批次，领取和分账会在恢复前保持暂停。",
    nextStep: "平台选择恢复批次，或直接关闭本月。",
    expectedResult: "恢复后继续等待领取；关闭后进入只读状态。",
    blockingReason: "平台已暂停当前批次。"
  },
  closed: {
    title: "本月流程已关闭",
    description: "当前批次已经结束，不再接受新的领取或状态变更。",
    nextStep: "查看本月记录，或准备下一月份激活。",
    expectedResult: "本月保持只读，后续变更来自新月份。",
    blockingReason: "当前批次已关闭。"
  }
};

const PLATFORM_COPY: Record<
  CurrentMonthWorkflowPhase,
  Omit<CurrentMonthWorkflowCopy, "phase" | "statusLabel" | "statusTone" | "steps">
> = {
  activate: {
    title: "激活本月收益，开启领取",
    description: "当前月份还没有锁定，创作者暂时不能领取。",
    nextStep: "在下方录入月份和收益总额，提交保存并激活。",
    expectedResult: "激活后月份锁定，创作者进入可领取状态。",
    blockingReason: "本月还未完成激活。"
  },
  claim: {
    title: "本月已激活，等待创作者领取",
    description: "资金和账单已就绪，平台这边无需再次补资。",
    nextStep: "关注领取进度；如需临时冻结，可暂停批次。",
    expectedResult: "创作者领取后，协作者会自动到账。",
    blockingReason: null
  },
  settled: {
    title: "本月结算已完成",
    description: "领取和分账都已落链，平台侧进入复核与归档。",
    nextStep: "查看最近结果与历史记录，或准备后续月份。",
    expectedResult: "本月结果保持只读，后续通过新月份继续。",
    blockingReason: null
  },
  paused: {
    title: "批次已暂停，等待处理",
    description: "暂停期间创作者不能领取，当前月流程会保持冻结。",
    nextStep: "在批次控制中恢复或关闭当前批次。",
    expectedResult: "恢复后继续领取流程；关闭后本月只读。",
    blockingReason: "平台已暂停当前批次。"
  },
  closed: {
    title: "批次已关闭",
    description: "当前月份已结束，不再接受新的领取或状态变更。",
    nextStep: "查看历史记录，或继续录入未来月份。",
    expectedResult: "本月保持只读，新流程从未来月份开始。",
    blockingReason: "当前批次已关闭。"
  }
};

const CREATOR_COPY: Record<
  CurrentMonthWorkflowPhase,
  Omit<CurrentMonthWorkflowCopy, "phase" | "statusLabel" | "statusTone" | "steps">
> = {
  activate: {
    title: "等待平台激活后领取",
    description: "本月账单还没有锁定，领取入口会在平台激活后开放。",
    nextStep: "等待平台保存并激活当前月份。",
    expectedResult: "激活后你可以领取创作者净额，并自动触发协作者分账。",
    blockingReason: "平台尚未激活本月收益。"
  },
  claim: {
    title: "本月收益可以领取",
    description: "账单和分账数据都已准备好，确认后会完成创作者到账和协作者分账。",
    nextStep: "确认钱包可写，然后提交领取。",
    expectedResult: "交易确认后，收益到账并生成分账记录。",
    blockingReason: null
  },
  settled: {
    title: "本月收益已领取",
    description: "本月领取已经完成，到账和分账记录会保留在历史中。",
    nextStep: "查看历史记录或链上流水。",
    expectedResult: "本月无需重复操作，等待下一月份更新。",
    blockingReason: "本月已完成领取。"
  },
  paused: {
    title: "本月领取已暂停",
    description: "平台暂时冻结了当前批次，领取入口会在恢复前保持关闭。",
    nextStep: "等待平台恢复批次或关闭本月。",
    expectedResult: "恢复后可继续领取；关闭后本月只读。",
    blockingReason: "平台已暂停当前批次。"
  },
  closed: {
    title: "本月批次已关闭",
    description: "当前月份已经结束，不再开放新的领取。",
    nextStep: "查看本月账单、历史记录或流水。",
    expectedResult: "本月不会再变化，后续关注新月份。",
    blockingReason: "当前批次已关闭。"
  }
};

const COLLABORATOR_COPY: Record<
  CurrentMonthWorkflowPhase,
  Omit<CurrentMonthWorkflowCopy, "phase" | "statusLabel" | "statusTone" | "steps">
> = {
  activate: {
    title: "等待平台激活本月",
    description: "本月还没有进入结算流程，协作者暂时无需操作。",
    nextStep: "等待平台完成当前月激活。",
    expectedResult: "激活后进入等待创作者领取阶段。",
    blockingReason: "平台尚未激活本月收益。"
  },
  claim: {
    title: "正在等待创作者领取",
    description: "平台已经完成激活，创作者领取后你的分账会自动到账。",
    nextStep: "当前无需操作，等待创作者完成领取。",
    expectedResult: "到账后记录会出现在下方列表。",
    blockingReason: "创作者尚未领取。"
  },
  settled: {
    title: "本月分账已到账",
    description: "创作者已经完成领取，你的分账也已自动到账。",
    nextStep: "查看到账记录和历史明细。",
    expectedResult: "本月已完成，后续等待新月份更新。",
    blockingReason: null
  },
  paused: {
    title: "本月到账已暂停",
    description: "平台暂停了当前批次，到账流程会在恢复前保持冻结。",
    nextStep: "等待平台恢复批次或关闭本月。",
    expectedResult: "恢复后继续等待领取或到账。",
    blockingReason: "平台已暂停当前批次。"
  },
  closed: {
    title: "本月批次已关闭",
    description: "当前月份已经结束，不会再继续推进到账。",
    nextStep: "查看历史到账记录，等待下一月份。",
    expectedResult: "本月状态保持只读。",
    blockingReason: "当前批次已关闭。"
  }
};

function buildWorkflowSteps(phase: CurrentMonthWorkflowPhase): WorkflowRailStep[] {
  const meta = PHASE_META[phase];
  return WORKFLOW_STEPS.map((step, index) => ({
    ...step,
    status: meta.stepStatuses[index] ?? "pending"
  }));
}

export function resolveCurrentMonthWorkflowPhase(args: {
  batchStatus?: RevenueBatchSummary["status"] | null;
  billStatus?: CreatorSettlementBill["status"] | null;
}): CurrentMonthWorkflowPhase {
  const { batchStatus, billStatus } = args;

  if (billStatus === "claimed") {
    return "settled";
  }

  if (billStatus === "paused" || batchStatus === "paused") {
    return "paused";
  }

  if (billStatus === "closed" || batchStatus === "closed") {
    return "closed";
  }

  if (billStatus === "claimable" || batchStatus === "published") {
    return "claim";
  }

  return "activate";
}

export function getCurrentMonthWorkflowCopy(args: {
  role: CurrentMonthWorkflowRole;
  batchStatus?: RevenueBatchSummary["status"] | null;
  billStatus?: CreatorSettlementBill["status"] | null;
}): CurrentMonthWorkflowCopy {
  const phase = resolveCurrentMonthWorkflowPhase({
    batchStatus: args.batchStatus,
    billStatus: args.billStatus
  });
  const phaseMeta = PHASE_META[phase];
  const roleCopyMap =
    args.role === "platform"
      ? PLATFORM_COPY
      : args.role === "creator"
        ? CREATOR_COPY
        : args.role === "collaborator"
          ? COLLABORATOR_COPY
          : HOME_COPY;
  const roleCopy = roleCopyMap[phase];

  return {
    phase,
    statusLabel: phaseMeta.statusLabel,
    statusTone: phaseMeta.statusTone,
    title: roleCopy.title,
    description: roleCopy.description,
    nextStep: roleCopy.nextStep,
    expectedResult: roleCopy.expectedResult,
    blockingReason: roleCopy.blockingReason,
    steps: buildWorkflowSteps(phase)
  };
}
