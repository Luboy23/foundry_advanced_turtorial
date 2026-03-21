import { setTimeout as delay } from "node:timers/promises";
import {
  createPublicClient,
  defineChain,
  http,
  isAddress,
  keccak256,
  type Address,
  type PublicClient,
  type TransactionReceipt,
} from "viem";
import { indexerConfig } from "../config.js";
import { nowTs, type DbClient, withTx } from "../db/client.js";
import { ensureReorgConsistency } from "./reorg.js";
import { extractTokenTransfers } from "./enrich.js";
import { serializeWithBigInt } from "../types/codec.js";

/**
 * 把链上数值统一转为可入库字符串；`null/undefined` 保持为空。
 */
const toNullableString = (
  value: bigint | number | null | undefined
): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? `${Math.floor(value)}` : null;
  return value.toString();
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

/**
 * 统计本地已索引区块数量。
 */
const getBlockCount = (db: DbClient) => {
  const row = db.prepare("SELECT COUNT(1) AS count FROM blocks").get() as { count: number };
  return row.count;
};

/**
 * 读取 `chain_meta.indexed_block`。
 */
const getIndexedBlock = (db: DbClient) => {
  const row = db.prepare("SELECT indexed_block FROM chain_meta WHERE id = 1").get() as
    | { indexed_block?: string }
    | undefined;
  return row?.indexed_block ? BigInt(row.indexed_block) : 0n;
};

/**
 * 读取指定区块号对应的本地区块哈希。
 */
const getBlockHashByNumber = (db: DbClient, blockNumber: bigint) => {
  const row = db.prepare("SELECT hash FROM blocks WHERE number = ?").get(blockNumber.toString()) as
    | { hash?: string }
    | undefined;
  return row?.hash ?? null;
};

/**
 * 父块哈希不一致错误：
 * 代表同步过程中遇到 Reorg，需回滚后重放。
 */
class ParentHashMismatchError extends Error {
  constructor(blockNumber: bigint, expectedParentHash: string, actualParentHash: string) {
    super(
      `parent hash mismatch at block ${blockNumber.toString()}: expected ${expectedParentHash}, got ${actualParentHash}`
    );
    this.name = "ParentHashMismatchError";
  }
}

/**
 * 初始化 `chain_meta` 元数据（首次启动执行）。
 */
const initMeta = (db: DbClient, chainId: number, rpcUrl: string) => {
  const exists = db.prepare("SELECT 1 FROM chain_meta WHERE id = 1").get();
  if (exists) return;
  db.prepare(
    "INSERT INTO chain_meta(id, chain_id, rpc_url, latest_rpc_block, indexed_block, updated_at) VALUES (1, ?, ?, '0', '0', ?)"
  ).run(chainId, rpcUrl, nowTs());
};

/**
 * 更新 RPC 最新块高度，用于健康检查与 lag 计算。
 */
const updateLatestRpcBlock = (db: DbClient, latest: bigint) => {
  db.prepare("UPDATE chain_meta SET latest_rpc_block = ?, updated_at = ? WHERE id = 1").run(
    latest.toString(),
    nowTs()
  );
};

/**
 * 写入创世块哈希，作为链指纹的一部分。
 */
const upsertGenesisHash = (db: DbClient, hash: string | null) => {
  if (!hash) return;
  db.prepare("UPDATE chain_meta SET genesis_hash = ?, updated_at = ? WHERE id = 1").run(hash, nowTs());
};

/**
 * 按当前配置构建 `PublicClient`。
 */
const prepareClient = () => {
  const chain = defineChain({
    id: indexerConfig.chainId,
    name: "IndexerChain",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [indexerConfig.rpcUrl] } },
  });
  return createPublicClient({ chain, transport: http(indexerConfig.rpcUrl) });
};

/**
 * 拉取并写入单个区块及其派生数据（tx/receipt/log/transfer/contract）。
 */
