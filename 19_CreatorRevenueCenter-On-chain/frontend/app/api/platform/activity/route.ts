import { NextResponse } from "next/server";
import { readPlatformActivityFromIndexer } from "@/lib/server/indexer";
import { buildReadModelMeta, toReadModelReason, withReadModelMeta } from "@/lib/server/read-model-meta";
import type { PlatformActivityResponse } from "@/types/domain";

function buildEmptyPayload(): Omit<PlatformActivityResponse, "meta"> {
  return {
    latestPublishContext: null
  };
}

export async function GET() {
  try {
    const payload = await readPlatformActivityFromIndexer();
    return NextResponse.json(withReadModelMeta(payload, buildReadModelMeta({ source: "indexer" })));
  } catch (error) {
    return NextResponse.json(
      withReadModelMeta(
        buildEmptyPayload(),
        buildReadModelMeta({
          source: "indexer",
          degraded: true,
          reason: toReadModelReason(error, "当前平台链上记录读取失败。")
        })
      )
    );
  }
}
