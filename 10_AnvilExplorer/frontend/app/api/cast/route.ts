import { NextResponse } from "next/server";
import {
  getCastApiMaxBodyBytes,
  getCastApiMaxParams,
  getCastApiTimeoutMs,
  getDataSourceMode,
  getIndexerUrl,
  getPublicClient,
  getRpcFallbackEnabled,
} from "@/lib/rpc";
import { isAddress, keccak256, type Hex } from "viem";

// 允许透传的只读 RPC method 白名单。
const ALLOWED_METHODS = new Set([
  "eth_blockNumber",
  "eth_getBlockByNumber",
  "eth_getBlockByHash",
  "eth_getTransactionByHash",
  "eth_getTransactionReceipt",
  "eth_getBalance",
  "eth_getTransactionCount",
  "eth_getCode",
  "eth_getStorageAt",
  "eth_getLogs",
  "eth_call",
  "eth_estimateGas",
  "eth_gasPrice",
  "eth_feeHistory",
  "eth_chainId",
  "web3_clientVersion",
  "trace_transaction",
  "debug_traceTransaction",
]);

// 内置 action 白名单（对常用 cast 能力做语义封装）。
const ALLOWED_ACTIONS = new Set(["codesize", "codehash", "age", "find-block"]);

/**
 * Cast API 统一错误类型：
 * - `status` 控制 HTTP 状态码；
 * - `code` 供前端做可编程错误分层。
 */
class CastRequestError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "bad_request") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type CastRequestPayload = {
  action?: unknown;
  method?: unknown;
  params?: unknown;
};

type CastRequest = {
  action?: string;
  method?: string;
  params: unknown[];
};

/**
 * 递归序列化响应，确保 bigint 可 JSON 输出。
 */
const serialize = (value: unknown): unknown => {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => [
        key,
        serialize(val),
      ])
    );
  }
  return value;
};

/**
 * 安全 JSON 解析，失败抛业务错误。
 */
const safeParseJson = (raw: string) => {
  try {
    return JSON.parse(raw);
  } catch {
    throw new CastRequestError("请求体不是有效 JSON", 400, "invalid_json");
  }
};

/**
 * 读取并校验请求体大小与 JSON 结构。
 */
const readJsonPayload = async (request: Request) => {
  const maxBodyBytes = getCastApiMaxBodyBytes();
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
    throw new CastRequestError(
      `请求体超限，最大 ${maxBodyBytes} bytes`,
      413,
      "payload_too_large"
    );
  }

  const raw = await request.text();
  const bodySize = new TextEncoder().encode(raw).length;
  if (bodySize > maxBodyBytes) {
    throw new CastRequestError(
      `请求体超限，最大 ${maxBodyBytes} bytes`,
      413,
      "payload_too_large"
    );
  }
  const parsed = safeParseJson(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new CastRequestError("请求体必须是 JSON 对象", 400, "invalid_payload");
  }
  return parsed as CastRequestPayload;
};

/**
 * 规范化请求结构并做字段级校验。
 */
const normalizeRequest = (payload: CastRequestPayload): CastRequest => {
  const { action, method, params } = payload;
  if (action !== undefined && typeof action !== "string") {
    throw new CastRequestError("action 必须为字符串", 422, "invalid_action");
  }
  if (method !== undefined && typeof method !== "string") {
    throw new CastRequestError("method 必须为字符串", 422, "invalid_method");
  }
  if (action && method) {
    throw new CastRequestError("action 与 method 只能二选一", 400, "conflict_operation");
  }
  if (!action && !method) {
    throw new CastRequestError("缺少 action 或 method", 400, "missing_operation");
  }

  const normalizedParams = params === undefined ? [] : params;
  if (!Array.isArray(normalizedParams)) {
    throw new CastRequestError("params 必须是数组", 422, "invalid_params");
  }
  if (normalizedParams.length > getCastApiMaxParams()) {
    throw new CastRequestError(
      `params 数量超限，最大 ${getCastApiMaxParams()} 个`,
      422,
      "params_too_many"
    );
  }

  return { action, method, params: normalizedParams };
};

/**
 * 解析区块引用参数（tag / 十进制 / 十六进制）。
 */
const resolveBlockRef = (value?: string) => {
  const input = (value ?? "").trim();
  if (!input) return { blockTag: "latest" as const };
  if (["latest", "pending", "earliest", "safe", "finalized"].includes(input)) {
    return { blockTag: input as any };
  }
  if (input.startsWith("0x")) return { blockNumber: BigInt(input) };
  return { blockNumber: BigInt(input) };
};

