import { NextRequest, NextResponse } from "next/server";
import { buildCurrentBillView, readCurrentBillInput } from "@/lib/server/bills";
import { readCurrentBillStatus, readPlatformHistoryFromChain } from "@/lib/server/chain";
import { readPlatformHistoryFromIndexer } from "@/lib/server/indexer";
import { parsePaginationParams, paginateRecords } from "@/lib/server/pagination";
import {
  buildPlatformHistoryCurrentMonthRecord,
  dedupePlatformHistoryRecords,
  sortPlatformHistoryRecords
} from "@/lib/server/platform-history";
import { buildReadModelMeta, toReadModelReason, withReadModelMeta } from "@/lib/server/read-model-meta";
import type { PlatformHistoryMonthRecord, PlatformHistoryResponse } from "@/types/domain";

async function readCurrentPlatformHistoryRecord(fresh: boolean) {
  const billInput = readCurrentBillInput();
  const snapshotBill = buildCurrentBillView(billInput);

  try {
    const status = await readCurrentBillStatus(snapshotBill, { fresh });
    return {
      record: buildPlatformHistoryCurrentMonthRecord(status),
      error: null as unknown
    };
  } catch (error) {
    return {
      record: buildPlatformHistoryCurrentMonthRecord(snapshotBill.status),
      error
    };
  }
}

function mergePlatformHistoryRecords(currentRecord: PlatformHistoryMonthRecord | null, historicalRecords: PlatformHistoryMonthRecord[]) {
  return sortPlatformHistoryRecords(
    dedupePlatformHistoryRecords(currentRecord ? [currentRecord, ...historicalRecords] : historicalRecords)
  );
}

function buildPayload(
  pagination: ReturnType<typeof parsePaginationParams>,
  records: PlatformHistoryMonthRecord[]
): Omit<PlatformHistoryResponse, "meta"> {
  const page = paginateRecords(records, pagination);
  return {
    records: page.items,
    pageInfo: page.pageInfo
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pagination = parsePaginationParams(searchParams);
  const fresh = searchParams.get("fresh") === "1";
  const { record: currentRecord, error: currentRecordError } = await readCurrentPlatformHistoryRecord(fresh);

  if (fresh) {
    try {
      const historicalRecords = await readPlatformHistoryFromChain({ fresh: true });
      return NextResponse.json(
        withReadModelMeta(
          buildPayload(pagination, mergePlatformHistoryRecords(currentRecord, historicalRecords)),
          buildReadModelMeta({
            source: "chain",
            degraded: currentRecordError != null,
            reason:
              currentRecordError != null
                ? toReadModelReason(currentRecordError, "当前月份状态读取失败，已回退到账单快照。")
                : null
          })
        )
      );
    } catch (error) {
      return NextResponse.json(
        withReadModelMeta(
          buildPayload(pagination, currentRecord ? [currentRecord] : []),
          buildReadModelMeta({
            source: currentRecord ? "server-data" : "chain",
            degraded: true,
            reason: toReadModelReason(error, "当前平台历史记录读取失败。")
          })
        )
      );
    }
  }

  let indexerError: unknown = null;
  try {
    const historicalRecords = await readPlatformHistoryFromIndexer();
    return NextResponse.json(
      withReadModelMeta(
        buildPayload(pagination, mergePlatformHistoryRecords(currentRecord, historicalRecords)),
        buildReadModelMeta({
          source: "indexer",
          degraded: currentRecordError != null,
          reason:
            currentRecordError != null
              ? toReadModelReason(currentRecordError, "当前月份状态读取失败，已回退到账单快照。")
              : null
        })
      )
    );
  } catch (error) {
    indexerError = error;
  }

  try {
    const historicalRecords = await readPlatformHistoryFromChain({ fresh });
    return NextResponse.json(
      withReadModelMeta(
        buildPayload(pagination, mergePlatformHistoryRecords(currentRecord, historicalRecords)),
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
        buildPayload(pagination, currentRecord ? [currentRecord] : []),
        buildReadModelMeta({
          source: currentRecord ? "server-data" : "chain",
          degraded: true,
          reason: toReadModelReason(error, "当前平台历史记录读取失败。")
        })
      )
    );
  }
}
