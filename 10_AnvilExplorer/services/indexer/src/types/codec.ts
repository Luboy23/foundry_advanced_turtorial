const BIGINT_TOKEN = "__indexer_bigint__";

/**
 * 序列化任意对象，并把 bigint 转为可逆字符串标记。
 * 目的：SQLite JSON 列无法直接存 bigint，避免精度丢失。
 */
export const serializeWithBigInt = (value: unknown) =>
  JSON.stringify(value, (_, current) =>
    typeof current === "bigint" ? `${BIGINT_TOKEN}${current.toString()}` : current
  );

/**
 * 反序列化字符串，并把带标记的值还原为 bigint。
 */
export const parseWithBigInt = <T>(value: string): T =>
  JSON.parse(value, (_, current) => {
    if (typeof current === "string" && current.startsWith(BIGINT_TOKEN)) {
      return BigInt(current.slice(BIGINT_TOKEN.length));
    }
    return current;
  }) as T;
