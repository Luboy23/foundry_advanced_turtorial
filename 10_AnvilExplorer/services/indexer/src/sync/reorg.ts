import type { PublicClient } from "viem";
import type { DbClient } from "../db/client.js";
import { indexerConfig } from "../config.js";
import { nowTs, withTx } from "../db/client.js";

/**
 * 读取当前已索引到的最高区块号。
 */
const getIndexedBlock = (db: DbClient) => {
  const row = db
    .prepare("SELECT indexed_block FROM chain_meta WHERE id = 1")
    .get() as { indexed_block?: string } | undefined;
  return row?.indexed_block ? BigInt(row.indexed_block) : 0n;
};

/**
 * 从本地索引库读取指定区块的哈希。
 */
const getBlockHash = (db: DbClient, blockNumber: bigint) => {
  const row = db
    .prepare("SELECT hash FROM blocks WHERE number = ?")
    .get(blockNumber.toString()) as { hash?: string } | undefined;
  return row?.hash ?? null;
};

/**
 * 删除指定区块之后的全部索引数据，并回写 `indexed_block`。
 * 用于 Reorg 回滚后的重放。
 */
const deleteAfterBlock = (db: DbClient, blockNumber: bigint) => {
  const threshold = blockNumber.toString();
  withTx(db, () => {
    db.prepare("DELETE FROM token_transfers WHERE CAST(block_number AS INTEGER) > CAST(? AS INTEGER)").run(threshold);
    db.prepare("DELETE FROM logs WHERE CAST(block_number AS INTEGER) > CAST(? AS INTEGER)").run(threshold);
    db.prepare("DELETE FROM transactions WHERE CAST(block_number AS INTEGER) > CAST(? AS INTEGER)").run(threshold);
    db.prepare("DELETE FROM blocks WHERE CAST(number AS INTEGER) > CAST(? AS INTEGER)").run(threshold);
    db.prepare("DELETE FROM contracts WHERE CAST(created_block AS INTEGER) > CAST(? AS INTEGER)").run(threshold);
    db.prepare("UPDATE chain_meta SET indexed_block = ?, updated_at = ? WHERE id = 1").run(
      threshold,
      nowTs()
    );
  });
};

/**
 * 校验本地索引链与 RPC 主链是否一致。
 * 若发生 Reorg，则回滚到共同祖先并返回新的 `indexed_block`。
 */
export const ensureReorgConsistency = async (db: DbClient, client: PublicClient) => {
  let indexed = getIndexedBlock(db);
  if (indexed <= 0n) return indexed;

  // `start` 记录回溯前高度，用于判断是否发生实际回滚。
  const start = indexed;
  // 回溯深度上限，避免极端情况下无界循环。
  const maxDepth = BigInt(indexerConfig.maxReorgDepth);

  for (let steps = 0n; indexed >= 0n && steps <= maxDepth; steps += 1n) {
    const dbHash = getBlockHash(db, indexed);
    if (!dbHash) {
      indexed -= 1n;
      continue;
    }

    try {
      const block = await client.getBlock({ blockNumber: indexed });
      if (block.hash?.toLowerCase() === dbHash.toLowerCase()) {
        if (indexed !== start) {
          deleteAfterBlock(db, indexed);
        }
        return indexed;
      }
    } catch {
      indexed -= 1n;
      continue;
    }
    indexed -= 1n;
  }

  deleteAfterBlock(db, 0n);
  return 0n;
};
