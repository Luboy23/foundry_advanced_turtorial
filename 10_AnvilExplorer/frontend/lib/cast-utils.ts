import { numberToHex, type Abi } from "viem";

/**
 * 安全解析 JSON 字符串；空字符串返回 `null`。
 */
export const parseJson = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return JSON.parse(trimmed);
};

/**
 * 解析 ABI JSON，支持两种输入：
 * 1) ABI 数组；
 * 2) `{ abi: [...] }` 对象。
 */
export const parseAbiJson = (value: string): Abi => {
  const parsed = parseJson(value);
  if (Array.isArray(parsed)) return parsed as Abi;
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { abi?: unknown }).abi)) {
    return (parsed as { abi: Abi }).abi;
  }
  throw new Error("ABI 格式不正确，应为 ABI 数组或包含 abi 字段的对象");
};

/**
 * 解析 topics 输入：
 * - JSON 数组；
 * - 逗号分隔字符串。
 */
export const parseTopics = (value: string): (string | null)[] | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) throw new Error("topics 需要是数组");
    return parsed as (string | null)[];
  }
  return trimmed.split(",").map((item) => {
    const cleaned = item.trim();
    if (!cleaned) return null;
    return cleaned;
  });
};

/**
 * 规范化区块标签输入，统一转换为 RPC 可接受格式。
 */
export const normalizeBlockTag = (value: string) => {
  const input = value.trim();
  if (!input) return "latest";
  if (["latest", "pending", "earliest", "safe", "finalized"].includes(input)) {
    return input;
  }
  if (input.startsWith("0x")) return input;
  const num = Number(input);
  if (!Number.isFinite(num)) throw new Error("区块格式错误");
  return numberToHex(BigInt(num));
};

/**
 * 解析数量参数：
 * - `0x` 前缀视为已是 quantity；
 * - 十进制自动转 quantity hex。
 */
export const parseQuantity = (value: string) => {
  const input = value.trim();
  if (!input) return undefined;
  if (input.startsWith("0x")) return input;
  return numberToHex(BigInt(input));
};

/**
 * 把执行结果统一转为字符串，便于控制台展示。
 */
export const toResultString = (value: unknown) => {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2) ?? String(value ?? "");
};
