import "server-only";

import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { getCurrentUtcYmd } from "@/lib/domain/age-eligibility";
import type {
  IssuerCredentialSetSummary,
  IssuerPendingSetSummary,
  IssuerUploadInvalidRow,
  IssuerUploadRecord,
  LocalAgeCredential
} from "@/types/domain";
import type { Address } from "@/types/contract-config";

// 这份 SQLite 运行时层承接的是“项目在本地 Node 侧真正会持续变化的真值”：
// 年龄验证方 active/pending 集合、可领取凭证、challenge、订单快照和同步进度都在这里。
const SERVER_DATA_DIR = path.join(process.cwd(), "server-data");
const DB_FILE = path.join(SERVER_DATA_DIR, "runtime.sqlite");
const ISSUER_DATA_DIR = path.join(SERVER_DATA_DIR, "issuer");
const BOOTSTRAP_DIR = path.join(ISSUER_DATA_DIR, "bootstrap");
const ACTIVE_DIR = path.join(ISSUER_DATA_DIR, "active");
const PENDING_DIR = path.join(ISSUER_DATA_DIR, "pending");
const SAMPLE_CREDENTIAL_SET_FILE = path.join(process.cwd(), "public", "examples", "sample-credential-set.json");

type SqliteDatabase = InstanceType<typeof Database>;

type IssuerSetKind = "active" | "pending";

type PersistedIssuerSetRow = {
  kind: IssuerSetKind;
  set_id: `0x${string}`;
  source_title: string;
  version: number;
  base_version: number | null;
  reference_date: number;
  merkle_root: string;
  updated_at: number;
  invalid_rows_json: string | null;
  new_buyer_addresses_json: string | null;
};

type PersistedChallengeRow = {
  address: string;
  message: string;
  expires_at: number;
  nonce: string;
  consumed_at: number | null;
};

type BootstrapSetRecord = {
  setIdBytes32: `0x${string}`;
  sourceTitle: string;
  version: number;
  referenceDate: number;
  merkleRoot: string;
  buyerAddresses?: Address[];
};

let databaseInstance: SqliteDatabase | null = null;

function ensureServerDataDir() {
  fs.mkdirSync(SERVER_DATA_DIR, { recursive: true });
}

function readJsonFile<T>(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function fileExists(filePath: string) {
  return fs.existsSync(filePath);
}

function listJsonFiles(directory: string) {
  if (!fileExists(directory)) {
    return [];
  }

  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && path.extname(entry.name) === ".json")
    .map((entry) => path.join(directory, entry.name));
}

function normalizeAddress(address: Address | string) {
  return address.toLowerCase();
}

function parseJsonColumn<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function createDatabase() {
  ensureServerDataDir();
  const database = new Database(DB_FILE);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  return database;
}

