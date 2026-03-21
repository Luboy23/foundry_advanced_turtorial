-- 链级元信息：当前链 ID、RPC、最新块与已索引块。
CREATE TABLE IF NOT EXISTS chain_meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  chain_id INTEGER NOT NULL,
  rpc_url TEXT NOT NULL,
  genesis_hash TEXT,
  latest_rpc_block TEXT NOT NULL,
  indexed_block TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 预留检查点表：用于记录额外同步游标（当前版本保留扩展位）。
CREATE TABLE IF NOT EXISTS sync_checkpoint (
  name TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 区块主表：存放扁平字段 + 原始区块 JSON。
CREATE TABLE IF NOT EXISTS blocks (
  number TEXT PRIMARY KEY,
  hash TEXT UNIQUE NOT NULL,
  parent_hash TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  gas_limit TEXT,
  gas_used TEXT,
  base_fee_per_gas TEXT,
  miner TEXT,
  tx_count INTEGER NOT NULL,
  raw_json TEXT NOT NULL
);

-- 按时间倒序索引，支撑首页“最近区块”查询。
CREATE INDEX IF NOT EXISTS idx_blocks_timestamp
ON blocks(timestamp DESC);

-- 交易主表：每笔交易一行，附带回执关键字段与原始 JSON。
CREATE TABLE IF NOT EXISTS transactions (
  hash TEXT PRIMARY KEY,
  block_number TEXT NOT NULL,
  tx_index INTEGER NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT,
  nonce INTEGER,
  value TEXT,
  gas_limit TEXT,
  gas_price TEXT,
  max_fee_per_gas TEXT,
  max_priority_fee_per_gas TEXT,
  input TEXT,
  type INTEGER,
  status INTEGER,
  contract_address TEXT,
  gas_used TEXT,
  effective_gas_price TEXT,
  raw_tx_json TEXT NOT NULL,
  raw_receipt_json TEXT
);

-- 区块内交易唯一顺序约束（block_number + tx_index）。
CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_block_tx_index
ON transactions(block_number, tx_index);

-- 交易列表主索引（按块号+索引倒序分页）。
CREATE INDEX IF NOT EXISTS idx_tx_block
ON transactions(block_number DESC, tx_index DESC);

-- 地址维度查询索引（from）。
CREATE INDEX IF NOT EXISTS idx_tx_from
ON transactions(from_address);

-- 地址维度查询索引（to）。
CREATE INDEX IF NOT EXISTS idx_tx_to
ON transactions(to_address);

-- 日志主表：topic0~topic3 扁平字段便于按事件签名筛选。
CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tx_hash TEXT NOT NULL,
  block_number TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  address TEXT NOT NULL,
  topic0 TEXT,
  topic1 TEXT,
  topic2 TEXT,
  topic3 TEXT,
  data TEXT NOT NULL,
  removed INTEGER NOT NULL DEFAULT 0
);

-- 同一交易内 log_index 唯一。
CREATE UNIQUE INDEX IF NOT EXISTS idx_logs_tx_hash_log_index
ON logs(tx_hash, log_index);

-- 地址 + 区块倒序索引，支撑地址日志页。
CREATE INDEX IF NOT EXISTS idx_logs_address_block
ON logs(address, block_number DESC);

-- topic0 索引，支撑事件类型过滤。
CREATE INDEX IF NOT EXISTS idx_logs_topic0
ON logs(topic0);

-- 标准化 token transfer 表（ERC20/721/1155）。
CREATE TABLE IF NOT EXISTS token_transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  block_number TEXT NOT NULL,
  token_address TEXT NOT NULL,
  standard TEXT NOT NULL,
  from_address TEXT,
  to_address TEXT,
  token_id TEXT,
  value TEXT
);

-- token 维度查询索引。
CREATE INDEX IF NOT EXISTS idx_transfer_token
ON token_transfers(token_address, block_number DESC);

-- from 维度查询索引。
CREATE INDEX IF NOT EXISTS idx_transfer_from
ON token_transfers(from_address, block_number DESC);

-- to 维度查询索引。
CREATE INDEX IF NOT EXISTS idx_transfer_to
ON token_transfers(to_address, block_number DESC);

-- 合约创建记录表：用于 O(1) 查询部署者。
CREATE TABLE IF NOT EXISTS contracts (
  address TEXT PRIMARY KEY,
  creator_tx_hash TEXT NOT NULL,
  creator_address TEXT NOT NULL,
  created_block TEXT NOT NULL,
  bytecode_hash TEXT,
  code_size INTEGER,
  updated_at INTEGER NOT NULL
);

-- 创建者地址索引，支持反查该地址部署过的合约。
CREATE INDEX IF NOT EXISTS idx_contract_creator
ON contracts(creator_address);
