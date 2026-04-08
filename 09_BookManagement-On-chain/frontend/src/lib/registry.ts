import type { Abi } from "viem";
import bookManagementAbi from "@/lib/generated/book-management-abi.json";
import { getRuntimeConfig } from "@/lib/runtime-config";

const runtime = getRuntimeConfig();

// 合约地址：优先读取 runtime config，缺失时回退 .env.local。
export const registryAddress = runtime.bookManagementAddress;

export const TARGET_CHAIN_ID = runtime.chainId;

// 常用的 0x00 哈希常量
export const zeroHash =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

// BookManagement 合约 ABI：由 contracts artifact 自动同步（含 event）
export const registryAbi = bookManagementAbi as Abi;

// 链上 Book 结构体（前端类型）
export type RegistryBook = {
  id: bigint;
  contentHash: `0x${string}`;
  metaHash: `0x${string}`;
  policyHash: `0x${string}`;
  registrar: `0x${string}`;
  active: boolean;
  totalCopies: bigint;
  availableCopies: bigint;
};

type RawRegistryBook = readonly [
  bigint,
  `0x${string}`,
  `0x${string}`,
  `0x${string}`,
  `0x${string}`,
  boolean,
  bigint,
  bigint
];

type RawRegistryBookObject = {
  id?: unknown;
  contentHash?: unknown;
  metaHash?: unknown;
  policyHash?: unknown;
  registrar?: unknown;
  active?: unknown;
  totalCopies?: unknown;
  availableCopies?: unknown;
  [key: string]: unknown;
};

// 统一解码 getBook 结果，避免页面重复进行不安全断言。
export const decodeRegistryBook = (input: unknown): RegistryBook | null => {
  let id: unknown;
  let contentHash: unknown;
  let metaHash: unknown;
  let policyHash: unknown;
  let registrar: unknown;
  let active: unknown;
  let totalCopies: unknown;
  let availableCopies: unknown;

  if (Array.isArray(input) && input.length >= 8) {
    const tuple = input as unknown as RawRegistryBook;
    [id, contentHash, metaHash, policyHash, registrar, active, totalCopies, availableCopies] =
      tuple;
  } else if (typeof input === "object" && input !== null) {
    const book = input as RawRegistryBookObject;
    id = book.id ?? book["0"];
    contentHash = book.contentHash ?? book["1"];
    metaHash = book.metaHash ?? book["2"];
    policyHash = book.policyHash ?? book["3"];
    registrar = book.registrar ?? book["4"];
    active = book.active ?? book["5"];
    totalCopies = book.totalCopies ?? book["6"];
    availableCopies = book.availableCopies ?? book["7"];
  } else {
    return null;
  }

  if (
    typeof id !== "bigint" ||
    typeof contentHash !== "string" ||
    typeof metaHash !== "string" ||
    typeof policyHash !== "string" ||
    typeof registrar !== "string" ||
    typeof active !== "boolean" ||
    (typeof totalCopies !== "bigint" && typeof totalCopies !== "number") ||
    (typeof availableCopies !== "bigint" && typeof availableCopies !== "number")
  ) {
    return null;
  }

  return {
    id,
    contentHash: contentHash as `0x${string}`,
    metaHash: metaHash as `0x${string}`,
    policyHash: policyHash as `0x${string}`,
    registrar: registrar as `0x${string}`,
    active,
    totalCopies: typeof totalCopies === "number" ? BigInt(totalCopies) : totalCopies,
    availableCopies: typeof availableCopies === "number" ? BigInt(availableCopies) : availableCopies,
  };
};

// 链上借阅流水结构体（前端类型）
export type RegistryBorrowRecord = {
  id: bigint;
  reader: `0x${string}`;
  bookId: bigint;
  isBorrow: boolean;
  timestamp: bigint;
  operator: `0x${string}`;
};

type RawRegistryBorrowRecord = readonly [
  bigint,
  `0x${string}`,
  bigint,
  boolean,
  bigint,
  `0x${string}`
];

