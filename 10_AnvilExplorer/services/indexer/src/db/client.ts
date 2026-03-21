import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { indexerConfig } from "../config.js";

export type DbClient = Database.Database;

/**
 * 返回毫秒级时间戳，统一用于写入 `updated_at` 字段。
 */
export const nowTs = () => Date.now();

/**
 * 读取建表 SQL：
 * - 优先读取打包后的同目录 schema；
 * - 回退到源码路径，兼容本地开发运行目录差异。
 */
const readSchemaSql = () => {
  const local = fileURLToPath(new URL("./schema.sql", import.meta.url));
  const fallback = path.resolve(process.cwd(), "src/db/schema.sql");
  const filePath = fs.existsSync(local) ? local : fallback;
  return fs.readFileSync(filePath, "utf8");
};

/**
 * 打开 SQLite 并初始化运行参数与 schema。
 * 关键参数说明：
 * - WAL: 提升读写并发；
 * - NORMAL: 在性能与安全之间取折中；
 * - busy_timeout: 降低瞬时锁冲突失败概率。
 */
export const openDatabase = () => {
  // 确保数据库目录存在，避免首次启动失败。
  const dbDir = path.dirname(indexerConfig.dbPath);
  fs.mkdirSync(dbDir, { recursive: true });

  const db = new Database(indexerConfig.dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = OFF");
  db.pragma("temp_store = MEMORY");
  db.pragma("busy_timeout = 5000");
  db.exec(readSchemaSql());
  return db;
};

/**
 * 在事务内执行函数，确保一批写入要么全成功要么全回滚。
 */
export const withTx = <T>(db: DbClient, fn: () => T) => {
  const tx = db.transaction(fn);
  return tx();
};
