import { NextRequest, NextResponse } from "next/server";
import { readCreatorClaimHistory, readCreatorLedger } from "@/lib/server/chain";
import { readCreatorLedgerFromIndexer } from "@/lib/server/indexer";
import { parsePaginationParams } from "@/lib/server/pagination";
import { buildReadModelMeta, toReadModelReason, withReadModelMeta } from "@/lib/server/read-model-meta";
import { readRuntimeConfigForScript } from "@/lib/runtime-config.server";
import type { CreatorLedgerResponse } from "@/types/domain";

function buildEmptyCreatorLedger(): Omit<CreatorLedgerResponse, "meta"> {
  return {
    claimRecords: [],
    splitRecords: [],
    summary: {
      totalClaimedDisplay: "0.00",
      totalClaimCount: 0,
      latestBatchLabel: null
    },
    totals: {
      claimRecordCount: 0,
      splitRecordCount: 0
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
      const history = await readCreatorClaimHistory(creator, { fresh: true, pagination });
      const splitRecords = await readCreatorLedger(creator, { fresh: true, pagination });
      return NextResponse.json(
        withReadModelMeta(
          {
            claimRecords: history.records,
            splitRecords: splitRecords.records,
            summary: history.summary,
            totals: {
              claimRecordCount: history.pageInfo.totalCount,
              splitRecordCount: splitRecords.pageInfo.totalCount
            },
            pageInfo: {
              limit: pagination.limit,
              cursor: pagination.cursor,
              nextCursor:
                history.pageInfo.hasMore || splitRecords.pageInfo.hasMore
                  ? String(pagination.offset + pagination.limit)
                  : null,
              hasMore: history.pageInfo.hasMore || splitRecords.pageInfo.hasMore,
              totalCount: Math.max(history.pageInfo.totalCount, splitRecords.pageInfo.totalCount)
            }
          },
          buildReadModelMeta({ source: "chain" })
        )
      );
    } catch (error) {
      return NextResponse.json(
        withReadModelMeta(
          buildEmptyCreatorLedger(),
          buildReadModelMeta({
            source: "chain",
            degraded: true,
            reason: toReadModelReason(error, "当前流水明细读取失败。")
          })
        )
      );
    }
  }

  let indexerError: unknown = null;
  try {
    const payload = await readCreatorLedgerFromIndexer(creator, pagination);
    return NextResponse.json(withReadModelMeta(payload, buildReadModelMeta({ source: "indexer" })));
  } catch (error) {
    indexerError = error;
  }

  try {
    const history = await readCreatorClaimHistory(creator, { fresh, pagination });
    const splitRecords = await readCreatorLedger(creator, { fresh, pagination });
    return NextResponse.json(
      withReadModelMeta(
        {
          claimRecords: history.records,
          splitRecords: splitRecords.records,
          summary: history.summary,
          totals: {
            claimRecordCount: history.pageInfo.totalCount,
            splitRecordCount: splitRecords.pageInfo.totalCount
          },
          pageInfo: {
            limit: pagination.limit,
            cursor: pagination.cursor,
            nextCursor:
              history.pageInfo.hasMore || splitRecords.pageInfo.hasMore
                ? String(pagination.offset + pagination.limit)
                : null,
            hasMore: history.pageInfo.hasMore || splitRecords.pageInfo.hasMore,
            totalCount: Math.max(history.pageInfo.totalCount, splitRecords.pageInfo.totalCount)
          }
        },
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
        buildEmptyCreatorLedger(),
        buildReadModelMeta({
          source: "chain",
          degraded: true,
          reason: toReadModelReason(error, "当前流水明细读取失败。")
        })
      )
    );
  }
}
