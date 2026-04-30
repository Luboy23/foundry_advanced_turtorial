import { NextRequest, NextResponse } from "next/server";
import { readCollaboratorReceipts } from "@/lib/server/chain";
import { readCollaboratorReceiptsFromIndexer } from "@/lib/server/indexer";
import { parsePaginationParams } from "@/lib/server/pagination";
import { buildReadModelMeta, toReadModelReason, withReadModelMeta } from "@/lib/server/read-model-meta";
import { readRuntimeConfigForScript } from "@/lib/runtime-config.server";
import type { CollaboratorReceiptsResponse } from "@/types/domain";

function buildEmptyCollaboratorReceipts(): Omit<CollaboratorReceiptsResponse, "meta"> {
  return {
    records: [],
    summary: {
      currentExpectedAmount: "0",
      currentExpectedAmountDisplay: "0.00",
      totalReceivedAmount: "0",
      totalReceivedDisplay: "0.00",
      totalReceiptCount: 0,
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
  const recipient =
    (searchParams.get("recipient") ??
      config.demoAddresses.collaboratorA) as `0x${string}`;

  if (fresh) {
    try {
      const payload = await readCollaboratorReceipts(recipient, { fresh: true, pagination });
      return NextResponse.json(withReadModelMeta(payload, buildReadModelMeta({ source: "chain" })));
    } catch (error) {
      return NextResponse.json(
        withReadModelMeta(
          buildEmptyCollaboratorReceipts(),
          buildReadModelMeta({
            source: "chain",
            degraded: true,
            reason: toReadModelReason(error, "当前协作者到账记录读取失败。")
          })
        )
      );
    }
  }

  let indexerError: unknown = null;
  try {
    const payload = await readCollaboratorReceiptsFromIndexer(recipient, pagination);
    return NextResponse.json(withReadModelMeta(payload, buildReadModelMeta({ source: "indexer" })));
  } catch (error) {
    indexerError = error;
  }

  try {
    const payload = await readCollaboratorReceipts(recipient, { fresh, pagination });
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
        buildEmptyCollaboratorReceipts(),
        buildReadModelMeta({
          source: "chain",
          degraded: true,
          reason: toReadModelReason(error, "当前协作者到账记录读取失败。")
        })
      )
    );
  }
}
