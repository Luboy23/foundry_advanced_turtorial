import { NextRequest, NextResponse } from "next/server";
import { readCreatorClaimHistory } from "@/lib/server/chain";
import { readCreatorHistoryFromIndexer } from "@/lib/server/indexer";
import { parsePaginationParams } from "@/lib/server/pagination";
import { buildReadModelMeta, toReadModelReason, withReadModelMeta } from "@/lib/server/read-model-meta";
import { readRuntimeConfigForScript } from "@/lib/runtime-config.server";
import type { CreatorHistoryResponse } from "@/types/domain";

function buildEmptyCreatorHistory(): Omit<CreatorHistoryResponse, "meta"> {
  return {
    records: [],
    summary: {
      totalClaimedDisplay: "0.00",
      totalClaimCount: 0,
      latestBatchLabel: null
    },
    pageInfo: {
      limit: 20,
      cursor: null,
      nextCursor: null,
      hasMore: false,
      totalCount: 0
    }
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pagination = parsePaginationParams(searchParams);
  const config = readRuntimeConfigForScript();
  const fresh = searchParams.get("fresh") === "1";
  const creator = (searchParams.get("creator") ?? config.demoAddresses.creator) as `0x${string}`;
  if (fresh) {
    try {
      const payload = await readCreatorClaimHistory(creator, { fresh: true, pagination });
      return NextResponse.json(withReadModelMeta(payload, buildReadModelMeta({ source: "chain" })));
    } catch (error) {
      return NextResponse.json(
        withReadModelMeta(
          buildEmptyCreatorHistory(),
          buildReadModelMeta({
            source: "chain",
            degraded: true,
            reason: toReadModelReason(error, "当前创作者历史记录读取失败。")
          })
        )
      );
    }
  }

  let indexerError: unknown = null;
  try {
    const payload = await readCreatorHistoryFromIndexer(creator, pagination);
    return NextResponse.json(withReadModelMeta(payload, buildReadModelMeta({ source: "indexer" })));
  } catch (error) {
    indexerError = error;
  }

  try {
    const payload = await readCreatorClaimHistory(creator, { fresh, pagination });
    return NextResponse.json(
      withReadModelMeta(
        payload,
        buildReadModelMeta({
          source: "chain",
          degraded: true,
          reason: toReadModelReason(indexerError, "索引器当前不可用，已切换到链上事件回退。")
        })
      )
    );
  } catch (error) {
    return NextResponse.json(
      withReadModelMeta(
        buildEmptyCreatorHistory(),
        buildReadModelMeta({
          source: "chain",
          degraded: true,
          reason: toReadModelReason(error, "当前创作者历史记录读取失败。")
        })
      )
    );
  }
}
