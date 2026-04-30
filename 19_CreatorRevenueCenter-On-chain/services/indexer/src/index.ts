// @ts-nocheck
import { formatUnits } from "viem";
import { ponder } from "ponder:registry";
import * as schema from "ponder:schema";

/**
 * 这份 indexer 不只是把事件原样落表，而是在维护前端真正消费的读模型：
 * - revenue_batches 负责当前批次状态；
 * - claim_records / split_payment_records 负责明细；
 * - creator_month_summaries / collaborator_receipt_summaries 负责顶部统计卡和摘要。
 */
const amountDisplayVariants = {
  summary: { minFractionDigits: 2, maxFractionDigits: 4 },
  detail: { minFractionDigits: 2, maxFractionDigits: 6 }
} as const;
const batchLabelMap = (() => {
  const raw = process.env.PONDER_BATCH_LABEL_MAP;
  if (!raw || raw.trim().length === 0) {
    return {};
  }

  try {
    return Object.fromEntries(
      Object.entries(JSON.parse(raw)).flatMap(([batchId, label]) => {
        if (typeof batchId !== "string" || !batchId.startsWith("0x")) {
          return [];
        }

        if (typeof label !== "string" || label.trim().length === 0) {
          return [];
        }

        return [[batchId.toLowerCase(), label.trim()]];
      })
    );
  } catch {
    return {};
  }
})();

/**
 * indexer 会把金额展示值直接存进读模型表，方便前端少做重复格式化。
 * 这里先只处理千分位，后续再由 formatDecimalString 接管小数位规则。
 */