type RawRegistryBorrowRecordObject = {
  id?: unknown;
  reader?: unknown;
  bookId?: unknown;
  isBorrow?: unknown;
  timestamp?: unknown;
  operator?: unknown;
  [key: string]: unknown;
};

export const decodeBorrowRecord = (input: unknown): RegistryBorrowRecord | null => {
  let id: unknown;
  let reader: unknown;
  let bookId: unknown;
  let isBorrow: unknown;
  let timestamp: unknown;
  let operator: unknown;

  if (Array.isArray(input) && input.length >= 6) {
    const tuple = input as unknown as RawRegistryBorrowRecord;
    [id, reader, bookId, isBorrow, timestamp, operator] = tuple;
  } else if (typeof input === "object" && input !== null) {
    const record = input as RawRegistryBorrowRecordObject;
    id = record.id ?? record["0"];
    reader = record.reader ?? record["1"];
    bookId = record.bookId ?? record["2"];
    isBorrow = record.isBorrow ?? record["3"];
    timestamp = record.timestamp ?? record["4"];
    operator = record.operator ?? record["5"];
  } else {
    return null;
  }

  if (
    typeof id !== "bigint" ||
    typeof reader !== "string" ||
    typeof bookId !== "bigint" ||
    typeof isBorrow !== "boolean" ||
    typeof timestamp !== "bigint" ||
    typeof operator !== "string"
  ) {
    return null;
  }

  return {
    id,
    reader: reader as `0x${string}`,
    bookId,
    isBorrow,
    timestamp,
    operator: operator as `0x${string}`,
  };
};

// 链上注册用户（白名单）条目
export type RegisteredReader = {
  reader: `0x${string}`;
  active: boolean;
  registeredAt: bigint;
};

// 查询单个地址注册状态
export type ReaderStatus = {
  registered: boolean;
  active: boolean;
  registeredAt: bigint;
};

type RawRegisteredReader = readonly [`0x${string}`, boolean, bigint];
type RawReaderStatus = readonly [boolean, boolean, bigint];

type UnknownObject = Record<string, unknown>;

// 统一解码 getReaderAt 结果：支持 tuple/object 两种形态
export const decodeRegisteredReader = (input: unknown): RegisteredReader | null => {
  let reader: unknown;
  let active: unknown;
  let registeredAt: unknown;

  if (Array.isArray(input) && input.length >= 3) {
    const tuple = input as unknown as RawRegisteredReader;
    [reader, active, registeredAt] = tuple;
  } else if (typeof input === "object" && input !== null) {
    const row = input as UnknownObject;
    reader = row.reader ?? row["0"];
    active = row.active ?? row["1"];
    registeredAt = row.registeredAt ?? row["2"];
  } else {
    return null;
  }

  if (
    typeof reader !== "string" ||
    typeof active !== "boolean" ||
    typeof registeredAt !== "bigint"
  ) {
    return null;
  }

  return {
    reader: reader as `0x${string}`,
    active,
    registeredAt,
  };
};

// 统一解码 getReader 结果：支持 tuple/object 两种形态
export const decodeReaderStatus = (input: unknown): ReaderStatus | null => {
  let registered: unknown;
  let active: unknown;
  let registeredAt: unknown;

  if (Array.isArray(input) && input.length >= 3) {
    const tuple = input as unknown as RawReaderStatus;
    [registered, active, registeredAt] = tuple;
  } else if (typeof input === "object" && input !== null) {
    const row = input as UnknownObject;
    registered = row.registered ?? row["0"];
    active = row.active ?? row["1"];
    registeredAt = row.registeredAt ?? row["2"];
  } else {
    return null;
  }

  if (
    typeof registered !== "boolean" ||
    typeof active !== "boolean" ||
    typeof registeredAt !== "bigint"
  ) {
    return null;
  }

  return {
    registered,
    active,
    registeredAt,
  };
};
