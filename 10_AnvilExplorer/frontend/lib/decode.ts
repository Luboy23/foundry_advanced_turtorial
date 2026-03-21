import {
  decodeEventLog,
  decodeFunctionData as viemDecodeFunctionData,
  toHex,
  type Abi,
  type Hex,
} from "viem";
import type { NamedAbi } from "./abis";

export type DecodedFunction = {
  functionName: string;
  args: unknown;
  abiName?: string;
};

export type DecodedEvent = {
  eventName: string;
  args: unknown;
  abiName?: string;
};

export type TokenTransfer = {
  token: string;
  from: string;
  to: string;
  value: bigint;
  logIndex?: bigint | number | null;
  txHash?: string;
};

// 标准 ERC20 Transfer 事件 ABI，用于通用转账识别。
const TRANSFER_ABI = [
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;

/**
 * 递归归一化解码值：
 * - bigint -> string；
 * - Uint8Array -> hex；
 * - 对象/数组递归处理。
 */
export function normalizeDecodedValue(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Uint8Array) {
    return toHex(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeDecodedValue(item));
  }

  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      output[key] = normalizeDecodedValue(item);
    }
    return output;
  }

  return value;
}

/**
 * 把解码结果转为可展示文本。
 */
export function formatDecodedValue(value: unknown): string {
  const normalized = normalizeDecodedValue(value);
  if (typeof normalized === "string") {
    return normalized;
  }
  const json = JSON.stringify(normalized, null, 2);
  return json ?? String(normalized ?? "-");
}

/**
 * 使用内置 ABI 注册表解码函数调用数据。
 * 优先走 selector 索引，再回退全量遍历。
 */
export function decodeFunctionDataWithRegistry(
  input: Hex,
  registry: NamedAbi[],
  selectorIndex?: Map<string, NamedAbi[]>
): DecodedFunction | null {
  if (!input || input === "0x" || input.length < 10) {
    return null;
  }

  const selector = input.slice(0, 10).toLowerCase();
  const fastCandidates = selectorIndex?.get(selector) ?? [];
  const candidates = fastCandidates.length > 0 ? fastCandidates : registry;

  for (const entry of candidates) {
    try {
      const decoded = viemDecodeFunctionData({ abi: entry.abi, data: input });
      return {
        functionName: decoded.functionName,
        args: decoded.args,
        abiName: entry.name,
      };
    } catch {
      continue;
    }
  }

  if (candidates !== registry) {
    for (const entry of registry) {
      if (fastCandidates.some((candidate) => candidate.name === entry.name)) {
        continue;
      }
      try {
        const decoded = viemDecodeFunctionData({ abi: entry.abi, data: input });
        return {
          functionName: decoded.functionName,
          args: decoded.args,
          abiName: entry.name,
        };
      } catch {
        continue;
      }
    }
  }

  return null;
}

/**
 * 使用内置 ABI 注册表解码日志。
 * 优先走 topic0 索引，再回退全量遍历。
 */
export function decodeLogWithRegistry(
  log: { data: Hex; topics: Hex[] },
  registry: NamedAbi[],
  topicIndex?: Map<string, NamedAbi[]>
): DecodedEvent | null {
  const topic0 = log.topics[0]?.toLowerCase();
  const fastCandidates = topic0 ? topicIndex?.get(topic0) ?? [] : [];
  const candidates = fastCandidates.length > 0 ? fastCandidates : registry;

  for (const entry of candidates) {
    try {
      const decoded = decodeEventLog({
        abi: entry.abi as any,
        data: log.data,
        topics: log.topics as any,
      } as any);
      return {
        eventName: decoded.eventName,
        args: decoded.args,
        abiName: entry.name,
      };
    } catch {
      continue;
    }
  }

  if (candidates !== registry) {
    for (const entry of registry) {
      if (fastCandidates.some((candidate) => candidate.name === entry.name)) {
        continue;
      }
      try {
        const decoded = decodeEventLog({
          abi: entry.abi as any,
          data: log.data,
          topics: log.topics as any,
        } as any);
        return {
          eventName: decoded.eventName,
          args: decoded.args,
          abiName: entry.name,
        };
      } catch {
        continue;
      }
    }
  }

  return null;
}

/**
 * 从日志中提取 ERC20 `Transfer` 记录。
 */
export function decodeTransfers(
  logs: readonly {
    address: string;
    data: Hex;
    topics: Hex[];
    logIndex?: bigint | number | null;
    transactionHash?: string;
  }[]
): TokenTransfer[] {
  const transfers: TokenTransfer[] = [];

  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: TRANSFER_ABI as any,
        data: log.data,
        topics: log.topics as any,
      } as any);

      if (decoded.eventName !== "Transfer") {
        continue;
      }

      const args = decoded.args as { from: string; to: string; value: bigint };
      transfers.push({
        token: log.address,
        from: args.from,
        to: args.to,
        value: args.value,
        logIndex: log.logIndex ?? null,
        txHash: log.transactionHash,
      });
    } catch {
      continue;
    }
  }

  return transfers;
}

/**
 * 使用指定 ABI 解码函数 input。
 */
export function decodeFunctionDataWithAbi(
  input: Hex,
  abi: Abi
): DecodedFunction | null {
  if (!input || input === "0x" || input.length < 10) {
    return null;
  }

  try {
    const decoded = viemDecodeFunctionData({ abi, data: input });
    return {
      functionName: decoded.functionName,
      args: decoded.args,
    };
  } catch {
    return null;
  }
}

/**
 * 使用指定 ABI 解码日志。
 */
export function decodeLogWithAbi(
  log: { data: Hex; topics: Hex[] },
  abi: Abi
): DecodedEvent | null {
  try {
    const decoded = decodeEventLog({
      abi: abi as any,
      data: log.data,
      topics: log.topics as any,
    } as any);
    return {
      eventName: decoded.eventName,
      args: decoded.args,
    };
  } catch {
    return null;
  }
}
