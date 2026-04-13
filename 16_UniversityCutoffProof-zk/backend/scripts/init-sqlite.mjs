import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function resolveSqlitePath(databaseUrl) {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error(`Only SQLite file URLs are supported, received: ${databaseUrl}`);
  }

  const rawPath = databaseUrl.slice("file:".length);
  if (!rawPath) {
    throw new Error("BACKEND_DATABASE_URL must include a SQLite file path.");
  }

  return path.isAbsolute(rawPath) ? rawPath : path.resolve(BACKEND_ROOT, rawPath);
}

function readSchemaDiff({ databaseUrl, schemaPath, hasExistingDatabase }) {
  const args = hasExistingDatabase
    ? [
        "prisma",
        "migrate",
        "diff",
        "--from-url",
        databaseUrl,
        "--to-schema-datamodel",
        schemaPath,
        "--script"
      ]
    : [
        "prisma",
        "migrate",
        "diff",
        "--from-empty",
        "--to-schema-datamodel",
        schemaPath,
        "--script"
      ];

  return execFileSync("npx", args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      BACKEND_DATABASE_URL: databaseUrl
    },
    encoding: "utf8"
  });
}

function hasExecutableSql(sql) {
  return /\b(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE)\b/i.test(sql);
}

const requestedDatabaseUrl = process.env.BACKEND_DATABASE_URL?.trim() || "file:./dev.db";
const schemaPath = "prisma/schema.prisma";
const absoluteDatabasePath = resolveSqlitePath(requestedDatabaseUrl);
const databaseUrl = `file:${absoluteDatabasePath}`;

mkdirSync(path.dirname(absoluteDatabasePath), { recursive: true });

const existingDatabase = existsSync(absoluteDatabasePath);
const sql = readSchemaDiff({
  databaseUrl,
  schemaPath,
  hasExistingDatabase: existingDatabase
});

if (!hasExecutableSql(sql)) {
  console.log(`SQLite schema is already up to date: ${absoluteDatabasePath}`);
  process.exit(0);
}

const database = new DatabaseSync(absoluteDatabasePath);
database.exec("PRAGMA foreign_keys = ON;");
database.exec(sql);
database.close();

console.log(`SQLite schema initialized at ${absoluteDatabasePath}`);