function addThousandsSeparators(input: string) {
  return input.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * 同一个金额在 summary / detail 卡片上的显示精度不同。
 * 这个函数把“原始十进制字符串 -> 产品展示字符串”的规则固定在 indexer 侧，
 * 让读模型从落表开始就具备稳定的展示值。
 */
function formatDecimalString(value: string, variant: keyof typeof amountDisplayVariants) {
  const options = amountDisplayVariants[variant];
  const negative = value.startsWith("-");
  const normalized = negative ? value.slice(1) : value;
  const [rawWhole, rawFraction = ""] = normalized.split(".");
  const whole = rawWhole.replace(/^0+(?=\d)/, "") || "0";
  const trimmedFraction = rawFraction.slice(0, options.maxFractionDigits).replace(/0+$/, "");
  const fraction =
    trimmedFraction.length >= options.minFractionDigits
      ? trimmedFraction
      : rawFraction.slice(0, options.minFractionDigits).padEnd(options.minFractionDigits, "0");

  return `${negative ? "-" : ""}${addThousandsSeparators(whole)}.${fraction}`;
}

/**
 * 当前项目统一按 18 位精度处理 ETH 金额，并在 indexer 落表时同步生成展示文案，
 * 这样前端列表和统计卡可以直接复用同一份显示值。
 */
function formatAssetAmount(value: bigint, variant: keyof typeof amountDisplayVariants) {
  return formatDecimalString(formatUnits(value, 18), variant);
}

/**
 * batchId 是链上哈希，页面更关心“2026-04”这种人类可读月份标签。
 * 这里优先走环境变量映射，缺失时再退回 batchId 截断值，保证任何批次都能有可展示标签。
 */
function resolveMonthLabel(batchId: `0x${string}`) {
  const normalized = batchId.toLowerCase();
  return batchLabelMap[normalized] ?? normalized.slice(0, 10);
}

/**
 * 发布事件是 revenue_batches 这张表的主入口。
 * indexer 会把平台每次 publish 规整成统一批次读模型，供首页和平台工作台直接消费。
 */
ponder.on("RevenueBatchRegistry:BatchPublished", async ({ event, context }) => {
  const batchId = String(event.args.batchId).toLowerCase() as `0x${string}`;
  const monthLabel = resolveMonthLabel(batchId);

  await context.db
    .insert(schema.revenueBatches)
    .values({
      batchId,
      monthLabel,
      tokenAddress: String(event.args.token).toLowerCase() as `0x${string}`,
      status: "published",
      merkleRoot: String(event.args.merkleRoot).toLowerCase() as `0x${string}`,
      metadataHash: String(event.args.metadataHash).toLowerCase() as `0x${string}`,
      publishedAt: event.block.timestamp,
      updatedAt: event.block.timestamp
    })
    .onConflictDoUpdate(() => ({
      status: "published",
      tokenAddress: String(event.args.token).toLowerCase() as `0x${string}`,
      merkleRoot: String(event.args.merkleRoot).toLowerCase() as `0x${string}`,
      metadataHash: String(event.args.metadataHash).toLowerCase() as `0x${string}`,
      updatedAt: event.block.timestamp
    }));
});

/**
 * 发布上下文事件承接“平台本次发布用的业务快照”，
 * 方便平台页和审计侧直接回看 month/bill/gross/creator 的链上留痕。
 */
ponder.on("RevenueBatchRegistry:BatchContextCommitted", async ({ event, context }) => {
  const batchId = String(event.args.batchId).toLowerCase() as `0x${string}`;
  const claimId = String(event.args.claimId).toLowerCase() as `0x${string}`;
  const creator = String(event.args.creator).toLowerCase() as `0x${string}`;
  const monthLabel = String(event.args.monthLabel);
  const billId = String(event.args.billId);
  const grossAmount = event.args.grossAmount;

  await context.db.insert(schema.batchPublishContexts).values({
    id: `${event.transaction.hash}:${event.log.logIndex}`,
    batchId,
    claimId,
    monthLabel,
    billId,
    grossAmount,
    grossAmountDisplay: formatAssetAmount(grossAmount, "summary"),
    creator,
    txHash: event.transaction.hash,
    blockNumber: event.block.number,
    committedAt: event.args.committedAt
  });
});

/**
 * pause / resume 都不新建批次，只更新现有批次的状态字段。
 * 这样前端始终只需要盯同一张 revenue_batches 表，就能感知状态切换。
 */
ponder.on("RevenueBatchRegistry:BatchPaused", async ({ event, context }) => {
  const batchId = String(event.args.batchId).toLowerCase() as `0x${string}`;
  const existing = await context.db.find(schema.revenueBatches, { batchId });
  if (!existing) return;

  await context.db.update(schema.revenueBatches, { batchId }).set({
    status: "paused",
    updatedAt: event.block.timestamp
  });
});

ponder.on("RevenueBatchRegistry:BatchResumed", async ({ event, context }) => {
  const batchId = String(event.args.batchId).toLowerCase() as `0x${string}`;
  const existing = await context.db.find(schema.revenueBatches, { batchId });
  if (!existing) return;

  await context.db.update(schema.revenueBatches, { batchId }).set({
    status: "published",
    updatedAt: event.block.timestamp
  });
});

/**
 * close 与 pause 一样属于状态迁移，但语义更终局。
 * indexer 在这里把批次改成 closed，让页面进入只读收口状态。
 */
ponder.on("RevenueBatchRegistry:BatchClosed", async ({ event, context }) => {
  const batchId = String(event.args.batchId).toLowerCase() as `0x${string}`;
  const existing = await context.db.find(schema.revenueBatches, { batchId });
  if (!existing) return;

  await context.db.update(schema.revenueBatches, { batchId }).set({
    status: "closed",
    updatedAt: event.block.timestamp
  });
});

/**
 * ClaimProcessed 是创作者历史的主记录来源。
 * 一条事件既要落成 claim_records 明细，也要同步维护 creator_month_summaries，
 * 因为前端既要渲染列表，也要快速显示“累计领取次数 / 累计 gross 金额”这类摘要。
 */
ponder.on("CreatorRevenueDistributor:ClaimProcessed", async ({ event, context }) => {
  const batchId = String(event.args.batchId).toLowerCase() as `0x${string}`;
  const claimId = String(event.args.claimId).toLowerCase() as `0x${string}`;
  const creator = String(event.args.creator).toLowerCase() as `0x${string}`;
  const tokenAddress = String(event.args.token).toLowerCase() as `0x${string}`;
  const monthLabel = resolveMonthLabel(batchId);
  const summaryId = `${creator}:${batchId}`;

  await context.db.insert(schema.claimRecords).values({
    id: `${event.transaction.hash}:${event.log.logIndex}`,
    batchId,
    monthLabel,
    claimId,
    creator,
    tokenAddress,
    grossAmount: event.args.grossAmount,
    grossAmountDisplay: formatAssetAmount(event.args.grossAmount, "detail"),
    txHash: event.transaction.hash,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp
  });

  await context.db
    .insert(schema.creatorMonthSummaries)
    .values({
      id: summaryId,
      batchId,
      monthLabel,
      creator,
      totalGrossAmount: event.args.grossAmount,
      totalGrossAmountDisplay: formatAssetAmount(event.args.grossAmount, "summary"),
      creatorNetAmount: 0n,
      creatorNetAmountDisplay: "0.00",
      claimCount: 1,
      lastClaimTxHash: event.transaction.hash,
      updatedAt: event.block.timestamp
    })
    .onConflictDoUpdate(() => ({
      totalGrossAmount: event.args.grossAmount,
      totalGrossAmountDisplay: formatAssetAmount(event.args.grossAmount, "summary"),
      claimCount: 1,
      lastClaimTxHash: event.transaction.hash,
      updatedAt: event.block.timestamp
    }));
});

/**
 * SplitPaid 是资金真正流向各收款人的流水事件。
 * - isCreator=false 时，它支撑协作者到账记录和累计汇总；
 * - isCreator=true 时，它负责把创作者本月净到账金额回填进月度摘要。
 */
ponder.on("CreatorRevenueDistributor:SplitPaid", async ({ event, context }) => {
  const batchId = String(event.args.batchId).toLowerCase() as `0x${string}`;
  const claimId = String(event.args.claimId).toLowerCase() as `0x${string}`;
  const recipient = String(event.args.recipient).toLowerCase() as `0x${string}`;
  const monthLabel = resolveMonthLabel(batchId);

  await context.db.insert(schema.splitPaymentRecords).values({
    id: `${event.transaction.hash}:${event.log.logIndex}`,
    batchId,
    monthLabel,
    claimId,
    recipient,
    amount: event.args.amount,
    amountDisplay: formatAssetAmount(event.args.amount, "detail"),
    bps: Number(event.args.bps),
    isCreator: event.args.isCreator,
    txHash: event.transaction.hash,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp
  });

  if (!event.args.isCreator) {
    // 协作者页的累计到账、到账次数和最近批次都来自这张汇总表，
    // 因此每次给协作者打款后都要在这里做增量累计。
    const existingCollaboratorSummary = await context.db.find(schema.collaboratorReceiptSummaries, { recipient });
    if (!existingCollaboratorSummary) {
      await context.db.insert(schema.collaboratorReceiptSummaries).values({
        recipient,
        totalReceivedAmount: event.args.amount,
        totalReceivedDisplay: formatAssetAmount(event.args.amount, "summary"),
        totalReceiptCount: 1,
        latestBatchLabel: monthLabel,
        updatedAt: event.block.timestamp
      });
      return;
    }

    const nextTotalReceivedAmount = existingCollaboratorSummary.totalReceivedAmount + event.args.amount;
    await context.db.update(schema.collaboratorReceiptSummaries, { recipient }).set({
      totalReceivedAmount: nextTotalReceivedAmount,
      totalReceivedDisplay: formatAssetAmount(nextTotalReceivedAmount, "summary"),
      totalReceiptCount: existingCollaboratorSummary.totalReceiptCount + 1,
      latestBatchLabel: monthLabel,
      updatedAt: event.block.timestamp
    });
    return;
  }

  // 创作者净额不是在 ClaimProcessed 时就知道的，
  // 因为真正到账数要以 SplitPaid(isCreator=true) 的结果为准。
  const summaryId = `${recipient}:${batchId}`;
  const existing = await context.db.find(schema.creatorMonthSummaries, { id: summaryId });
  if (!existing) return;

  await context.db.update(schema.creatorMonthSummaries, { id: summaryId }).set({
    creatorNetAmount: event.args.amount,
    creatorNetAmountDisplay: formatAssetAmount(event.args.amount, "summary"),
    updatedAt: event.block.timestamp
  });
});
