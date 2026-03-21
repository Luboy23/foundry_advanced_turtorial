import {
  isAddress,
  isHash,
  type Address,
  type Hex,
  type Block,
  type TransactionReceipt,
} from "viem";
import {
  getCreatorMaxReceipts,
  getCreatorQuickScanBlocks,
  getPublicClient,
  getScanBlocks,
  getScanCacheTtlMs,
  getScanConcurrency,
} from "./rpc";
import { tryFromIndexer } from "./data-source";
import {
  getIndexerAddressLogs,
  getIndexerAddressSummary,
  getIndexerBlockDetail,
  getIndexerBlocks,
  getIndexerChainMeta,
  getIndexerContractCreator,
  getIndexerHealth,
  getIndexerTransactions,
  getIndexerTxDetail,
} from "./indexer-client";

/**
 * 把 bigint 转为可安全参与 `Number` 计算的值，避免溢出。
 */
const toSafeNumber = (value: bigint) => {
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  return value > max ? Number(max) : Number(value);
};

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

// 扫描结果缓存（key 与扫描窗口绑定）。
const scanCache = new Map<string, CacheEntry<any>>();
// 合约创建者查询缓存（key 与地址/模式/窗口绑定）。
const creatorCache = new Map<string, CacheEntry<CreatorLookupResult>>();

/**
 * 从缓存读取数据并处理过期失效。
 */
const getCached = <T>(cache: Map<string, CacheEntry<T>>, key: string) => {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.value;
};

/**
 * 写入缓存（ttl<=0 时不缓存）。
 */
const setCached = <T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
  ttlMs: number
) => {
  if (ttlMs <= 0) return;
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
};

/**
 * 有并发上限的异步 map，用于受控批量 RPC 请求。
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

export type ScanContext = {
  // 当前链最新区块。
  latest: bigint;
  // 扫描窗口起始区块（含）。
  from: bigint;
  // 扫描窗口内区块数量。
  count: number;
  // 实际扫描区块号列表（从新到旧）。
  blockNumbers: bigint[];
};

/**
 * 计算扫描上下文：
 * - 优先走 Indexer health；
 * - 回退到直连 RPC。
 */
export const getScanContext = async (scanBlocks = getScanBlocks()): Promise<ScanContext> => {
  const indexed = await tryFromIndexer(async () => {
    const health = await getIndexerHealth();
    const latest = health.latestRpcBlock;
    const maxBlocks = Math.max(1, scanBlocks);
    const available = toSafeNumber(latest) + 1;
    const count = Math.min(maxBlocks, available);
    const from = latest - BigInt(count - 1);
    const blockNumbers = Array.from({ length: count }, (_, i) => latest - BigInt(i));
    return { latest, from, count, blockNumbers };
  }, "get scan context from indexer");
  if (indexed) {
    return indexed;
  }

  const client = getPublicClient();
  const latest = await client.getBlockNumber();
  const maxBlocks = Math.max(1, scanBlocks);
  const available = toSafeNumber(latest) + 1;
  const count = Math.min(maxBlocks, available);
  const from = latest - BigInt(count - 1);
  const blockNumbers = Array.from({ length: count }, (_, i) => latest - BigInt(i));
  return { latest, from, count, blockNumbers };
};

/**
 * 生成区块列表缓存键。
 */
const getBlockCacheKey = (
  includeTransactions: boolean,
  context: ScanContext
) => `blocks:${includeTransactions ? "full" : "summary"}:${context.latest}:${context.count}`;

/**
 * 按扫描窗口读取区块，并按需缓存。
 */
const getBlocksInRange = async (
  context: ScanContext,
  includeTransactions: boolean
) => {
  const cacheKey = getBlockCacheKey(includeTransactions, context);
  const cached = getCached<Block[] | readonly Block[]>(scanCache, cacheKey);
  if (cached) {
    return cached;
  }

  const client = getPublicClient();
  const concurrency = getScanConcurrency();
  const blocks = await mapWithConcurrency(
    context.blockNumbers,
    concurrency,
    async (blockNumber) => client.getBlock({ blockNumber, includeTransactions } as any)
  );

  setCached(scanCache, cacheKey, blocks, getScanCacheTtlMs());
  return blocks;
};

