import { isAddress, isHash, type Address, type Hex } from "viem";
import { getIndexerUrl } from "./rpc";

const DEFAULT_TIMEOUT_MS = 4000;
const BIGINT_TOKEN = "__indexer_bigint__";

/**
 * 把字符串/数字安全转为 bigint。
 */
const toBigInt = (value: string | number | bigint | null | undefined) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.floor(value));
  try {
    return BigInt(value);
  } catch {
    return null;
  }
};

/**
 * 解析 Indexer 存储的 JSON，并还原 bigint 标记值。
 */
const parseStoredJson = <T>(raw: string): T =>
  JSON.parse(raw, (_, value) => {
    if (typeof value === "string" && value.startsWith(BIGINT_TOKEN)) {
      return BigInt(value.slice(BIGINT_TOKEN.length));
    }
    return value;
  }) as T;

/**
 * 统一 HTTP 请求封装：
 * - 自动拼接 Indexer 基地址；
 * - 默认 JSON header；
 * - 内置超时中断。
 */
const requestJson = async <T>(path: string, init?: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${getIndexerUrl()}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      throw new Error(`indexer request failed: ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
};

export type IndexerChainMeta = {
  chainId: number;
  clientVersion: string;
  latestBlockNumber: bigint | null;
  latestBlockHash: string | null;
  latestBlockTimestamp: bigint | null;
  genesisHash: string | null;
};

/**
 * 拉取健康信息（indexed/latest/lag）。
 */
export const getIndexerHealth = async () => {
  const data = await requestJson<{
    ok: boolean;
    chainId: number;
    indexedBlock: string;
    latestRpcBlock: string;
    lag: string;
  }>("/v1/health");
  if (!data.ok) throw new Error("indexer health check failed");
  return {
    chainId: data.chainId,
    indexedBlock: toBigInt(data.indexedBlock) ?? 0n,
    latestRpcBlock: toBigInt(data.latestRpcBlock) ?? 0n,
    lag: toBigInt(data.lag) ?? 0n,
  };
};

/**
 * 拉取链指纹信息。
 */
export const getIndexerChainMeta = async (): Promise<IndexerChainMeta> => {
  const data = await requestJson<{
    ok: boolean;
    chainId: number;
    clientVersion: string;
    latestBlockNumber: string | null;
    latestBlockHash: string | null;
    latestBlockTimestamp: string | null;
    genesisHash: string | null;
  }>("/v1/meta/chain");
  if (!data.ok) throw new Error("indexer chain meta failed");
  return {
    chainId: data.chainId,
    clientVersion: data.clientVersion,
    latestBlockNumber: toBigInt(data.latestBlockNumber),
    latestBlockHash: data.latestBlockHash,
    latestBlockTimestamp: toBigInt(data.latestBlockTimestamp),
    genesisHash: data.genesisHash,
  };
};

export type IndexerBlockSummary = {
  number: bigint;
  hash: string;
  parentHash: string;
  timestamp: bigint;
  gasUsed: bigint | null;
  gasLimit: bigint | null;
  txCount: number;
};

/**
 * 分页读取区块摘要列表。
 */
export const getIndexerBlocks = async (options?: {
  limit?: number;
  cursor?: string;
  filter?: string;
  sort?: string;
  order?: "asc" | "desc";
}) => {
  const search = new URLSearchParams();
  if (options?.limit) search.set("limit", String(options.limit));
  if (options?.cursor) search.set("cursor", options.cursor);
  if (options?.filter) search.set("filter", options.filter);
  if (options?.sort) search.set("sort", options.sort);
  if (options?.order) search.set("order", options.order);
  const data = await requestJson<{
    ok: boolean;
    items: Array<{
      number: string;
      hash: string;
      parentHash: string;
      timestamp: string;
      gasUsed: string | null;
      gasLimit: string | null;
      txCount: number;
    }>;
    nextCursor: string | null;
  }>(`/v1/blocks?${search.toString()}`);
  if (!data.ok) throw new Error("indexer blocks failed");
  return {
    items: data.items.map((item) => ({
      number: BigInt(item.number),
      hash: item.hash,
      parentHash: item.parentHash,
      timestamp: BigInt(item.timestamp),
      gasUsed: toBigInt(item.gasUsed),
      gasLimit: toBigInt(item.gasLimit),
      txCount: item.txCount,
    })),
    nextCursor: data.nextCursor,
  };
};

export type IndexerRecentTx = {
  hash: Hex;
  blockNumber: bigint;
  from: Address;
  to: Address | null;
  value: bigint;
  nonce: number;
  timestamp: bigint;
  input: Hex;
};

/**
 * 分页读取交易摘要列表。
 */
export const getIndexerTransactions = async (options?: {
  limit?: number;
  cursor?: string;
  filter?: string;
  sort?: string;
  order?: "asc" | "desc";
  fromBlock?: bigint;
  toBlock?: bigint;
}) => {
  const search = new URLSearchParams();
  if (options?.limit) search.set("limit", String(options.limit));
  if (options?.cursor) search.set("cursor", options.cursor);
  if (options?.filter) search.set("filter", options.filter);
  if (options?.sort) search.set("sort", options.sort);
  if (options?.order) search.set("order", options.order);
  if (options?.fromBlock !== undefined) search.set("fromBlock", options.fromBlock.toString());
  if (options?.toBlock !== undefined) search.set("toBlock", options.toBlock.toString());
  const data = await requestJson<{
    ok: boolean;
    items: Array<{
      hash: string;
      blockNumber: string;
      from: string;
      to: string | null;
      value: string;
      nonce: number;
      timestamp: string;
      txIndex: number;
      input: string;
    }>;
    nextCursor: string | null;
  }>(`/v1/transactions?${search.toString()}`);
  if (!data.ok) throw new Error("indexer tx failed");
  return {
    items: data.items
      .filter((item) => isHash(item.hash) && isAddress(item.from))
      .map((item) => ({
        hash: item.hash as Hex,
        blockNumber: BigInt(item.blockNumber),
        from: item.from as Address,
        to: item.to && isAddress(item.to) ? (item.to as Address) : null,
        value: BigInt(item.value),
        nonce: item.nonce,
        timestamp: BigInt(item.timestamp),
        input:
          typeof item.input === "string" && item.input.startsWith("0x")
            ? (item.input as Hex)
            : ("0x" as Hex),
      })),
    nextCursor: data.nextCursor,
  };
};

/**
 * 读取区块详情（原始 block + tx 列表）。
 */
export const getIndexerBlockDetail = async (blockNumber: bigint) => {
  const data = await requestJson<{
    ok: boolean;
    rawBlockJson: string;
    rawTxJsonList: string[];
  }>(`/v1/blocks/${blockNumber.toString()}`);
  if (!data.ok) throw new Error("indexer block detail failed");
  const block = parseStoredJson<Record<string, unknown>>(data.rawBlockJson);
  const transactions = data.rawTxJsonList.map((item) => parseStoredJson(item));
  return { ...block, transactions };
};

/**
 * 读取交易详情（可选 trace）。
 */
export const getIndexerTxDetail = async (hash: string, includeTrace = false) => {
  if (!isHash(hash)) {
    throw new Error("交易哈希格式错误");
  }
  const data = await requestJson<{
    ok: boolean;
    rawTxJson: string;
    rawReceiptJson: string | null;
    rawBlockJson: string | null;
    latestBlockNumber: string | null;
    trace: unknown;
  }>(`/v1/transactions/${hash}?includeTrace=${includeTrace ? "1" : "0"}`);
  if (!data.ok) throw new Error("indexer tx detail failed");
  return {
    tx: parseStoredJson<Record<string, unknown>>(data.rawTxJson),
    receipt: data.rawReceiptJson
      ? parseStoredJson<Record<string, unknown>>(data.rawReceiptJson)
      : null,
    block: data.rawBlockJson ? parseStoredJson<Record<string, unknown>>(data.rawBlockJson) : null,
    latestBlockNumber: toBigInt(data.latestBlockNumber),
    trace: data.trace,
  };
};

/**
 * 读取地址摘要信息。
 */
export const getIndexerAddressSummary = async (rawAddress: string) => {
  if (!isAddress(rawAddress)) {
    throw new Error("地址格式错误");
  }
  const data = await requestJson<{
    ok: boolean;
    address: string;
    balance: string;
    nonce: number;
    bytecode: string;
    isContract: boolean;
    codeSize: number;
  }>(`/v1/addresses/${rawAddress}/summary`);
  if (!data.ok) throw new Error("indexer address summary failed");
  return {
    address: data.address as Address,
    balance: BigInt(data.balance),
    nonce: data.nonce,
    bytecode: data.bytecode as Hex,
    isContract: data.isContract,
    codeSize: data.codeSize,
  };
};

/**
 * 分页读取地址日志。
 */
export const getIndexerAddressLogs = async (rawAddress: string, options?: {
  limit?: number;
  cursor?: string;
  topic0?: string;
  fromBlock?: bigint;
  toBlock?: bigint;
}) => {
  if (!isAddress(rawAddress)) {
    throw new Error("地址格式错误");
  }
  const search = new URLSearchParams();
  if (options?.limit) search.set("limit", String(options.limit));
  if (options?.cursor) search.set("cursor", options.cursor);
  if (options?.topic0) search.set("topic0", options.topic0);
  if (options?.fromBlock !== undefined) search.set("fromBlock", options.fromBlock.toString());
  if (options?.toBlock !== undefined) search.set("toBlock", options.toBlock.toString());
  const data = await requestJson<{
    ok: boolean;
    items: Array<{
      transactionHash: string;
      blockNumber: string;
      logIndex: number;
      topics: string[];
      data: string;
      removed: boolean;
      address: string;
    }>;
    nextCursor: string | null;
  }>(`/v1/addresses/${rawAddress}/logs?${search.toString()}`);
  if (!data.ok) throw new Error("indexer address logs failed");
  return {
    items: data.items.map((item) => ({
      transactionHash: item.transactionHash as Hex,
      blockNumber: BigInt(item.blockNumber),
      logIndex: BigInt(item.logIndex),
      topics: item.topics as Hex[],
      data: item.data as Hex,
      removed: item.removed,
      address: item.address as Address,
    })),
    nextCursor: data.nextCursor,
  };
};

/**
 * 读取合约创建者信息（命中 contracts 索引表）。
 */
export const getIndexerContractCreator = async (rawAddress: string) => {
  if (!isAddress(rawAddress)) {
    throw new Error("地址格式错误");
  }
  const data = await requestJson<{
    ok: boolean;
    creator: {
      txHash: string;
      address: string;
      createdBlock: string;
      bytecodeHash: string | null;
      codeSize: number | null;
    } | null;
  }>(`/v1/addresses/${rawAddress}/creator`);
  if (!data.ok) throw new Error("indexer creator failed");
  return data.creator
    ? {
        txHash: data.creator.txHash as Hex,
        address: data.creator.address as Address,
        createdBlock: BigInt(data.creator.createdBlock),
        bytecodeHash: data.creator.bytecodeHash as Hex | null,
        codeSize: data.creator.codeSize,
      }
    : null;
};
