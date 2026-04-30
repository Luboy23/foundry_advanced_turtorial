import { NextResponse } from "next/server";
import { buildCurrentBillView, buildCurrentClaimPackageView, readCurrentBillInput, readCurrentClaimPackageInput } from "@/lib/server/bills";
import { readCurrentBillStatus } from "@/lib/server/chain";
import { buildReadModelMeta, toReadModelReason, withReadModelMeta } from "@/lib/server/read-model-meta";

export async function GET() {
  const billInput = readCurrentBillInput();
  const claimInput = readCurrentClaimPackageInput();
  let bill = buildCurrentBillView(billInput);
  let meta = buildReadModelMeta({ source: "server-data" });

  if (!claimInput.recipients.length) {
    return NextResponse.json({ error: "当前没有可领取账单" }, { status: 404 });
  }

  try {
    const status = await readCurrentBillStatus(bill);
    bill = buildCurrentBillView(billInput, status);
    meta = buildReadModelMeta({ source: "server-data+chain" });
  } catch (error) {
    meta = buildReadModelMeta({
      source: "server-data",
      degraded: true,
      reason: toReadModelReason(error, "当前领取条件读取失败，已回退到私有输入快照。")
    });
  }

  if (bill.status !== "claimable") {
    return NextResponse.json({ error: "当前账单暂不可领取，请刷新状态后再试。" }, { status: 409 });
  }

  return NextResponse.json(withReadModelMeta(buildCurrentClaimPackageView(bill, claimInput), meta));
}