/**
 * 获取最新区块列表（摘要）。
 */
export async function getLatestBlocks(scanBlocks = getScanBlocks()) {
  const context = await getScanContext(scanBlocks);
  const blocks = await getBlocksInRange(context, false);
  return { latest: context.latest, blocks };
}

export type RecentTransaction = {
  hash: Hex;
  blockNumber: bigint | null;
  from: Address;
  to: Address | null;
  value: bigint;
  nonce: number;
  timestamp: bigint | null;
  input: Hex;
};

/**
 * 获取最近区块摘要：
 * - Indexer 模式返回标准化摘要；
 * - RPC 模式返回真实区块对象。
 */
export async function getRecentBlockSummaries(
  scanBlocks = getScanBlocks(),
  context?: ScanContext
) {
  const resolved = context ?? (await getScanContext(scanBlocks));
  const indexed = await tryFromIndexer(async () => {
    const blocks = await getIndexerBlocks({
      limit: resolved.count,
      sort: "number",
      order: "desc",
    });
    const normalized = blocks.items.map((item) => ({
      number: item.number,
      hash: item.hash,
      parentHash: item.parentHash,
      timestamp: item.timestamp,
      gasUsed: item.gasUsed ?? 0n,
      gasLimit: item.gasLimit ?? 0n,
      transactions: new Array(Math.max(0, item.txCount)).fill("0x"),
    }));
    return { latest: resolved.latest, from: resolved.from, blocks: normalized as unknown as Block[] };
  }, "get block summaries from indexer");
  if (indexed) {
    return indexed;
  }

  const blocks = await getBlocksInRange(resolved, false);
  return { latest: resolved.latest, from: resolved.from, blocks };
}

/**
 * 获取最近交易列表。
 * Indexer 路径使用 cursor 分页拉取；RPC 路径从区块交易中展开。
 */
export async function getRecentTransactions(
  scanBlocks = getScanBlocks(),
  context?: ScanContext
) {
  const resolved = context ?? (await getScanContext(scanBlocks));
  const indexed = await tryFromIndexer(async () => {
    // `transactions` 聚合整个扫描窗口内的分页结果。
    const transactions: RecentTransaction[] = [];
    // `cursor` 用于续读下一页。
    let cursor: string | undefined;
    while (true) {
      const page = await getIndexerTransactions({
        limit: 5000,
        cursor,
        sort: "block",
        order: "desc",
        fromBlock: resolved.from,
        toBlock: resolved.latest,
      });
      transactions.push(...page.items);
      if (!page.nextCursor || page.items.length === 0) break;
      cursor = page.nextCursor;
      if (transactions.length >= 25_000) break;
    }
    return { latest: resolved.latest, from: resolved.from, transactions };
  }, "get transactions from indexer");
  if (indexed) {
    return indexed;
  }

  const blocks = await getBlocksInRange(resolved, true);
  const transactions: RecentTransaction[] = [];
  for (const block of blocks) {
    for (const transaction of block.transactions as any[]) {
      if (!transaction || typeof transaction === "string") continue;
      transactions.push({
        hash: transaction.hash,
        blockNumber: transaction.blockNumber ?? block.number ?? null,
        from: transaction.from,
        to: transaction.to ?? null,
        value: transaction.value ?? 0n,
        nonce: Number(transaction.nonce ?? 0),
        timestamp: block.timestamp ?? null,
        input:
          typeof transaction.input === "string"
            ? (transaction.input as Hex)
            : ("0x" as Hex),
      });
    }
  }

  return { latest: resolved.latest, from: resolved.from, transactions };
}

/**
 * 同时拉取最近区块与最近交易，供首页总览使用。
 */
