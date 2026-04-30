import { NextRequest, NextResponse } from "next/server";
import { buildCurrentBillView, readCurrentBillInput } from "@/lib/server/bills";
import { readCurrentBillStatus } from "@/lib/server/chain";
import { buildReadModelMeta, toReadModelReason, withReadModelMeta } from "@/lib/server/read-model-meta";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fresh = searchParams.get("fresh") === "1";
  const billInput = readCurrentBillInput();
  let bill = buildCurrentBillView(billInput);
  let meta = buildReadModelMeta({ source: "server-data" });

  try {
    const status = await readCurrentBillStatus(bill, { fresh });
    bill = buildCurrentBillView(billInput, status);
    meta = buildReadModelMeta({ source: "server-data+chain" });
  } catch (error) {
    meta = buildReadModelMeta({
      source: "server-data",
      degraded: true,
      reason: toReadModelReason(error, "当前账单状态读取失败，已回退到私有输入快照。")
    });
  }

  return NextResponse.json(withReadModelMeta(bill, meta));
}
