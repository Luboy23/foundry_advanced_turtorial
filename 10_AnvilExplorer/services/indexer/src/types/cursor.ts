/**
 * 拆分并校验游标段数。
 * 不满足预期时抛错，防止错误游标导致分页错乱。
 */
const splitCursor = (cursor: string, expected: number) => {
  const parts = cursor.split(":");
  if (parts.length !== expected) {
    throw new Error("cursor 格式错误");
  }
  return parts;
};

/**
 * 解析区块分页游标。
 */
export const parseBlockCursor = (cursor?: string | null) => {
  if (!cursor) return null;
  return BigInt(cursor);
};

/**
 * 生成区块分页游标。
 */
export const buildBlockCursor = (blockNumber: bigint) => blockNumber.toString();

/**
 * 解析交易分页游标（`blockNumber:txIndex`）。
 */
export const parseTxCursor = (cursor?: string | null) => {
  if (!cursor) return null;
  const [block, index] = splitCursor(cursor, 2);
  return { blockNumber: BigInt(block), txIndex: Number(index) };
};

/**
 * 生成交易分页游标。
 */
export const buildTxCursor = (blockNumber: bigint, txIndex: number) =>
  `${blockNumber.toString()}:${txIndex}`;

/**
 * 解析日志分页游标（`blockNumber:logIndex`）。
 */
export const parseLogCursor = (cursor?: string | null) => {
  if (!cursor) return null;
  const [block, index] = splitCursor(cursor, 2);
  return { blockNumber: BigInt(block), logIndex: Number(index) };
};

/**
 * 生成日志分页游标。
 */
export const buildLogCursor = (blockNumber: bigint, logIndex: number) =>
  `${blockNumber.toString()}:${logIndex}`;