export async function getRecentBlocksAndTransactions(scanBlocks = getScanBlocks()) {
  const context = await getScanContext(scanBlocks);
  const [blocksResult, txResult] = await Promise.all([
    getRecentBlockSummaries(scanBlocks, context),
    getRecentTransactions(scanBlocks, context),
  ]);

  return {
    latest: context.latest,
    from: context.from,
    blocks: blocksResult.blocks,
    transactions: txResult.transactions,
  };
}

/**
 * 获取链指纹信息（chainId/clientVersion/latest/genesis）。
 */
export async function getChainFingerprint() {
  const indexed = await tryFromIndexer(async () => {
    const meta = await getIndexerChainMeta();
    return {
      chainId: meta.chainId,
      clientVersion: meta.clientVersion,
      latestBlockNumber: meta.latestBlockNumber,
      latestBlockHash: meta.latestBlockHash,
      latestBlockTimestamp: meta.latestBlockTimestamp,
      genesisHash: meta.genesisHash,
    };
  }, "get chain fingerprint from indexer");
  if (indexed) {
    return indexed;
  }

  const client = getPublicClient();
  const [chainId, clientVersion, latestBlock] = await Promise.all([
    client.getChainId(),
    client.request({ method: "web3_clientVersion" } as any),
    client.getBlock(),
  ]);

  let genesisHash: string | null = null;
  try {
    const genesis = await client.getBlock({ blockNumber: 0n });
    genesisHash = genesis.hash ?? null;
  } catch {
    genesisHash = null;
  }

  return {
    chainId,
    clientVersion: typeof clientVersion === "string" ? clientVersion : String(clientVersion),
    latestBlockNumber: latestBlock.number ?? null,
    latestBlockHash: latestBlock.hash ?? null,
    latestBlockTimestamp: latestBlock.timestamp ?? null,
    genesisHash,
  };
}

/**
 * 获取区块详情（含交易）。
 */
export async function getBlockDetail(blockNumber: bigint) {
  const indexed = await tryFromIndexer(async () => {
    const block = await getIndexerBlockDetail(blockNumber);
    return block as any;
  }, "get block detail from indexer");
  if (indexed) {
    return indexed;
  }

  const client = getPublicClient();
  return client.getBlock({ blockNumber, includeTransactions: true });
}

/**
 * 获取交易与回执（基础版）。
 */
export async function getTxDetail(hash: string) {
  if (!isHash(hash)) {
    throw new Error("交易哈希格式错误");
  }
  const client = getPublicClient();
  const txHash = hash as Hex;
  const tx = await client.getTransaction({ hash: txHash });
  let receipt: TransactionReceipt | null = null;
  try {
    receipt = await client.getTransactionReceipt({ hash: txHash });
  } catch {
    receipt = null;
  }
  return { tx, receipt };
}

/**
 * 获取交易详情扩展信息（tx + receipt + block + latest）。
 */
export async function getTxDetailExtended(hash: string) {
  if (!isHash(hash)) {
    throw new Error("交易哈希格式错误");
  }
  const indexed = await tryFromIndexer(async () => {
    const detail = await getIndexerTxDetail(hash, false);
    return {
      tx: detail.tx as any,
      receipt: detail.receipt as any,
      block: detail.block as any,
      latestBlockNumber: detail.latestBlockNumber,
    };
  }, "get tx detail from indexer");
  if (indexed) {
    return indexed;
  }

  const client = getPublicClient();
  const txHash = hash as Hex;

  const [tx, latestBlockNumber] = await Promise.all([
    client.getTransaction({ hash: txHash }),
    client.getBlockNumber(),
  ]);

  let receipt: TransactionReceipt | null = null;
  try {
    receipt = await client.getTransactionReceipt({ hash: txHash });
  } catch {
    receipt = null;
  }

  let block = null;
  if (receipt?.blockNumber !== null && receipt?.blockNumber !== undefined) {
    try {
      block = await client.getBlock({ blockNumber: receipt.blockNumber });
    } catch {
      block = null;
    }
  }

  return { tx, receipt, block, latestBlockNumber };
}

