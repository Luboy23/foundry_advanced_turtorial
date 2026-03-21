export type SearchTargetType = "block" | "tx" | "address";

export type SearchTarget = {
  type: SearchTargetType;
  value: string;
};

// 区块号只允许十进制正整数字符串。
const BLOCK_NUMBER_PATTERN = /^\d+$/;
// 交易哈希固定为 0x + 64 hex。
const TX_HASH_PATTERN = /^0x[a-fA-F0-9]{64}$/;
// 地址固定为 0x + 40 hex。
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

/**
 * 解析搜索输入，识别目标类型（区块/交易/地址）。
 */
export function parseSearchTarget(raw: string): SearchTarget | null {
  const value = raw.trim();
  if (!value) return null;

  if (BLOCK_NUMBER_PATTERN.test(value)) {
    return { type: "block", value };
  }

  if (ADDRESS_PATTERN.test(value)) {
    return { type: "address", value };
  }

  if (TX_HASH_PATTERN.test(value)) {
    return { type: "tx", value };
  }

  return null;
}

/**
 * 根据已识别目标生成前端路由地址。
 */
export function buildSearchHref(target: SearchTarget): string {
  if (target.type === "block") return `/block/${target.value}`;
  if (target.type === "tx") return `/tx/${target.value}`;
  return `/address/${target.value}`;
}