/**
 * 粗校验 32 字节哈希字符串。
 */
const isHashLike = (value?: string) => {
  if (!value) return false;
  return value.startsWith("0x") && value.length === 66;
};

/**
 * 给任意 Promise 增加超时保护。
 */
const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number) => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new CastRequestError("请求超时，请缩小查询范围后重试", 504, "rpc_timeout"));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

/**
 * 校验地址参数。
 */
const ensureAddress = (value: unknown, field = "address") => {
  if (typeof value !== "string" || !isAddress(value)) {
    throw new CastRequestError(`${field} 不是合法地址`, 422, "invalid_address");
  }
  return value;
};

/**
 * 校验并转换数字参数。
 */
const ensureFiniteNumber = (value: unknown, field = "value") => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new CastRequestError(`${field} 必须是数字`, 422, "invalid_number");
  }
  return parsed;
};

/**
 * 解析区块号参数，返回 bigint 或 `null`（表示 tag）。
 */
const parseBlockNumber = (value: unknown) => {
  if (typeof value !== "string") return null;
  const input = value.trim();
  if (!input) return null;
  if (["latest", "pending", "earliest", "safe", "finalized"].includes(input)) return null;
  if (input.startsWith("0x")) return BigInt(input);
  if (/^\d+$/.test(input)) return BigInt(input);
  throw new CastRequestError("区块参数格式错误", 422, "invalid_block");
};

/**
 * 针对高风险 method 做参数护栏校验。
 */
const validateMethodParams = (method: string, params: unknown[]) => {
  if (method === "eth_getLogs") {
    const filter = params[0];
    if (!filter || typeof filter !== "object" || Array.isArray(filter)) {
      throw new CastRequestError("eth_getLogs 需要对象参数", 422, "invalid_logs_filter");
    }
    const from = parseBlockNumber((filter as Record<string, unknown>).fromBlock);
    const to = parseBlockNumber((filter as Record<string, unknown>).toBlock);
    const maxRange = 5000n;
    if (from !== null && to !== null && to >= from && to - from > maxRange) {
      throw new CastRequestError(
        `eth_getLogs 区块范围过大，最大跨度 ${maxRange.toString()} 块`,
        422,
        "logs_range_too_large"
      );
    }
  }
};

/**
 * 统一错误响应格式。
 */
const errorResponse = (error: unknown) => {
  if (error instanceof CastRequestError) {
    return NextResponse.json(
      {
        ok: false,
        code: error.code,
        error: error.message,
      },
      { status: error.status }
    );
  }
  return NextResponse.json(
    {
      ok: false,
      code: "internal_error",
      error: error instanceof Error ? error.message : "请求失败",
    },
    { status: 500 }
  );
};

/**
 * 当前模式下是否优先尝试 Indexer 调试网关。
 */
const shouldTryIndexer = () => {
  const mode = getDataSourceMode();
  return mode === "indexer" || mode === "auto";
};

/**
 * Indexer 失败后是否允许回退本地 RPC。
 */
const shouldFallbackLocalRpc = () => {
  const mode = getDataSourceMode();
  if (mode === "rpc") return true;
  if (mode === "auto") return true;
  return getRpcFallbackEnabled();
};

/**
 * 代理到 Indexer `/v1/debug/rpc`。
 */