export type TraceResult =
  | { type: "callTracer"; data: unknown }
  | { type: "traceTransaction"; data: unknown }
  | { type: "unsupported"; error: string };

/**
 * 统一提取错误消息。
 */
const getErrorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

/**
 * 读取交易 Trace：
 * 1) 优先 `debug_traceTransaction(callTracer)`；
 * 2) 回退 `trace_transaction`；
 * 3) 都失败则返回 unsupported。
 */
export async function traceTransaction(hash: string): Promise<TraceResult> {
  if (!isHash(hash)) {
    return { type: "unsupported", error: "交易哈希格式错误" };
  }
  const client = getPublicClient();
  const txHash = hash as Hex;

  let lastError = "节点不支持 trace";

  try {
    const result = await client.request({
      method: "debug_traceTransaction" as any,
      params: [txHash, { tracer: "callTracer" }],
    } as any);
    return { type: "callTracer", data: result };
  } catch (err) {
    lastError = getErrorMessage(err, lastError);
  }

  try {
    const result = await client.request({
      method: "trace_transaction" as any,
      params: [txHash],
    } as any);
    return { type: "traceTransaction", data: result };
  } catch (err) {
    lastError = getErrorMessage(err, lastError);
  }

  return { type: "unsupported", error: lastError };
}

/**
 * 获取地址摘要（余额/nonce/代码大小）。
 */
export async function getAddressInfo(rawAddress: string) {
  if (!isAddress(rawAddress)) {
    throw new Error("地址格式错误");
  }
  const indexed = await tryFromIndexer(async () => getIndexerAddressSummary(rawAddress), "get address summary from indexer");
  if (indexed) {
    return indexed;
  }

  const client = getPublicClient();
  const address = rawAddress as Address;
  const [balance, nonce, bytecode] = await Promise.all([
    client.getBalance({ address }),
    client.getTransactionCount({ address }),
    client.getBytecode({ address }),
  ]);

  const isContract = Boolean(bytecode && bytecode !== "0x");
  const codeSize = bytecode && bytecode !== "0x" ? (bytecode.length - 2) / 2 : 0;

  return { address, balance, nonce, bytecode, isContract, codeSize };
}

/**
 * 获取合约创建者（仅返回地址，深度模式）。
 */
export async function findContractCreator(rawAddress: string, scanBlocks = getScanBlocks()) {
  if (!isAddress(rawAddress)) return null;
  const result = await findContractCreatorDetailed(rawAddress, {
    mode: "deep",
    scanBlocks,
  });
  return result.creator;
}

export type CreatorLookupMode = "quick" | "deep";

export type CreatorLookupResult = {
  creator: Address | null;
  mode: CreatorLookupMode;
  latest: bigint;
  from: bigint;
  scannedBlocks: number;
  scannedReceipts: number;
  truncated: boolean;
};

/**
 * 生成创建者查询缓存键。
 */
const creatorCacheKey = (
  address: Address,
  context: ScanContext,
  mode: CreatorLookupMode
) => `creator:${address.toLowerCase()}:${mode}:${context.latest}:${context.from}`;

/**
 * 查找合约创建者（支持 quick/deep 两种模式）：
 * - 优先读 Indexer 的 contracts 索引；
 * - 回退 RPC receipt 扫描。
 */
