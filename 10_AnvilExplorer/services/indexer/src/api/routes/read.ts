import { isAddress, isHash, type Hex, type PublicClient } from "viem";
import type { FastifyInstance } from "fastify";
import type { DbClient } from "../../db/client.js";
import {
  buildBlockCursor,
  buildLogCursor,
  buildTxCursor,
  parseBlockCursor,
  parseLogCursor,
  parseTxCursor,
} from "../../types/cursor.js";

/**
 * 读取并约束整数参数（limit/page 等）。
 */
const toInt = (value: unknown, fallback: number, min = 1, max = 1000) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
};

/**
 * 统一排序方向，默认降序。
 */
const toOrder = (value: unknown) => (value === "asc" ? "ASC" : "DESC");

/**
 * 字符串安全转 bigint；失败返回 null，避免路由中断。
 */
const safeBigInt = (value: string | null | undefined) => {
  if (!value) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
};

type RouteContext = {
  // SQLite 索引库连接。
  db: DbClient;
  // 直连节点 client（用于少量实时补充查询）。
  client: PublicClient;
};

/**
 * 注册读取接口（供前端页面查询）。
 * 主要包括：health、meta、blocks、transactions、address、search。
 */
export const registerReadRoutes = (app: FastifyInstance, context: RouteContext) => {
  const { db, client } = context;

  /**
   * 健康检查：返回 indexed/latest 与 lag。
   */
  app.get("/v1/health", async () => {
    const row = db.prepare("SELECT chain_id, indexed_block, latest_rpc_block FROM chain_meta WHERE id = 1").get() as
      | { chain_id: number; indexed_block: string; latest_rpc_block: string }
      | undefined;
    if (!row) {
      return { ok: false, error: "chain_meta not initialized" };
    }
    const indexed = safeBigInt(row.indexed_block) ?? 0n;
    const latest = safeBigInt(row.latest_rpc_block) ?? 0n;
    const lag = latest >= indexed ? latest - indexed : 0n;
    return {
      ok: true,
      chainId: row.chain_id,
      indexedBlock: row.indexed_block,
      latestRpcBlock: row.latest_rpc_block,
      lag: lag.toString(),
    };
  });

  /**
   * 链指纹：返回 chain_meta + 最新区块 + clientVersion。
   */
  app.get("/v1/meta/chain", async () => {
    const row = db.prepare(
      "SELECT chain_id, genesis_hash, latest_rpc_block, indexed_block, rpc_url FROM chain_meta WHERE id = 1"
    ).get() as
      | {
          chain_id: number;
          genesis_hash: string | null;
          latest_rpc_block: string;
          indexed_block: string;
          rpc_url: string;
        }
      | undefined;
    if (!row) {
      return { ok: false, error: "chain_meta not initialized" };
    }

    const latestBlock = await client.getBlock();
    const clientVersion = await client.request({ method: "web3_clientVersion" as never });
    return {
      ok: true,
      chainId: row.chain_id,
      rpcUrl: row.rpc_url,
      indexedBlock: row.indexed_block,
      latestRpcBlock: row.latest_rpc_block,
      genesisHash: row.genesis_hash,
      clientVersion: typeof clientVersion === "string" ? clientVersion : String(clientVersion),
      latestBlockNumber: latestBlock.number?.toString() ?? null,
      latestBlockHash: latestBlock.hash ?? null,
      latestBlockTimestamp: latestBlock.timestamp?.toString() ?? null,
    };
  });

  /**
   * 区块分页查询。
   * 支持 filter、sort、order、cursor（默认按区块号倒序）。
   */
  app.get("/v1/blocks", async (request) => {
    const query = request.query as Record<string, string | undefined>;
    // `limit` 控制单页条数，避免一次性返回过大数据。
    const limit = toInt(query.limit, 20, 1, 100);
    const sort = query.sort ?? "number";
    const order = toOrder(query.order);
    const filter = (query.filter ?? "").trim().toLowerCase();
    // `cursor` 只在按区块号分页时生效。
    const cursor = parseBlockCursor(query.cursor);

    const sortColumn = (() => {
      if (sort === "timestamp") return "timestamp";
      if (sort === "gasUsed") return "CAST(gas_used AS INTEGER)";
      if (sort === "txCount") return "tx_count";
      return "CAST(number AS INTEGER)";
    })();

    const conditions: string[] = [];
    const params: Array<string | number> = [];

    if (filter) {
      conditions.push("(LOWER(hash) LIKE ? OR number LIKE ?)");
      params.push(`%${filter}%`, `%${filter}%`);
    }

    if (cursor !== null && sort === "number") {
      conditions.push(
        order === "DESC" ? "CAST(number AS INTEGER) < CAST(? AS INTEGER)" : "CAST(number AS INTEGER) > CAST(? AS INTEGER)"
      );
      params.push(cursor.toString());
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const sql = `SELECT number, hash, parent_hash, timestamp, gas_used, gas_limit, tx_count FROM blocks ${where}
      ORDER BY ${sortColumn} ${order}, CAST(number AS INTEGER) ${order} LIMIT ?`;
    params.push(limit + 1);
    const rows = db.prepare(sql).all(...params) as Array<{
      number: string;
      hash: string;
      parent_hash: string;
      timestamp: number;
      gas_used: string | null;
      gas_limit: string | null;
      tx_count: number;
    }>;

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map((row) => ({
      number: row.number,
      hash: row.hash,
      parentHash: row.parent_hash,
      timestamp: row.timestamp.toString(),
      gasUsed: row.gas_used,
      gasLimit: row.gas_limit,
      txCount: row.tx_count,
    }));

    const last = items.at(-1);
    return {
      ok: true,
      items,
      nextCursor: hasMore && last ? buildBlockCursor(BigInt(last.number)) : null,
    };
  });

  /**
   * 区块详情：返回原始 block JSON + 区块内 tx JSON 列表。
   */
  app.get("/v1/blocks/:number", async (request, reply) => {
    const params = request.params as { number: string };
    if (!/^\d+$/.test(params.number)) {
      return reply.status(400).send({ ok: false, error: "invalid block number" });
    }
    const block = db.prepare("SELECT raw_json FROM blocks WHERE number = ?").get(params.number) as
      | { raw_json: string }
      | undefined;
    if (!block) {
      return reply.status(404).send({ ok: false, error: "block not found" });
    }
    const txs = db
      .prepare("SELECT raw_tx_json FROM transactions WHERE block_number = ? ORDER BY tx_index ASC")
      .all(params.number) as Array<{ raw_tx_json: string }>;
    return {
      ok: true,
      rawBlockJson: block.raw_json,
      rawTxJsonList: txs.map((item) => item.raw_tx_json),
    };
  });

  /**
   * 交易分页查询。
   * 支持 block/value/from/timestamp 排序与 fromBlock/toBlock 区间过滤。
   */
  app.get("/v1/transactions", async (request) => {
    const query = request.query as Record<string, string | undefined>;
    const limit = toInt(query.limit, 20, 1, 5000);
    const sort = query.sort ?? "block";
    const order = toOrder(query.order);
    // 交易过滤关键字（hash/from/to 模糊匹配）。
    const filter = (query.filter ?? "").trim().toLowerCase();
    const cursor = parseTxCursor(query.cursor);

    // 仅允许映射到白名单列，避免 SQL 注入风险。
    const sortColumn = (() => {
      if (sort === "timestamp") return "b.timestamp";
      if (sort === "value") return "CAST(t.value AS INTEGER)";
      if (sort === "from") return "t.from_address";
      return "CAST(t.block_number AS INTEGER)";
    })();

    const conditions: string[] = [];
    const params: Array<string | number> = [];

    if (filter) {
      conditions.push(
        "(LOWER(t.hash) LIKE ? OR LOWER(t.from_address) LIKE ? OR LOWER(COALESCE(t.to_address, '')) LIKE ?)"
      );
      params.push(`%${filter}%`, `%${filter}%`, `%${filter}%`);
    }

    if (query.fromBlock) {
      conditions.push("CAST(t.block_number AS INTEGER) >= CAST(? AS INTEGER)");
      params.push(query.fromBlock);
    }
    if (query.toBlock) {
      conditions.push("CAST(t.block_number AS INTEGER) <= CAST(? AS INTEGER)");
      params.push(query.toBlock);
    }

    if (cursor && sort === "block") {
      conditions.push(
        order === "DESC"
          ? "(CAST(t.block_number AS INTEGER) < CAST(? AS INTEGER) OR (CAST(t.block_number AS INTEGER) = CAST(? AS INTEGER) AND t.tx_index < ?))"
          : "(CAST(t.block_number AS INTEGER) > CAST(? AS INTEGER) OR (CAST(t.block_number AS INTEGER) = CAST(? AS INTEGER) AND t.tx_index > ?))"
      );
      params.push(cursor.blockNumber.toString(), cursor.blockNumber.toString(), cursor.txIndex);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const sql = `SELECT t.hash, t.block_number, t.from_address, t.to_address, t.value, t.nonce, b.timestamp, t.tx_index, t.input
      FROM transactions t
      JOIN blocks b ON b.number = t.block_number
      ${where}
      ORDER BY ${sortColumn} ${order}, CAST(t.block_number AS INTEGER) ${order}, t.tx_index ${order}
      LIMIT ?`;
    params.push(limit + 1);
    const rows = db.prepare(sql).all(...params) as Array<{
      hash: string;
      block_number: string;
      from_address: string;
      to_address: string | null;
      value: string | null;
      nonce: number | null;
      timestamp: number;
      tx_index: number;
      input: string | null;
    }>;
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map((row) => ({
      hash: row.hash,
      blockNumber: row.block_number,
      from: row.from_address,
      to: row.to_address,
      value: row.value ?? "0",
      nonce: row.nonce ?? 0,
      timestamp: row.timestamp.toString(),
      txIndex: row.tx_index,
      input: row.input ?? "0x",
    }));
    const last = items.at(-1);
    return {
      ok: true,
      items,
      nextCursor:
        hasMore && last
          ? buildTxCursor(BigInt(last.blockNumber), last.txIndex)
          : null,
    };
  });

  /**
   * 交易详情：返回 tx/receipt/block 原始 JSON，并可按需带 trace。
   */
  app.get("/v1/transactions/:hash", async (request, reply) => {
    const params = request.params as { hash: string };
    const query = request.query as { includeTrace?: string };
    if (!isHash(params.hash)) {
      return reply.status(400).send({ ok: false, error: "invalid tx hash" });
    }
    const row = db
      .prepare(
        "SELECT raw_tx_json, raw_receipt_json, block_number FROM transactions WHERE LOWER(hash) = LOWER(?) LIMIT 1"
      )
      .get(params.hash) as
      | { raw_tx_json: string; raw_receipt_json: string | null; block_number: string }
      | undefined;
    if (!row) {
      return reply.status(404).send({ ok: false, error: "tx not found" });
    }

    const block = db.prepare("SELECT raw_json FROM blocks WHERE number = ?").get(row.block_number) as
      | { raw_json: string }
      | undefined;
    const latest = db.prepare("SELECT latest_rpc_block FROM chain_meta WHERE id = 1").get() as
      | { latest_rpc_block: string }
      | undefined;

    let trace: unknown = null;
    // 优先 debug_traceTransaction，回退 trace_transaction。
    if (query.includeTrace === "1") {
      try {
        trace = await client.request({
          method: "debug_traceTransaction" as never,
          params: [params.hash as Hex, { tracer: "callTracer" }],
        } as never);
      } catch {
        try {
          trace = await client.request({
            method: "trace_transaction" as never,
            params: [params.hash as Hex],
          } as never);
        } catch {
          trace = null;
        }
      }
    }

    return {
      ok: true,
      rawTxJson: row.raw_tx_json,
      rawReceiptJson: row.raw_receipt_json,
      rawBlockJson: block?.raw_json ?? null,
      latestBlockNumber: latest?.latest_rpc_block ?? null,
      trace,
    };
  });

  /**
   * 地址摘要：余额、nonce、是否合约、代码大小。
   */
  app.get("/v1/addresses/:address/summary", async (request, reply) => {
    const params = request.params as { address: string };
    if (!isAddress(params.address)) {
      return reply.status(400).send({ ok: false, error: "invalid address" });
    }
    const address = params.address;
    const [balance, nonce, bytecode] = await Promise.all([
      client.getBalance({ address }),
      client.getTransactionCount({ address }),
      client.getBytecode({ address }),
    ]);
    const isContract = Boolean(bytecode && bytecode !== "0x");
    const codeSize = bytecode && bytecode !== "0x" ? (bytecode.length - 2) / 2 : 0;
    return {
      ok: true,
      address,
      balance: balance.toString(),
      nonce,
      bytecode: bytecode ?? "0x",
      isContract,
      codeSize,
    };
  });

  /**
   * 地址日志分页查询（倒序）。
   * 支持 topic0、fromBlock/toBlock 过滤与 cursor 续读。
   */
  app.get("/v1/addresses/:address/logs", async (request, reply) => {
    const params = request.params as { address: string };
    if (!isAddress(params.address)) {
      return reply.status(400).send({ ok: false, error: "invalid address" });
    }
    const query = request.query as Record<string, string | undefined>;
    const limit = toInt(query.limit, 20, 1, 100);
    const cursor = parseLogCursor(query.cursor);
    // `fromBlock/toBlock` 为可选区间过滤参数。
    const fromBlock = query.fromBlock ? BigInt(query.fromBlock) : null;
    const toBlock = query.toBlock ? BigInt(query.toBlock) : null;
    // `topic0` 用于快速按事件签名过滤。
    const topic0 = query.topic0?.trim().toLowerCase() || null;

    const conditions = ["LOWER(address) = LOWER(?)"];
    const sqlParams: Array<string | number> = [params.address];
    if (topic0) {
      conditions.push("LOWER(COALESCE(topic0,'')) = ?");
      sqlParams.push(topic0);
    }
    if (fromBlock !== null) {
      conditions.push("CAST(block_number AS INTEGER) >= CAST(? AS INTEGER)");
      sqlParams.push(fromBlock.toString());
    }
    if (toBlock !== null) {
      conditions.push("CAST(block_number AS INTEGER) <= CAST(? AS INTEGER)");
      sqlParams.push(toBlock.toString());
    }
    if (cursor) {
      conditions.push(
        "(CAST(block_number AS INTEGER) < CAST(? AS INTEGER) OR (CAST(block_number AS INTEGER) = CAST(? AS INTEGER) AND log_index < ?))"
      );
      sqlParams.push(cursor.blockNumber.toString(), cursor.blockNumber.toString(), cursor.logIndex);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;
    const rows = db
      .prepare(
        `SELECT tx_hash, block_number, log_index, topic0, topic1, topic2, topic3, data, removed
         FROM logs ${where}
         ORDER BY CAST(block_number AS INTEGER) DESC, log_index DESC
         LIMIT ?`
      )
      .all(...sqlParams, limit + 1) as Array<{
      tx_hash: string;
      block_number: string;
      log_index: number;
      topic0: string | null;
      topic1: string | null;
      topic2: string | null;
      topic3: string | null;
      data: string;
      removed: number;
    }>;

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map((row) => ({
      transactionHash: row.tx_hash,
      blockNumber: row.block_number,
      logIndex: row.log_index,
      topics: [row.topic0, row.topic1, row.topic2, row.topic3].filter(Boolean),
      data: row.data,
      removed: row.removed === 1,
      address: params.address,
    }));
    const last = items.at(-1);
    return {
      ok: true,
      items,
      nextCursor:
        hasMore && last
          ? buildLogCursor(BigInt(last.blockNumber), last.logIndex)
          : null,
    };
  });

  /**
   * 合约创建者查询：直接读 contracts 表，不做在线深扫。
   */
  app.get("/v1/addresses/:address/creator", async (request, reply) => {
    const params = request.params as { address: string };
    if (!isAddress(params.address)) {
      return reply.status(400).send({ ok: false, error: "invalid address" });
    }
    const row = db
      .prepare(
        `SELECT creator_tx_hash, creator_address, created_block, bytecode_hash, code_size
         FROM contracts WHERE LOWER(address) = LOWER(?) LIMIT 1`
      )
      .get(params.address) as
      | {
          creator_tx_hash: string;
          creator_address: string;
          created_block: string;
          bytecode_hash: string | null;
          code_size: number | null;
        }
      | undefined;

    return {
      ok: true,
      creator: row
        ? {
            txHash: row.creator_tx_hash,
            address: row.creator_address,
            createdBlock: row.created_block,
            bytecodeHash: row.bytecode_hash,
            codeSize: row.code_size,
          }
        : null,
    };
  });

  /**
   * 搜索入口：按输入自动识别 block/tx/address。
   */
  app.get("/v1/search", async (request) => {
    const query = request.query as { q?: string };
    const q = (query.q ?? "").trim();
    if (!q) return { ok: true, items: [] };
    if (/^\d+$/.test(q)) {
      const row = db.prepare("SELECT 1 FROM blocks WHERE number = ?").get(q);
      if (row) return { ok: true, items: [{ type: "block", value: q }] };
    }
    if (isHash(q)) {
      const row = db
        .prepare("SELECT 1 FROM transactions WHERE LOWER(hash) = LOWER(?)")
        .get(q);
      if (row) return { ok: true, items: [{ type: "tx", value: q }] };
    }
    if (isAddress(q)) {
      return { ok: true, items: [{ type: "address", value: q }] };
    }
    return { ok: true, items: [] };
  });
};
