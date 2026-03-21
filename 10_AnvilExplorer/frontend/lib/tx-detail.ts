import type { TraceResult } from "./data";

export type TraceRow = {
  id: string;
  depth: number;
  type?: string;
  from?: string;
  to?: string;
  value?: string;
  gas?: string;
  gasUsed?: string;
  input?: string;
  output?: string;
};

/**
 * 取 query 参数第一个值（兼容数组参数）。
 */
export const firstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/**
 * 把 Next.js 风格 `searchParams` 转为 `URLSearchParams`。
 */
export const toSearchParams = (params: Record<string, string | string[] | undefined>) => {
  const output = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const raw = firstParam(value);
    if (!raw) continue;
    output.set(key, raw);
  }
  return output;
};

/**
 * 把 callTracer 树形结构扁平化为表格可展示行。
 */
const flattenCallTracer = (node: any, depth = 0, path = "0"): TraceRow[] => {
  if (!node) return [];
  const current: TraceRow = {
    id: path,
    depth,
    type: node.type,
    from: node.from,
    to: node.to,
    value: node.value,
    gas: node.gas,
    gasUsed: node.gasUsed,
    input: node.input,
    output: node.output,
  };
  const children = Array.isArray(node.calls)
    ? node.calls.flatMap((child: any, index: number) =>
        flattenCallTracer(child, depth + 1, `${path}.${index}`)
      )
    : [];
  return [current, ...children];
};

/**
 * 统一归一化 trace 结果（callTracer / trace_transaction）。
 */
export const normalizeTraceRows = (trace: TraceResult | null): TraceRow[] => {
  if (!trace || trace.type === "unsupported") return [];

  if (trace.type === "callTracer") {
    return flattenCallTracer(trace.data);
  }

  if (trace.type === "traceTransaction" && Array.isArray(trace.data)) {
    return trace.data.map((item: any, index: number) => ({
      id: `trace-${index}`,
      depth: Array.isArray(item.traceAddress) ? item.traceAddress.length : 0,
      type: item.action?.callType ?? item.type,
      from: item.action?.from,
      to: item.action?.to,
      value: item.action?.value,
      gas: item.action?.gas,
      gasUsed: item.result?.gasUsed,
      input: item.action?.input,
      output: item.result?.output,
    }));
  }

  return [];
};

/**
 * 生成日志行稳定 key。
 * 优先使用链上 logIndex，缺失时回退到本地索引。
 */
export const getLogRowKey = (
  transactionHash: string,
  logIndex: bigint | number | null | undefined,
  fallbackIndex: number
) => {
  const suffix = logIndex !== null && logIndex !== undefined ? logIndex.toString() : `${fallbackIndex}`;
  return `${transactionHash}-${suffix}`;
};
