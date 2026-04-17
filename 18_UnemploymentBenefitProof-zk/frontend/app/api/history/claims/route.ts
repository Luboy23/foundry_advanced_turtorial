import { NextResponse } from "next/server";
import { isAddress } from "viem";
import type { Address } from "@/types/contract-config";
import { serializeClaimHistory } from "@/lib/history-shared";
import { readAggregatedClaimHistory } from "@/lib/server/event-history-store";

export const runtime = "nodejs";

/** 从服务端聚合当前部署的补助领取历史。 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const recipient = searchParams.get("recipient");

    if (recipient && !isAddress(recipient)) {
      return NextResponse.json({ error: "领取记录筛选地址无效。" }, { status: 400 });
    }

    const records = await readAggregatedClaimHistory(recipient ? (recipient as Address) : undefined);
    return NextResponse.json({ records: serializeClaimHistory(records) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "当前未能读取发放记录，请稍后重试。" },
      { status: 500 }
    );
  }
}