const writeBlock = async (
  db: DbClient,
  client: PublicClient,
  blockNumber: bigint
) => {
  const block = await client.getBlock({ blockNumber, includeTransactions: true });
  if (blockNumber > 0n) {
    // 与本地前一个区块做 parent hash 对齐，提前发现 Reorg。
    const expectedParentHash = getBlockHashByNumber(db, blockNumber - 1n);
    if (
      expectedParentHash &&
      expectedParentHash.toLowerCase() !== block.parentHash.toLowerCase()
    ) {
      throw new ParentHashMismatchError(
        blockNumber,
        expectedParentHash,
        block.parentHash
      );
    }
  }
  // 过滤掉仅 hash 形式的项，保留完整交易对象。
  const txObjects = (block.transactions as Array<any | string>).filter(
    (item): item is any => typeof item !== "string"
  );

  // 受控并发拉取交易回执，避免节点瞬时压力过高。
  const receipts = await mapWithConcurrency(txObjects, indexerConfig.receiptConcurrency, async (tx) => {
    try {
      const receipt = await client.getTransactionReceipt({ hash: tx.hash });
      return receipt;
    } catch {
      return null;
    }
  });
  const receiptMap = new Map(
    receipts
      .filter((receipt): receipt is TransactionReceipt => receipt !== null)
      .map((receipt) => [receipt.transactionHash, receipt])
  );

  // 按区块事务化写入，保证该块数据的一致性。
  withTx(db, () => {
    const blockStr = blockNumber.toString();
    db.prepare("DELETE FROM token_transfers WHERE block_number = ?").run(blockStr);
    db.prepare("DELETE FROM logs WHERE block_number = ?").run(blockStr);
    db.prepare("DELETE FROM transactions WHERE block_number = ?").run(blockStr);
    db.prepare("DELETE FROM blocks WHERE number = ?").run(blockStr);
    db.prepare("DELETE FROM contracts WHERE created_block = ?").run(blockStr);

    db.prepare(
      `INSERT INTO blocks(
        number, hash, parent_hash, timestamp, gas_limit, gas_used, base_fee_per_gas, miner, tx_count, raw_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      blockStr,
      block.hash ?? "",
      block.parentHash,
      Number(block.timestamp),
      toNullableString(block.gasLimit),
      toNullableString(block.gasUsed),
      toNullableString(block.baseFeePerGas),
      block.miner ?? null,
      txObjects.length,
      serializeWithBigInt(block)
    );

    const insertTx = db.prepare(
      `INSERT INTO transactions(
        hash, block_number, tx_index, from_address, to_address, nonce, value, gas_limit, gas_price,
        max_fee_per_gas, max_priority_fee_per_gas, input, type, status, contract_address, gas_used,
        effective_gas_price, raw_tx_json, raw_receipt_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    // `insertLog` 扁平化存储 topic0~topic3，便于按 topic/address 检索。
    const insertLog = db.prepare(
      `INSERT INTO logs(
        tx_hash, block_number, log_index, address, topic0, topic1, topic2, topic3, data, removed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    // `insertTransfer` 记录标准化后的 ERC20/721/1155 转账事件。
    const insertTransfer = db.prepare(
      `INSERT INTO token_transfers(
        tx_hash, log_index, block_number, token_address, standard, from_address, to_address, token_id, value
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    // 合约创建者表：由 `receipt.contractAddress` 直接反查创建交易与创建者。
    const upsertContract = db.prepare(
      `INSERT OR REPLACE INTO contracts(
        address, creator_tx_hash, creator_address, created_block, bytecode_hash, code_size, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    for (const tx of txObjects) {
      const receipt = receiptMap.get(tx.hash) ?? null;
      insertTx.run(
        tx.hash,
        blockStr,
        Number(tx.transactionIndex ?? 0),
        tx.from,
        tx.to ?? null,
        Number(tx.nonce ?? 0),
        toNullableString(tx.value),
        toNullableString(tx.gas),
        toNullableString(tx.gasPrice),
        toNullableString(tx.maxFeePerGas),
        toNullableString(tx.maxPriorityFeePerGas),
        tx.input ?? "0x",
        Number(tx.type ?? 0),
        receipt?.status === "success" ? 1 : receipt?.status === "reverted" ? 0 : null,
        receipt?.contractAddress ?? null,
        toNullableString(receipt?.gasUsed),
        toNullableString(receipt?.effectiveGasPrice),
        serializeWithBigInt(tx),
        receipt ? serializeWithBigInt(receipt) : null
      );

      if (receipt?.contractAddress && isAddress(receipt.contractAddress)) {
        upsertContract.run(
          receipt.contractAddress,
          receipt.transactionHash,
          receipt.from,
          blockStr,
          null,
          null,
          nowTs()
        );
      }

      const logs = receipt?.logs ?? [];
      for (const log of logs) {
        insertLog.run(
          log.transactionHash,
          blockStr,
          Number(log.logIndex ?? 0),
          log.address,
          log.topics[0] ?? null,
          log.topics[1] ?? null,
          log.topics[2] ?? null,
          log.topics[3] ?? null,
          log.data,
          log.removed ? 1 : 0
        );

        const transfers = extractTokenTransfers(log as TransactionReceipt["logs"][number]);
        for (const transfer of transfers) {
          insertTransfer.run(
            log.transactionHash,
            Number(log.logIndex ?? 0),
            blockStr,
            transfer.tokenAddress,
            transfer.standard,
            transfer.fromAddress,
            transfer.toAddress,
            transfer.tokenId,
            transfer.value
          );
        }
      }
    }

    db.prepare("UPDATE chain_meta SET indexed_block = ?, updated_at = ? WHERE id = 1").run(
      blockStr,
      nowTs()
    );
  });

  // 在交易提交后补全新合约代码信息，避免写事务期间阻塞太久。
  const contractRows = db
    .prepare("SELECT address FROM contracts WHERE created_block = ?")
    .all(blockNumber.toString()) as Array<{ address: string }>;

  for (const row of contractRows) {
    try {
      const code = await client.getBytecode({ address: row.address as Address });
      const codeSize = code && code !== "0x" ? (code.length - 2) / 2 : 0;
      const codeHash = code && code !== "0x" ? keccak256(code) : null;
      db.prepare("UPDATE contracts SET bytecode_hash = ?, code_size = ?, updated_at = ? WHERE address = ?").run(
        codeHash,
        codeSize,
        nowTs(),
        row.address
      );
    } catch {
      continue;
    }
  }
};

/**
 * 冷启动时计算回溯起点：
 * 仅回看最近 `bootstrapBlocks`，避免一次性扫描全链。
 */
const computeBootstrapFrom = (latest: bigint) => {
  const cap = BigInt(indexerConfig.bootstrapBlocks);
  const available = latest + 1n;
  const count = available < cap ? available : cap;
  return latest - count + 1n;
};

/**
 * 增量同步循环：
 * - `init`：初始化链元数据；
 * - `syncOnce`：执行一次增量同步；
 * - `runForever`：按轮询周期持续同步。
 */
export class SyncLoop {
  private db: DbClient;

  private client: PublicClient;

  private running = false;

  constructor(db: DbClient) {
    this.db = db;
    this.client = prepareClient();
  }

  /**
   * 初始化链指纹信息（如创世块哈希）。
   */
  async init() {
    initMeta(this.db, indexerConfig.chainId, indexerConfig.rpcUrl);
    try {
      const genesis = await this.client.getBlock({ blockNumber: 0n });
      upsertGenesisHash(this.db, genesis.hash ?? null);
    } catch {
      // noop
    }
  }

  /**
   * 暴露底层 `PublicClient` 给 API 层复用。
   */
  getClient() {
    return this.client;
  }

  /**
   * 执行一次同步：
   * 1) 刷新 latest；
   * 2) Reorg 一致性检查；
   * 3) 从 `indexed+1` 追到 `latest`。
   */
  async syncOnce() {
    const latest = await this.client.getBlockNumber();
    updateLatestRpcBlock(this.db, latest);

    const indexedAfterReorg = await ensureReorgConsistency(this.db, this.client);
    let indexed = indexedAfterReorg;
    // 首次无数据时触发冷启动窗口同步。
    const empty = getBlockCount(this.db) === 0;
    let start = indexed + 1n;

    if (empty) {
      start = computeBootstrapFrom(latest);
      indexed = start - 1n;
      this.db.prepare("UPDATE chain_meta SET indexed_block = ?, updated_at = ? WHERE id = 1").run(
        indexed.toString(),
        nowTs()
      );
    }

    if (start > latest) return;
    for (let blockNumber = start; blockNumber <= latest; blockNumber += 1n) {
      try {
        await writeBlock(this.db, this.client, blockNumber);
      } catch (error) {
        // 同步期间若父哈希不匹配，优先做回滚并等待下一轮重试。
        if (error instanceof ParentHashMismatchError) {
          await ensureReorgConsistency(this.db, this.client);
          return;
        }
        throw error;
      }
    }
  }

  /**
   * 常驻轮询：持续执行 `syncOnce`，错误只记录不终止进程。
   */
  async runForever() {
    if (this.running) return;
    this.running = true;
    while (this.running) {
      try {
        await this.syncOnce();
      } catch (error) {
        console.error("[indexer] sync error:", error);
      }
      await delay(indexerConfig.pollMs);
    }
  }

  /**
   * 停止同步循环（在进程退出时调用）。
   */
  stop() {
    this.running = false;
  }
}
