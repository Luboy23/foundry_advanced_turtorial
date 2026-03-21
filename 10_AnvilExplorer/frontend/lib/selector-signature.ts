/**
 * 交易 input selector（前 4 字节）的格式：`0x` + 8 个十六进制字符。
 */
const SELECTOR_PATTERN = /^0x[0-9a-f]{8}$/;

const DEFAULT_CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const LOOKUP_TIMEOUT_MS = 2500;
const MAX_BATCH_SELECTORS = 12;
const BATCH_CONCURRENCY = 4;

const OPENCHAIN_ENDPOINT = "https://api.openchain.xyz/signature-database/v1/lookup";
const FOURBYTE_ENDPOINT = "https://www.4byte.directory/api/v1/signatures/";

type CacheEntry = {
  value: string | null;
  expiresAt: number;
};

type GlobalSelectorCache = typeof globalThis & {
  __anvilExplorerSelectorNameCache?: Map<string, CacheEntry>;
  __anvilExplorerSelectorLookupInFlight?: Map<string, Promise<string | null>>;
};

const globalState = globalThis as GlobalSelectorCache;

const selectorNameCache =
  globalState.__anvilExplorerSelectorNameCache ??
  (globalState.__anvilExplorerSelectorNameCache = new Map<string, CacheEntry>());

const selectorLookupInFlight =
  globalState.__anvilExplorerSelectorLookupInFlight ??
  (globalState.__anvilExplorerSelectorLookupInFlight = new Map<string, Promise<string | null>>());

/**
 * 从 input 中提取 selector（`0x12345678`）。
 */
export const getSelectorFromInput = (input?: string | null) => {
  if (!input || typeof input !== "string" || !input.startsWith("0x") || input.length < 10) {
    return null;
  }
  const selector = input.slice(0, 10).toLowerCase();
  if (!SELECTOR_PATTERN.test(selector)) {
    return null;
  }
  return selector;
};

/**
 * 从函数签名里提取函数名：`approve(address,uint256)` -> `approve`。
 */
const getFunctionNameFromSignature = (signature: string) => {
  const trimmed = signature.trim();
  const bracket = trimmed.indexOf("(");
  if (bracket <= 0) return trimmed;
  return trimmed.slice(0, bracket);
};

/**
 * 去重并保序。
 */
const unique = (values: string[]) => {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(value);
  }
  return output;
};

/**
 * 有并发上限的异步 map，避免批量 selector 查询产生突发请求。
 */
const mapWithConcurrency = async <T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
) => {
  const size = Math.max(1, concurrency);
  const output = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      output[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return output;
};

/**
 * 带超时的 fetch JSON。
 */
const fetchJsonWithTimeout = async <T>(url: string, timeoutMs = LOOKUP_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`selector lookup failed: ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * 读取 OpenChain 的 selector -> signature 结果。
 */
const lookupOpenChainSignatures = async (selector: string) => {
  type OpenChainItem = { name?: string } | string;
  type OpenChainResponse = {
    result?: {
      function?: Record<string, OpenChainItem[]>;
    };
  };

  try {
    const url = `${OPENCHAIN_ENDPOINT}?function=${encodeURIComponent(selector)}`;
    const data = await fetchJsonWithTimeout<OpenChainResponse>(url);
    const bucket =
      data.result?.function?.[selector] ??
      data.result?.function?.[selector.toLowerCase()] ??
      [];
    const signatures = bucket
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item.name === "string") return item.name.trim();
        return "";
      })
      .filter(Boolean);
    return unique(signatures);
  } catch {
    return [];
  }
};

/**
 * 读取 4byte 的 selector -> signature 结果。
 */
const lookup4ByteSignatures = async (selector: string) => {
  type FourByteResponse = {
    results?: Array<{ text_signature?: string }>;
  };

  try {
    const url = `${FOURBYTE_ENDPOINT}?hex_signature=${encodeURIComponent(selector)}`;
    const data = await fetchJsonWithTimeout<FourByteResponse>(url);
    const signatures = (data.results ?? [])
      .map((item) => item.text_signature?.trim() ?? "")
      .filter(Boolean);
    return unique(signatures);
  } catch {
    return [];
  }
};

/**
 * 从缓存读取 selector 结果；过期自动失效。
 */
const getCachedSelectorName = (selector: string) => {
  const cached = selectorNameCache.get(selector);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    selectorNameCache.delete(selector);
    return null;
  }
  return cached.value;
};

/**
 * 缓存 selector 结果（含空结果，避免重复外部查询）。
 */
const setCachedSelectorName = (
  selector: string,
  value: string | null,
  ttlMs = DEFAULT_CACHE_TTL_MS
) => {
  selectorNameCache.set(selector, {
    value,
    expiresAt: Date.now() + Math.max(1000, ttlMs),
  });
};

/**
 * 查询 selector 对应函数名：
 * 1) 优先 OpenChain；
 * 2) 回退 4byte；
 * 3) 结果进入内存缓存。
 */
export const lookupPublicFunctionName = async (rawSelector: string) => {
  const selector = rawSelector.toLowerCase();
  if (!SELECTOR_PATTERN.test(selector)) {
    return null;
  }

  const cached = getCachedSelectorName(selector);
  if (cached !== null) return cached;
  if (selectorNameCache.has(selector)) return null;

  const inFlight = selectorLookupInFlight.get(selector);
  if (inFlight) return inFlight;

  const task = (async () => {
    const openChainSignatures = await lookupOpenChainSignatures(selector);
    const signatures =
      openChainSignatures.length > 0
        ? openChainSignatures
        : await lookup4ByteSignatures(selector);
    const functionName =
      signatures.length > 0 ? getFunctionNameFromSignature(signatures[0]) : null;
    setCachedSelectorName(selector, functionName);
    return functionName;
  })();

  selectorLookupInFlight.set(selector, task);
  try {
    return await task;
  } finally {
    selectorLookupInFlight.delete(selector);
  }
};

/**
 * 批量查询 selector 对应函数名（自动去重）。
 */
export const resolvePublicFunctionNames = async (selectors: readonly string[]) => {
  const uniqueSelectors = unique(
    selectors
      .map((selector) => selector.toLowerCase())
      .filter((selector) => SELECTOR_PATTERN.test(selector))
  ).slice(0, MAX_BATCH_SELECTORS);
  const result = new Map<string, string>();
  await mapWithConcurrency(
    uniqueSelectors,
    BATCH_CONCURRENCY,
    async (selector) => {
      const functionName = await lookupPublicFunctionName(selector);
      if (functionName) {
        result.set(selector, functionName);
      }
      return null;
    }
  );
  return result;
};

/**
 * 测试辅助：清空 selector 查询缓存。
 */
export const clearSelectorLookupCacheForTest = () => {
  selectorNameCache.clear();
  selectorLookupInFlight.clear();
};
