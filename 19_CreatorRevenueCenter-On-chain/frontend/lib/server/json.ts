import fs from "node:fs";

type JsonCacheEntry = {
  mtimeMs: number;
  value: unknown;
};

const jsonCache = new Map<string, JsonCacheEntry>();

export function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) return fallback;

  const stats = fs.statSync(filePath);
  const cached = jsonCache.get(filePath);
  if (cached && cached.mtimeMs === stats.mtimeMs) {
    return cached.value as T;
  }

  const value = JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  jsonCache.set(filePath, {
    mtimeMs: stats.mtimeMs,
    value
  });
  return value;
}
