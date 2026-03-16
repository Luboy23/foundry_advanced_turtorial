import { keccak256, stringToHex } from "viem";

// 统一构造哈希（用于书籍内容/元数据摘要）
export const buildHash = (payload: string, salt: string) => {
  const normalized = payload.trim();
  const prefix = salt.trim();
  const combined = prefix ? `${prefix}|${normalized}` : normalized;
  return keccak256(stringToHex(combined));
};
