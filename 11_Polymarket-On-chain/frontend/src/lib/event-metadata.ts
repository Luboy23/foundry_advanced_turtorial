import { IPFS_GATEWAY_BASE } from "@/lib/config";

/** 当前前端允许展示/筛选的事件标签白名单。 */
export const EVENT_TAGS = ["金融", "体育"] as const;
/** 单个合法事件标签类型。 */
export type EventTag = (typeof EVENT_TAGS)[number];

/** 事件资料（metadata）在前端使用的规范结构。 */
export type TeachingEventMetadata = {
  title: string;
  description: string;
  category: EventTag;
  tags: EventTag[];
  coverImage: string;
  extraFields: Record<string, string>;
  createdAt: string;
  version: "lulu-v1";
};

const EVENT_TAG_ALIASES: Record<string, EventTag> = {
  金融: "金融",
  finance: "金融",
  财经: "金融",
  体育: "体育",
  sports: "体育"
};

/** 提取 `ipfs://` URI 的路径部分，用于拼接网关地址。 */
function normalizeIpfsPath(uri: string) {
  const rawPath = uri.slice("ipfs://".length).replace(/^ipfs\//, "");
  return rawPath;
}

/**
 * 将 metadata URI 解析为可访问 URL。
 * 支持 `ipfs://`、`http(s)://` 与站内相对路径。
 */
export function resolveMetadataUri(uri: string | null | undefined): string | null {
  const normalized = (uri ?? "").trim();
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("ipfs://")) {
    return `${IPFS_GATEWAY_BASE}${normalizeIpfsPath(normalized)}`;
  }

  if (normalized.startsWith("http://") || normalized.startsWith("https://") || normalized.startsWith("/")) {
    return normalized;
  }

  return null;
}

/** 判断未知值是否为可索引对象。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** 归一化标签输入并映射到白名单标签。 */
export function normalizeEventTag(value: string | null | undefined): EventTag | null {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  return EVENT_TAG_ALIASES[normalized] ?? null;
}

/** 对 metadata `tags` 数组做归一化、过滤与去重。 */
function normalizeEventTags(values: unknown): EventTag[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const dedup = new Set<EventTag>();
  for (const item of values) {
    if (typeof item !== "string") {
      continue;
    }
    const tag = normalizeEventTag(item);
    if (tag) {
      dedup.add(tag);
    }
  }

  return Array.from(dedup);
}

/**
 * 从任意 metadata 对象中提取有效标签。
 * 优先读取 `category`，其次回退到 `tags` 首项。
 */
export function extractEventTagFromUnknown(value: unknown): EventTag | null {
  if (!isRecord(value)) {
    return null;
  }

  if (typeof value.category === "string") {
    const categoryTag = normalizeEventTag(value.category);
    if (categoryTag) {
      return categoryTag;
    }
  }

  const normalizedTags = normalizeEventTags(value.tags);
  return normalizedTags[0] ?? null;
}

/**
 * 解析并校验项目 metadata 结构。
 * 校验失败返回 `null`，由上层决定降级展示策略。
 */
export function parseEventMetadata(value: unknown): TeachingEventMetadata | null {
  if (!isRecord(value)) {
    return null;
  }

  if (value.version !== "lulu-v1" && value.version !== "teaching-v1") {
    return null;
  }

  const title = typeof value.title === "string" ? value.title.trim() : "";
  const description = typeof value.description === "string" ? value.description.trim() : "";
  const categoryRaw = typeof value.category === "string" ? value.category : "";
  const category = normalizeEventTag(categoryRaw);
  const coverImage = typeof value.coverImage === "string" ? value.coverImage.trim() : "";
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : "";
  const normalizedTags = normalizeEventTags(value.tags);
  const tags = normalizedTags.length > 0 ? normalizedTags : category ? [category] : [];

  const extraFields: Record<string, string> = {};
  if (isRecord(value.extraFields)) {
    for (const [key, fieldValue] of Object.entries(value.extraFields)) {
      if (typeof fieldValue === "string") {
        const normalizedKey = key.trim();
        if (normalizedKey) {
          extraFields[normalizedKey] = fieldValue;
        }
      }
    }
  }

  if (!title || !description || !coverImage || !category) {
    return null;
  }

  return {
    title,
    description,
    category,
    tags,
    coverImage,
    extraFields,
    createdAt,
    version: "lulu-v1"
  };
}