const proxyToIndexerDebugRpc = async (method: string, params: unknown[]) => {
  const response = await fetch(`${getIndexerUrl()}/v1/debug/rpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method, params }),
  });
  if (!response.ok) {
    throw new CastRequestError(
      `indexer debug rpc failed: ${response.status}`,
      response.status >= 500 ? 502 : response.status,
      "indexer_proxy_failed"
    );
  }
  // Indexer 调试网关统一返回 `{ ok, result, error }` 结构。
  const data = (await response.json()) as { ok?: boolean; result?: unknown; error?: string };
  if (!data.ok) {
    throw new CastRequestError(data.error ?? "indexer debug rpc failed", 502, "indexer_proxy_failed");
  }
  return data.result;
};

/**
 * Cast API 入口：
 * - 支持 action 与 method 两种模式；
 * - 优先 Indexer 调试网关，失败后按策略回退本地 RPC。
 */
export async function POST(request: Request) {
  // `payload` 为原始请求体，`normalized` 为校验后的可执行请求。
  let payload: CastRequestPayload;
  try {
    payload = await readJsonPayload(request);
  } catch (error) {
    return errorResponse(error);
  }

  let normalized: CastRequest;
  try {
    normalized = normalizeRequest(payload);
  } catch (error) {
    return errorResponse(error);
  }

  const client = getPublicClient();
  const { action, method, params } = normalized;
  // 全链路统一超时，防止页面长期挂起。
  const timeoutMs = getCastApiTimeoutMs();

  try {
    if (action) {
      if (!ALLOWED_ACTIONS.has(action)) {
        throw new CastRequestError("不支持的 action", 400, "action_not_allowed");
      }
      switch (action) {
        case "codesize": {
          const address = ensureAddress(params[0]);
          const blockRef = typeof params[1] === "string" ? params[1] : undefined;
          const bytecode = await withTimeout(
            client.getBytecode({
              address,
              ...resolveBlockRef(blockRef),
            }),
            timeoutMs
          );
          const size = bytecode && bytecode !== "0x" ? (bytecode.length - 2) / 2 : 0;
          return NextResponse.json({ ok: true, result: serialize({ size, bytecode }) });
        }
        case "codehash": {
          const address = ensureAddress(params[0]);
          const blockRef = typeof params[1] === "string" ? params[1] : undefined;
          const bytecode = await withTimeout(
            client.getBytecode({
              address,
              ...resolveBlockRef(blockRef),
            }),
            timeoutMs
          );
          const hash = bytecode ? keccak256(bytecode as Hex) : null;
          return NextResponse.json({ ok: true, result: serialize({ hash }) });
        }
        case "age": {
          const tag = typeof params[0] === "string" ? params[0] : undefined;
          let block;
          if (isHashLike(tag)) {
            block = await withTimeout(client.getBlock({ blockHash: tag as Hex }), timeoutMs);
          } else {
            const ref = resolveBlockRef(tag);
            block = await withTimeout(client.getBlock(ref as any), timeoutMs);
          }
          const now = Math.floor(Date.now() / 1000);
          const timestamp = Number(block.timestamp);
          const ageSeconds = now - timestamp;
          return NextResponse.json({
            ok: true,
            result: serialize({ blockNumber: block.number, timestamp, ageSeconds }),
          });
        }
        case "find-block": {
          // 二分查找最接近目标时间戳的区块。
          const target = ensureFiniteNumber(params[0], "目标时间戳");
          const latest = await withTimeout(client.getBlockNumber(), timeoutMs);
          let low = 0n;
          let high = latest;
          let bestNumber = 0n;
          let bestDiff = Number.MAX_SAFE_INTEGER;
          let iterations = 0;

          while (low <= high && iterations < 64) {
            iterations += 1;
            // `mid` 为当前二分探测的区块号。
            const mid = (low + high) / 2n;
            const block = await withTimeout(client.getBlock({ blockNumber: mid }), timeoutMs);
            const ts = Number(block.timestamp);
            const diff = Math.abs(ts - target);
            if (diff < bestDiff) {
              bestDiff = diff;
              bestNumber = block.number ?? mid;
            }
            if (ts === target) break;
            if (ts < target) low = mid + 1n;
            else high = mid - 1n;
          }

          const bestBlock = await withTimeout(
            client.getBlock({ blockNumber: bestNumber }),
            timeoutMs
          );
          return NextResponse.json({
            ok: true,
            result: serialize({
              blockNumber: bestBlock.number,
              timestamp: bestBlock.timestamp,
              diffSeconds: Math.abs(Number(bestBlock.timestamp) - target),
            }),
          });
        }
      }
    }

    if (!method) {
      throw new CastRequestError("缺少 method", 400, "missing_method");
    }

    if (!ALLOWED_METHODS.has(method)) {
      throw new CastRequestError("该 method 不允许调用", 403, "method_not_allowed");
    }

    if (shouldTryIndexer()) {
      try {
        const result = await withTimeout(proxyToIndexerDebugRpc(method, params), timeoutMs);
        return NextResponse.json({ ok: true, result: serialize(result) });
      } catch (error) {
        if (!shouldFallbackLocalRpc()) {
          return errorResponse(error);
        }
      }
    }

    validateMethodParams(method, params);

    const result = await withTimeout(
      client.request({
        method: method as any,
        params,
      } as any),
      timeoutMs
    );

    return NextResponse.json({ ok: true, result: serialize(result) });
  } catch (error) {
    return errorResponse(error);
  }
}
