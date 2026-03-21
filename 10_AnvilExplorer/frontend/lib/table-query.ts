export type SortOrder = "asc" | "desc";

export type TableQuery = {
  page: number;
  pageSize: number;
  sort: string;
  order: SortOrder;
  filter: string;
};

type SearchParamsLike = Record<string, string | string[] | undefined>;

type ParseTableQueryOptions = {
  namespace: string;
  defaultSort: string;
  defaultOrder?: SortOrder;
  defaultPageSize?: number;
};

// 页面允许切换的 pageSize 白名单。
const PAGE_SIZE_WHITELIST = [10, 20, 50, 100];

/**
 * 从 query 参数中取第一个值（兼容 `string | string[]`）。
 */
const first = (value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) return value[0];
  return value;
};

/**
 * 安全解析正整数；非法值回退默认值。
 */
const toInt = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

/**
 * 生成带命名空间的表格查询参数键名。
 * 例如：`namespace=tx` + `sort` -> `txSort`。
 */
export const getTableParamKey = (
  namespace: string,
  key: "page" | "pageSize" | "sort" | "order" | "filter"
) => {
  const suffix = key.charAt(0).toUpperCase() + key.slice(1);
  return `${namespace}${suffix}`;
};

/**
 * 从 URL 查询参数解析分页/排序/筛选状态。
 */
export function parseTableQuery(
  searchParams: SearchParamsLike,
  options: ParseTableQueryOptions
): TableQuery {
  const page = toInt(first(searchParams[getTableParamKey(options.namespace, "page")]), 1);
  const sizeRaw = toInt(
    first(searchParams[getTableParamKey(options.namespace, "pageSize")]),
    options.defaultPageSize ?? 10
  );
  const pageSize = PAGE_SIZE_WHITELIST.includes(sizeRaw) ? sizeRaw : options.defaultPageSize ?? 10;
  const sort = first(searchParams[getTableParamKey(options.namespace, "sort")]) ?? options.defaultSort;
  const orderValue = first(searchParams[getTableParamKey(options.namespace, "order")]);
  const order: SortOrder = orderValue === "asc" ? "asc" : options.defaultOrder ?? "desc";
  // 统一裁剪筛选关键字，避免首尾空白影响匹配。
  const filter = (first(searchParams[getTableParamKey(options.namespace, "filter")]) ?? "").trim();

  return {
    page,
    pageSize,
    sort,
    order,
    filter,
  };
}

/**
 * 对数组做分页并返回安全页码信息。
 */
export function withPagination<T>(items: T[], page: number, pageSize: number) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const paged = items.slice(start, start + pageSize);

  return {
    page: safePage,
    pageSize,
    total,
    totalPages,
    items: paged,
  };
}

/**
 * 数值比较（bigint/number 混用场景）。
 */
export function compareNumberish(a: bigint | number, b: bigint | number): number {
  const left = typeof a === "bigint" ? a : BigInt(Math.floor(a));
  const right = typeof b === "bigint" ? b : BigInt(Math.floor(b));
  if (left > right) return 1;
  if (left < right) return -1;
  return 0;
}

/**
 * 文本比较（中文友好）。
 */
export function compareText(a: string, b: string): number {
  return a.localeCompare(b, "zh-CN", { sensitivity: "base" });
}

/**
 * 根据排序方向应用比较结果。
 */
export function applySortOrder(result: number, order: SortOrder): number {
  return order === "asc" ? result : -result;
}