export async function findContractCreatorDetailed(
  rawAddress: string,
  options?: { mode?: CreatorLookupMode; scanBlocks?: number }
): Promise<CreatorLookupResult> {
  if (!isAddress(rawAddress)) {
    throw new Error("地址格式错误");
  }
  const address = rawAddress as Address;
  const mode = options?.mode ?? "quick";

  const indexed = await tryFromIndexer(async () => {
    const creator = await getIndexerContractCreator(rawAddress);
    // Indexer 路径只需读取当前扫描上下文的 latest 用于回传元数据。
    const latest = (await getScanContext(options?.scanBlocks)).latest;
    const from = latest;
    return {
      creator: creator?.address ?? null,
      mode,
      latest,
      from,
      scannedBlocks: 0,
      scannedReceipts: 0,
      truncated: false,
    } satisfies CreatorLookupResult;
  }, "get contract creator from indexer");
  if (indexed && indexed.creator) {
    return indexed;
  }

  const scanBlocks = options?.scanBlocks ?? getScanBlocks();
  // quick 模式下强制使用较小扫描窗口，避免页面阻塞。
  const boundedScanBlocks =
    mode === "quick" ? Math.min(scanBlocks, getCreatorQuickScanBlocks()) : scanBlocks;
  const context = await getScanContext(boundedScanBlocks);
  const key = creatorCacheKey(address, context, mode);
  const cached = getCached(creatorCache, key);
  if (cached) {
    return cached;
  }

  const client = getPublicClient();
  // 限制扫描 receipt 总量，防止极端慢查询。
  const maxReceipts = getCreatorMaxReceipts();
  const receiptConcurrency = Math.max(1, Math.min(getScanConcurrency(), 6));
  const target = address.toLowerCase();

  let scannedBlocks = 0;
  let scannedReceipts = 0;
  let found: Address | null = null;
  let truncated = false;

  for (const blockNumber of context.blockNumbers) {
    scannedBlocks += 1;
    const block = await client.getBlock({ blockNumber });
    if (!block.transactions || block.transactions.length === 0) {
      continue;
    }

    // 仅保留交易哈希数组，后续再按并发拉取 receipt。
    const hashes = (block.transactions as Array<Hex | unknown>).filter(
      (item): item is Hex => typeof item === "string"
    );
    if (hashes.length === 0) {
      continue;
    }

    await mapWithConcurrency(hashes, receiptConcurrency, async (txHash) => {
      if (found || scannedReceipts >= maxReceipts) {
        return null;
      }
      scannedReceipts += 1;
      let receipt: TransactionReceipt | null = null;
      try {
        receipt = await client.getTransactionReceipt({ hash: txHash });
      } catch {
        return null;
      }

      if (receipt?.contractAddress?.toLowerCase() === target) {
        found = receipt.from as Address;
      }
      return null;
    });

    if (found) {
      break;
    }
    if (scannedReceipts >= maxReceipts) {
      truncated = true;
      break;
    }
  }

  const result: CreatorLookupResult = {
    creator: found,
    mode,
    latest: context.latest,
    from: context.from,
    scannedBlocks,
    scannedReceipts,
    truncated,
  };
  setCached(creatorCache, key, result, Math.max(8000, getScanCacheTtlMs() * 4));
  return result;
}

/**
 * 获取合约日志：
 * - 优先 Indexer 分页读取；
 * - 回退 RPC `getLogs`。
 */
export async function getContractLogs(
  rawAddress: string,
  scanBlocks = getScanBlocks()
) {
  if (!isAddress(rawAddress)) {
    throw new Error("地址格式错误");
  }
  const indexed = await tryFromIndexer(async () => {
    const context = await getScanContext(scanBlocks);
    const logs: Awaited<ReturnType<typeof getIndexerAddressLogs>>["items"] = [];
    let cursor: string | undefined;
    while (true) {
      const page = await getIndexerAddressLogs(rawAddress, {
        limit: 1000,
        cursor,
        fromBlock: context.from,
        toBlock: context.latest,
      });
      logs.push(...page.items);
      if (!page.nextCursor || page.items.length === 0) break;
      cursor = page.nextCursor;
      if (logs.length >= 20_000) break;
    }
    return logs as any;
  }, "get contract logs from indexer");
  if (indexed) {
    return indexed;
  }

  const address = rawAddress as Address;
  const client = getPublicClient();
  const { latest, from } = await getScanContext(scanBlocks);

  const logs = await client.getLogs({
    address,
    fromBlock: from,
    toBlock: latest,
  });

  return logs;
}
