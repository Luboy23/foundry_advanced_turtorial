import { NextResponse } from "next/server";
import { serializeCredentialSetPublishHistory } from "@/lib/history-shared";
import { readAggregatedCredentialSetPublishHistory } from "@/lib/server/event-history-store";

export const runtime = "nodejs";

/** 从服务端聚合资格名单发布历史。 */
export async function GET() {
  try {
    const records = await readAggregatedCredentialSetPublishHistory();
    return NextResponse.json({ records: serializeCredentialSetPublishHistory(records) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "当前未能读取资格名单更新记录，请稍后重试。" },
      { status: 500 }
    );
  }
}
