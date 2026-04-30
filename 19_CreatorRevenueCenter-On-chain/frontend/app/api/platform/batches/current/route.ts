import { NextRequest, NextResponse } from "next/server";
import { buildCurrentBatchDraftView, readCurrentBatchInput } from "@/lib/server/bills";
import { readCurrentBatchFromChain } from "@/lib/server/chain";
import { buildReadModelMeta, toReadModelReason, withReadModelMeta } from "@/lib/server/read-model-meta";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fresh = searchParams.get("fresh") === "1";
  const draft = buildCurrentBatchDraftView(readCurrentBatchInput());

  try {
    const batch = await readCurrentBatchFromChain(draft, { fresh });
    return NextResponse.json(withReadModelMeta(batch, buildReadModelMeta({ source: "server-data+chain" })));
  } catch (error) {
    const meta = buildReadModelMeta({
      source: "server-data",
      degraded: true,
      reason: toReadModelReason(error, "当前批次状态读取失败，已回退到私有输入快照。")
    });
    return NextResponse.json(withReadModelMeta(draft, meta));
  }
}
