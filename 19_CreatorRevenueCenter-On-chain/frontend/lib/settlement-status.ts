import type { CreatorSettlementBill, RevenueBatchSummary } from "@/types/domain";

export function getBillStatusMeta(status: CreatorSettlementBill["status"]) {
  if (status === "claimable") {
    return {
      label: "可领取",
      tone: "success" as const,
      description: "当前批次已经发布，账单和分账数据都已准备完成，可以直接发起领取。"
    };
  }

  if (status === "claimed") {
    return {
      label: "已领取",
      tone: "info" as const,
      description: "当前账单已经完成领取，创作者到账和协作者分账都已写入链上记录。"
    };
  }

  if (status === "paused") {
    return {
      label: "已暂停",
      tone: "warning" as const,
      description: "平台暂时暂停了当前批次，领取动作已被阻断，等待平台恢复或关闭。"
    };
  }

  if (status === "closed") {
    return {
      label: "已关闭",
      tone: "danger" as const,
      description: "当前批次已经关闭，本月账单不再接受新的领取请求。"
    };
  }

  return {
    label: "待平台激活",
    tone: "neutral" as const,
    description: "当前月度账单还没有通过“保存并激活”写入链上，创作者暂时只能查看预览。"
  };
}

export function getPlatformBatchStatusMeta(status: RevenueBatchSummary["status"]) {
  if (status === "published") {
    return {
      label: "已发布",
      tone: "success" as const,
      description: "创作者现在可以基于当前批次发起领取。"
    };
  }

  if (status === "paused") {
    return {
      label: "已暂停",
      tone: "warning" as const,
      description: "当前批次暂时冻结，创作者不能继续领取。"
    };
  }

  if (status === "closed") {
    return {
      label: "已关闭",
      tone: "danger" as const,
      description: "当前批次已经结束，只保留只读状态和历史记录。"
    };
  }

  return {
    label: "待激活",
    tone: "neutral" as const,
    description: "平台还没有把当前批次通过单笔激活写入链上，创作者暂时只能查看预览账单。"
  };
}