function initializeSchema(database: SqliteDatabase) {
  // issuer_sets / issuer_members / issuer_credentials 共同描述年龄验证方身份集合；
  // credential_challenges 记录私有凭证领取的挑战值；
  // marketplace_orders + sync_state 则把订单历史读成可复用快照。
  database.exec(`
    CREATE TABLE IF NOT EXISTS issuer_sets (
      kind TEXT PRIMARY KEY CHECK(kind IN ('active', 'pending')),
      set_id TEXT NOT NULL,
      source_title TEXT NOT NULL,
      version INTEGER NOT NULL,
      base_version INTEGER,
      reference_date INTEGER NOT NULL,
      merkle_root TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      invalid_rows_json TEXT,
      new_buyer_addresses_json TEXT
    );

    CREATE TABLE IF NOT EXISTS issuer_members (
      kind TEXT NOT NULL CHECK(kind IN ('active', 'pending')),
      address TEXT NOT NULL,
      birth_date TEXT,
      eligible_from_ymd INTEGER NOT NULL,
      PRIMARY KEY (kind, address)
    );

    CREATE INDEX IF NOT EXISTS issuer_members_kind_idx ON issuer_members(kind);

    CREATE TABLE IF NOT EXISTS issuer_credentials (
      kind TEXT NOT NULL CHECK(kind IN ('active', 'pending')),
      address TEXT NOT NULL,
      credential_json TEXT NOT NULL,
      PRIMARY KEY (kind, address)
    );

    CREATE INDEX IF NOT EXISTS issuer_credentials_kind_idx ON issuer_credentials(kind);

    CREATE TABLE IF NOT EXISTS credential_challenges (
      address TEXT PRIMARY KEY,
      message TEXT NOT NULL,
      nonce TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      consumed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS marketplace_orders (
      order_id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      buyer TEXT NOT NULL,
      seller TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      total_price_wei TEXT NOT NULL,
      purchased_at INTEGER NOT NULL,
      tx_hash TEXT,
      block_number TEXT NOT NULL,
      block_hash TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS marketplace_orders_buyer_idx ON marketplace_orders(buyer, purchased_at DESC);
    CREATE INDEX IF NOT EXISTS marketplace_orders_seller_idx ON marketplace_orders(seller, purchased_at DESC);

    CREATE TABLE IF NOT EXISTS sync_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

function clearIssuerSet(database: SqliteDatabase, kind: IssuerSetKind) {
  database.prepare("DELETE FROM issuer_credentials WHERE kind = ?").run(kind);
  database.prepare("DELETE FROM issuer_members WHERE kind = ?").run(kind);
  database.prepare("DELETE FROM issuer_sets WHERE kind = ?").run(kind);
}

function buildIssuerSummaryFromDatabase(
  database: SqliteDatabase,
  row: PersistedIssuerSetRow
): IssuerCredentialSetSummary | IssuerPendingSetSummary {
  // adultCountNow / minorCountNow 是基于“当前 UTC 日期”动态算出来的读模型，
  // 它们不回写成员真值，只服务于年龄验证方页面和查询接口展示。
  const currentUtcYmd = getCurrentUtcYmd();
  const countRow = database
    .prepare(
      `
        SELECT
          COUNT(*) AS memberCount,
          SUM(CASE WHEN eligible_from_ymd <= ? THEN 1 ELSE 0 END) AS adultCountNow
        FROM issuer_members
        WHERE kind = ?
      `
    )
    .get(currentUtcYmd, row.kind) as { memberCount: number; adultCountNow: number | null };

  const buyerRows = database
    .prepare(
      `
        SELECT address
        FROM issuer_members
        WHERE kind = ?
        ORDER BY address ASC
      `
    )
    .all(row.kind) as Array<{ address: Address }>;

  const memberCount = Number(countRow.memberCount ?? 0);
  const adultCountNow = Number(countRow.adultCountNow ?? 0);
  const baseSummary: IssuerCredentialSetSummary = {
    setId: row.set_id,
    sourceTitle: row.source_title,
    version: Number(row.version),
    referenceDate: Number(row.reference_date),
    merkleRoot: row.merkle_root,
    memberCount,
    adultCountNow,
    minorCountNow: Math.max(memberCount - adultCountNow, 0),
    updatedAt: Number(row.updated_at),
    buyerAddresses: buyerRows.map((item) => item.address)
  };

  if (row.kind === "pending") {
    const invalidRows = parseJsonColumn<IssuerUploadInvalidRow[]>(row.invalid_rows_json, []);
    const newBuyerAddresses = parseJsonColumn<Address[]>(row.new_buyer_addresses_json, []);
    return {
      ...baseSummary,
      baseVersion: Number(row.base_version ?? 0),
      invalidRows,
      newBuyerCount: newBuyerAddresses.length,
      newBuyerAddresses
    };
  }

  return baseSummary;
}

function persistIssuerSet(
  database: SqliteDatabase,
  args: {
    kind: IssuerSetKind;
    setId: `0x${string}`;
    sourceTitle: string;
    version: number;
    baseVersion?: number | null;
    referenceDate: number;
    merkleRoot: string;
    updatedAt: number;
    records: Array<{ walletAddress: Address; birthDate?: string | null; eligibleFromYmd: number }>;
    credentials: LocalAgeCredential[];
    invalidRows?: IssuerUploadInvalidRow[];
    newBuyerAddresses?: Address[];
  }
): IssuerCredentialSetSummary | IssuerPendingSetSummary {
  // 同一种 kind 每次都整组覆盖，目的是让 active / pending 视图始终保持自洽，
  // 避免摘要、成员和凭证来自不同批次的数据。
  clearIssuerSet(database, args.kind);

  database
    .prepare(
      `
        INSERT INTO issuer_sets (
          kind,
          set_id,
          source_title,
          version,
          base_version,
          reference_date,
          merkle_root,
          updated_at,
          invalid_rows_json,
          new_buyer_addresses_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .run(
      args.kind,
      args.setId,
      args.sourceTitle,
      args.version,
      args.baseVersion ?? null,
      args.referenceDate,
      args.merkleRoot,
      args.updatedAt,
      args.kind === "pending" ? JSON.stringify(args.invalidRows ?? []) : null,
      args.kind === "pending" ? JSON.stringify(args.newBuyerAddresses ?? []) : null
    );

  const insertMember = database.prepare(
    `
      INSERT INTO issuer_members (kind, address, birth_date, eligible_from_ymd)
      VALUES (?, ?, ?, ?)
    `
  );
  for (const record of args.records) {
    insertMember.run(args.kind, normalizeAddress(record.walletAddress), record.birthDate ?? null, record.eligibleFromYmd);
  }

  const insertCredential = database.prepare(
    `
      INSERT INTO issuer_credentials (kind, address, credential_json)
      VALUES (?, ?, ?)
    `
  );
  for (const credential of args.credentials) {
    insertCredential.run(args.kind, normalizeAddress(credential.boundBuyerAddress), JSON.stringify(credential));
  }

  const row = database.prepare("SELECT * FROM issuer_sets WHERE kind = ?").get(args.kind) as PersistedIssuerSetRow;
  return buildIssuerSummaryFromDatabase(database, row);
}

function loadCredentialFiles(directory: string) {
  return listJsonFiles(directory).map((filePath) => readJsonFile<LocalAgeCredential>(filePath));
}

function loadIssuerRecordsFile(directory: string) {
  const recordsFile = path.join(directory, "records.json");
  if (!fileExists(recordsFile)) {
    return [] as IssuerUploadRecord[];
  }
  return readJsonFile<IssuerUploadRecord[]>(recordsFile);
}

function hydrateIssuerSetFromDirectory(
  database: SqliteDatabase,
  kind: IssuerSetKind,
  directory: string,
  summary: {
    setId: `0x${string}`;
    sourceTitle: string;
    version: number;
    referenceDate: number;
    merkleRoot: string;
    updatedAt: number;
    baseVersion?: number | null;
    invalidRows?: IssuerUploadInvalidRow[];
    newBuyerAddresses?: Address[];
  }
) {
  const credentials = loadCredentialFiles(path.join(directory, "credentials"));
  if (credentials.length === 0) {
    return;
  }

  const recordByAddress = new Map(
    loadIssuerRecordsFile(directory).map((record) => [normalizeAddress(record.walletAddress), record.birthDate])
  );

  persistIssuerSet(database, {
    kind,
    setId: summary.setId,
    sourceTitle: summary.sourceTitle,
    version: summary.version,
    baseVersion: summary.baseVersion ?? null,
    referenceDate: summary.referenceDate,
    merkleRoot: summary.merkleRoot,
    updatedAt: summary.updatedAt,
    records: credentials.map((credential) => ({
      walletAddress: credential.boundBuyerAddress,
      birthDate: recordByAddress.get(normalizeAddress(credential.boundBuyerAddress)) ?? null,
      eligibleFromYmd: credential.eligibleFromYmd
    })),
    credentials,
    invalidRows: summary.invalidRows,
    newBuyerAddresses: summary.newBuyerAddresses
  });
}

function seedIssuerTables(database: SqliteDatabase) {
  const hasActive = database.prepare("SELECT 1 FROM issuer_sets WHERE kind = 'active' LIMIT 1").get();
  const hasPending = database.prepare("SELECT 1 FROM issuer_sets WHERE kind = 'pending' LIMIT 1").get();

  if (!hasActive) {
    // 首次启动优先尝试恢复已有 active 目录，没有的话再回退到 bootstrap 样例集合。
    const activeSetFile = path.join(ACTIVE_DIR, "set.json");
    if (fileExists(activeSetFile)) {
      const activeSet = readJsonFile<IssuerCredentialSetSummary>(activeSetFile);
      hydrateIssuerSetFromDirectory(database, "active", ACTIVE_DIR, {
        setId: activeSet.setId,
        sourceTitle: activeSet.sourceTitle,
        version: activeSet.version,
        referenceDate: activeSet.referenceDate,
        merkleRoot: activeSet.merkleRoot,
        updatedAt: activeSet.updatedAt
      });
    } else if (fileExists(SAMPLE_CREDENTIAL_SET_FILE)) {
      const sampleSet = readJsonFile<BootstrapSetRecord>(SAMPLE_CREDENTIAL_SET_FILE);
      hydrateIssuerSetFromDirectory(database, "active", BOOTSTRAP_DIR, {
        setId: sampleSet.setIdBytes32,
        sourceTitle: sampleSet.sourceTitle,
        version: sampleSet.version,
        referenceDate: sampleSet.referenceDate,
        merkleRoot: sampleSet.merkleRoot,
        updatedAt: sampleSet.referenceDate
      });
    }
  }

  if (!hasPending) {
    const pendingSetFile = path.join(PENDING_DIR, "set.json");
    if (!fileExists(pendingSetFile)) {
      return;
    }

    const pendingSet = readJsonFile<IssuerPendingSetSummary>(pendingSetFile);
    hydrateIssuerSetFromDirectory(database, "pending", PENDING_DIR, {
      setId: pendingSet.setId,
      sourceTitle: pendingSet.sourceTitle,
      version: pendingSet.version,
      baseVersion: pendingSet.baseVersion,
      referenceDate: pendingSet.referenceDate,
      merkleRoot: pendingSet.merkleRoot,
      updatedAt: pendingSet.updatedAt,
      invalidRows: pendingSet.invalidRows,
      newBuyerAddresses: pendingSet.newBuyerAddresses
    });
  }
}

export function getRuntimeDatabase() {
  if (!databaseInstance) {
    // 数据库实例做成进程内单例，避免每次 API 进入都重复建库和重复 seed。
    databaseInstance = createDatabase();
    initializeSchema(databaseInstance);
    seedIssuerTables(databaseInstance);
  }

  return databaseInstance;
}

export function getIssuerSetRow(kind: IssuerSetKind) {
  const database = getRuntimeDatabase();
  const row = database.prepare("SELECT * FROM issuer_sets WHERE kind = ?").get(kind) as PersistedIssuerSetRow | undefined;
  return row ?? null;
}

export function loadIssuerSetSummary(kind: IssuerSetKind) {
  const database = getRuntimeDatabase();
  const row = getIssuerSetRow(kind);
  if (!row) {
    return null;
  }

  return buildIssuerSummaryFromDatabase(database, row);
}

export function loadCredentialByKindAndAddress(kind: IssuerSetKind, address: Address) {
  const database = getRuntimeDatabase();
  const row = database
    .prepare(
      `
        SELECT credential_json
        FROM issuer_credentials
        WHERE kind = ? AND address = ?
      `
    )
    .get(kind, normalizeAddress(address)) as { credential_json: string } | undefined;

  if (!row) {
    return null;
  }

  return JSON.parse(row.credential_json) as LocalAgeCredential;
}

export function isIssuerMember(kind: IssuerSetKind, address: Address) {
  const database = getRuntimeDatabase();
  const row = database
    .prepare(
      `
        SELECT 1
        FROM issuer_members
        WHERE kind = ? AND address = ?
        LIMIT 1
      `
    )
    .get(kind, normalizeAddress(address));

  return Boolean(row);
}

export function replacePendingIssuerSet(args: {
  summary: IssuerPendingSetSummary;
  records: IssuerUploadRecord[];
  credentials: LocalAgeCredential[];
}) {
  const database = getRuntimeDatabase();

  return persistIssuerSet(database, {
    kind: "pending",
    setId: args.summary.setId,
    sourceTitle: args.summary.sourceTitle,
    version: args.summary.version,
    baseVersion: args.summary.baseVersion,
    referenceDate: args.summary.referenceDate,
    merkleRoot: args.summary.merkleRoot,
    updatedAt: args.summary.updatedAt,
    records: args.records.map((record) => {
      const credential = args.credentials.find(
        (item) => normalizeAddress(item.boundBuyerAddress) === normalizeAddress(record.walletAddress)
      );

      if (!credential) {
        throw new Error(`未找到 ${record.walletAddress} 对应的待发布凭证。`);
      }

      return {
        walletAddress: record.walletAddress,
        birthDate: record.birthDate,
        eligibleFromYmd: credential.eligibleFromYmd
      };
    }),
    credentials: args.credentials,
    invalidRows: args.summary.invalidRows,
    newBuyerAddresses: args.summary.newBuyerAddresses
  }) as IssuerPendingSetSummary;
}

export function promotePendingIssuerSet(args: { updatedAt: number }) {
  const database = getRuntimeDatabase();
  const pendingRow = getIssuerSetRow("pending");
  if (!pendingRow) {
    throw new Error("当前没有待发布的资格集合。");
  }

  const pendingSummary = buildIssuerSummaryFromDatabase(database, pendingRow) as IssuerPendingSetSummary;
  const pendingRecords = database
    .prepare(
      `
        SELECT address, birth_date, eligible_from_ymd
        FROM issuer_members
        WHERE kind = 'pending'
        ORDER BY address ASC
      `
    )
    .all() as Array<{ address: Address; birth_date: string | null; eligible_from_ymd: number }>;
  const pendingCredentials = database
    .prepare(
      `
        SELECT credential_json
        FROM issuer_credentials
        WHERE kind = 'pending'
        ORDER BY address ASC
      `
    )
    .all() as Array<{ credential_json: string }>;
  const parsedPendingCredentials = pendingCredentials.map(
    (row): LocalAgeCredential => JSON.parse(row.credential_json) as LocalAgeCredential
  );

  // 激活 pending 的语义不是“复制一个摘要”，
  // 而是把待发布批次的成员和凭证整体提升为新的 active 真值，然后清空 pending。
  const result = persistIssuerSet(database, {
    kind: "active",
    setId: pendingSummary.setId,
    sourceTitle: pendingSummary.sourceTitle,
    version: pendingSummary.version,
    referenceDate: pendingSummary.referenceDate,
    merkleRoot: pendingSummary.merkleRoot,
    updatedAt: args.updatedAt,
    records: pendingRecords.map((record) => ({
      walletAddress: record.address,
      birthDate: record.birth_date,
      eligibleFromYmd: Number(record.eligible_from_ymd)
    })),
    credentials: parsedPendingCredentials
  }) as IssuerCredentialSetSummary;

  clearIssuerSet(database, "pending");
  return result;
}

export function loadIssuerRecords(kind: IssuerSetKind) {
  const database = getRuntimeDatabase();
  const rows = database
    .prepare(
      `
        SELECT address, birth_date
        FROM issuer_members
        WHERE kind = ?
        ORDER BY address ASC
      `
    )
    .all(kind) as Array<{ address: Address; birth_date: string | null }>;

  return rows.map((row) => ({
    walletAddress: row.address,
    birthDate: row.birth_date ?? ""
  }));
}

export function upsertCredentialChallenge(args: {
  address: Address;
  message: string;
  nonce: string;
  expiresAt: number;
}) {
  const database = getRuntimeDatabase();
  // 一个地址同一时刻只保留一条 challenge，新领取会覆盖旧 challenge 并重置 consumed 状态。
  database
    .prepare(
      `
        INSERT INTO credential_challenges (address, message, nonce, expires_at, consumed_at)
        VALUES (?, ?, ?, ?, NULL)
        ON CONFLICT(address) DO UPDATE SET
          message = excluded.message,
          nonce = excluded.nonce,
          expires_at = excluded.expires_at,
          consumed_at = NULL
      `
    )
    .run(normalizeAddress(args.address), args.message, args.nonce, args.expiresAt);
}

export function consumeCredentialChallenge(address: Address) {
  const database = getRuntimeDatabase();
  database
    .prepare(
      `
        UPDATE credential_challenges
        SET consumed_at = ?
        WHERE address = ? AND consumed_at IS NULL
      `
    )
    .run(Date.now(), normalizeAddress(address));
}

export function deleteExpiredCredentialChallenges() {
  const database = getRuntimeDatabase();
  database.prepare("DELETE FROM credential_challenges WHERE expires_at <= ? OR consumed_at IS NOT NULL").run(Date.now());
}

export function loadCredentialChallenge(address: Address) {
  // 读取前先做惰性清理，这样数据库里不会长期堆积已过期或已消费的 challenge。
  deleteExpiredCredentialChallenges();
  const database = getRuntimeDatabase();
  const row = database
    .prepare(
      `
        SELECT address, message, nonce, expires_at, consumed_at
        FROM credential_challenges
        WHERE address = ?
      `
    )
    .get(normalizeAddress(address)) as PersistedChallengeRow | undefined;

  return row ?? null;
}

export function readSyncState(key: string) {
  const database = getRuntimeDatabase();
  const row = database.prepare("SELECT value FROM sync_state WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function writeSyncState(key: string, value: string) {
  const database = getRuntimeDatabase();
  database
    .prepare(
      `
        INSERT INTO sync_state (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `
    )
    .run(key, value);
}

export function upsertMarketplaceOrders(
  orders: Array<{
    orderId: `0x${string}`;
    productId: `0x${string}`;
    buyer: Address;
    seller: Address;
    quantity: number;
    totalPriceWei: bigint;
    purchasedAt: number;
    txHash?: `0x${string}`;
    blockNumber: bigint;
    blockHash: `0x${string}`;
  }>
) {
  if (orders.length === 0) {
    return;
  }

  const database = getRuntimeDatabase();
  const statement = database.prepare(
    `
      INSERT INTO marketplace_orders (
        order_id,
        product_id,
        buyer,
        seller,
        quantity,
        total_price_wei,
        purchased_at,
        tx_hash,
        block_number,
        block_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(order_id) DO UPDATE SET
        product_id = excluded.product_id,
        buyer = excluded.buyer,
        seller = excluded.seller,
        quantity = excluded.quantity,
        total_price_wei = excluded.total_price_wei,
        purchased_at = excluded.purchased_at,
        tx_hash = excluded.tx_hash,
        block_number = excluded.block_number,
        block_hash = excluded.block_hash
    `
  );

  const transaction = database.transaction((rows: typeof orders) => {
    // 订单按 orderId 做 upsert，这样后续重复同步同一批事件也不会插出重复记录。
    for (const order of rows) {
      statement.run(
        order.orderId,
        order.productId,
        normalizeAddress(order.buyer),
        normalizeAddress(order.seller),
        order.quantity,
        order.totalPriceWei.toString(),
        order.purchasedAt,
        order.txHash ?? null,
        order.blockNumber.toString(),
        order.blockHash
      );
    }
  });

  transaction(orders);
}

export function loadMarketplaceOrdersByParty(args: { role: "buyer" | "seller"; address: Address }) {
  const database = getRuntimeDatabase();
  // 这里返回的是服务端已经整理好的订单快照，
  // 前端不再需要每次自己从 earliest 开始扫 ProductPurchased 事件。
  const rows = database
    .prepare(
      `
        SELECT order_id, product_id, buyer, seller, quantity, total_price_wei, purchased_at, tx_hash
        FROM marketplace_orders
        WHERE ${args.role} = ?
        ORDER BY purchased_at DESC, rowid DESC
      `
    )
    .all(normalizeAddress(args.address)) as Array<{
      order_id: `0x${string}`;
      product_id: `0x${string}`;
      buyer: Address;
      seller: Address;
      quantity: number;
      total_price_wei: string;
      purchased_at: number;
      tx_hash?: `0x${string}` | null;
    }>;

  return rows.map((row) => ({
    orderId: row.order_id,
    productId: row.product_id,
    buyer: row.buyer,
    seller: row.seller,
    quantity: Number(row.quantity),
    totalPriceWei: BigInt(row.total_price_wei),
    purchasedAt: Number(row.purchased_at),
    txHash: row.tx_hash ?? undefined
  }));
}
