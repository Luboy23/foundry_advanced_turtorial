import type { PageInfo } from "@/types/domain";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function normalizeLimit(value: string | null | undefined) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, MAX_LIMIT);
}

function normalizeOffset(value: string | null | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

export function parsePaginationParams(searchParams: URLSearchParams) {
  const limit = normalizeLimit(searchParams.get("limit"));
  const offset = normalizeOffset(searchParams.get("cursor"));
  return {
    limit,
    offset,
    cursor: offset > 0 ? String(offset) : null
  };
}

export function paginateRecords<T>(
  records: T[],
  args: {
    limit: number;
    offset: number;
  }
) {
  const items = records.slice(args.offset, args.offset + args.limit);
  const nextOffset = args.offset + items.length;
  const pageInfo: PageInfo = {
    limit: args.limit,
    cursor: args.offset > 0 ? String(args.offset) : null,
    nextCursor: nextOffset < records.length ? String(nextOffset) : null,
    hasMore: nextOffset < records.length,
    totalCount: records.length
  };

  return {
    items,
    pageInfo
  };
}

export function buildPageInfo(args: {
  limit: number;
  offset: number;
  returnedCount: number;
  totalCount: number;
}): PageInfo {
  const nextOffset = args.offset + args.returnedCount;
  return {
    limit: args.limit,
    cursor: args.offset > 0 ? String(args.offset) : null,
    nextCursor: nextOffset < args.totalCount ? String(nextOffset) : null,
    hasMore: nextOffset < args.totalCount,
    totalCount: args.totalCount
  };
}
