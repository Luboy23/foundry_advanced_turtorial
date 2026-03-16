// 读者端展示的元数据（链下映射）
export type BookMetadata = {
  title: string;
  author: string;
};

export const BOOK_META_STORAGE_KEY = "bookMetaMap";
type BookMetadataMap = Record<string, BookMetadata>;

// 教学用的“哈希 -> 书名/作者”映射（链下）
// 实际项目中应由后台/数据库提供，不应写死在前端。
const bookMetadataByHash: Record<string, BookMetadata> = {
  "0x1111111111111111111111111111111111111111111111111111111111111111": {
    title: "Introduction to Zero-Knowledge",
    author: "A. Scholar",
  },
  "0x2222222222222222222222222222222222222222222222222222222222222222": {
    title: "Private Library Systems",
    author: "B. Researcher",
  },
};

let cachedLocalMetadataMap: BookMetadataMap | null = null;
let hasBoundStorageListener = false;

const normalizeMetadataMap = (map: Record<string, BookMetadata>) =>
  Object.fromEntries(
    Object.entries(map).map(([key, value]) => [key.toLowerCase(), value])
  ) as BookMetadataMap;

const parseLocalMetadataMap = (raw: string | null): BookMetadataMap => {
  if (!raw) return {};
  try {
    const map = JSON.parse(raw) as Record<string, BookMetadata>;
    if (!map || typeof map !== "object") return {};
    return normalizeMetadataMap(map);
  } catch {
    return {};
  }
};

const bindStorageSync = () => {
  if (typeof window === "undefined" || hasBoundStorageListener) return;
  window.addEventListener("storage", (event) => {
    if (event.key !== BOOK_META_STORAGE_KEY) return;
    cachedLocalMetadataMap = parseLocalMetadataMap(event.newValue);
  });
  hasBoundStorageListener = true;
};

// 从本地存储读取管理员录入的映射（链下）
const safeReadLocalMetadataMap = () => {
  if (typeof window === "undefined") return null;
  bindStorageSync();
  if (cachedLocalMetadataMap !== null) return cachedLocalMetadataMap;
  cachedLocalMetadataMap = parseLocalMetadataMap(window.localStorage.getItem(BOOK_META_STORAGE_KEY));
  return cachedLocalMetadataMap;
};

const getLocalMetadata = (metaHash: string) => {
  const map = safeReadLocalMetadataMap();
  if (!map) return null;
  return map[metaHash.toLowerCase()] ?? null;
};

// 读者端统一读取元数据：优先本地映射，其次内置示例
export const getBookMetadata = (metaHash: string) => {
  const key = metaHash.toLowerCase();
  return getLocalMetadata(key) ?? bookMetadataByHash[key] ?? null;
};

// 读取本地“哈希 -> 元数据”映射（用于导出）
export const getLocalMetadataMap = (): Record<string, BookMetadata> => {
  const map = safeReadLocalMetadataMap();
  return map ? { ...map } : {};
};

// 覆盖本地映射（用于导入）
export const replaceLocalMetadataMap = (map: Record<string, BookMetadata>) => {
  if (typeof window === "undefined") return;
  const normalized = normalizeMetadataMap(map);
  cachedLocalMetadataMap = normalized;
  window.localStorage.setItem(BOOK_META_STORAGE_KEY, JSON.stringify(normalized));
};

// 新增或更新本地映射（避免页面直接裸 JSON.parse）
export const upsertLocalMetadata = (metaHash: string, metadata: BookMetadata) => {
  if (typeof window === "undefined") return;
  const map = safeReadLocalMetadataMap() ?? {};
  map[metaHash.toLowerCase()] = metadata;
  cachedLocalMetadataMap = map;
  window.localStorage.setItem(BOOK_META_STORAGE_KEY, JSON.stringify(map));
};
