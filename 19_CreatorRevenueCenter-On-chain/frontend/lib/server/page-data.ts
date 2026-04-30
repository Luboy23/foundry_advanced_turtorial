import { buildCurrentBatchDraftView, buildCurrentBillView, readCurrentBatchInput, readCurrentBillInput } from "@/lib/server/bills";
import { readCurrentBatchFromChain, readCurrentBillStatus } from "@/lib/server/chain";
import { buildReadModelMeta, toReadModelReason, withReadModelMeta } from "@/lib/server/read-model-meta";
import type { CreatorSettlementBillResponse, RevenueBatchSummaryResponse } from "@/types/domain";

export async function readHomePageInitialData(): Promise<{
  bill: CreatorSettlementBillResponse;
  batch: RevenueBatchSummaryResponse;
}> {
  const billInput = readCurrentBillInput();
  let bill = buildCurrentBillView(billInput);
  let billMeta = buildReadModelMeta({ source: "server-data" });

  try {
    const status = await readCurrentBillStatus(bill);
    bill = buildCurrentBillView(billInput, status);
    billMeta = buildReadModelMeta({ source: "server-data+chain" });
  } catch (error) {
    billMeta = buildReadModelMeta({
      source: "server-data",
      degraded: true,
      reason: toReadModelReason(error, "当前账单状态读取失败，已回退到私有输入快照。")
    });
  }

  const draftBatch = buildCurrentBatchDraftView(readCurrentBatchInput());
  let batch = draftBatch;
  let batchMeta = buildReadModelMeta({ source: "server-data" });

  try {
    batch = await readCurrentBatchFromChain(draftBatch);
    batchMeta = buildReadModelMeta({ source: "server-data+chain" });
  } catch (error) {
    batchMeta = buildReadModelMeta({
      source: "server-data",
      degraded: true,
      reason: toReadModelReason(error, "当前批次状态读取失败，已回退到私有输入快照。")
    });
  }

  return {
    bill: withReadModelMeta(bill, billMeta),
    batch: withReadModelMeta(batch, batchMeta)
  };
}
