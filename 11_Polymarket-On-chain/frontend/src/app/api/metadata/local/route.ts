import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { normalizeEventTag, type TeachingEventMetadata } from "@/lib/event-metadata";

export const runtime = "nodejs";

/** 封面图最大体积限制（5MB）。 */
const MAX_COVER_IMAGE_BYTES = 5 * 1024 * 1024;
/** 允许上传的图片 MIME 与输出扩展名映射。 */
const MIME_TO_EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp"
};

/** 读取表单字段并归一化为空字符串安全值。 */
function toStringField(input: FormDataEntryValue | null) {
  return typeof input === "string" ? input.trim() : "";
}

/** 解析逗号分隔标签文本并去除空项。 */
function parseTags(input: string) {
  return input
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/** 解析附加字段 JSON，要求必须是 string->string 对象。 */
function parseExtraFields(input: string): Record<string, string> | null {
  if (!input.trim()) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const normalized: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(parsed)) {
    const key = rawKey.trim();
    if (!key) {
      continue;
    }

    if (typeof rawValue !== "string") {
      return null;
    }

    normalized[key] = rawValue;
  }

  return normalized;
}

/** 本地 metadata 生成入口：校验表单、保存封面并写入 metadata JSON。 */
export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "INVALID_FORM_DATA" }, { status: 400 });
  }

  const title = toStringField(formData.get("title"));
  const description = toStringField(formData.get("description"));
  const categoryInput = toStringField(formData.get("category"));
  const tagsRaw = toStringField(formData.get("tags"));
  const extraFieldsRaw = toStringField(formData.get("extraFields"));

  const category = normalizeEventTag(categoryInput);

  // 基础必填项严格前置校验，尽量在链上创建前暴露可修复问题。
  if (!title) {
    return NextResponse.json({ error: "TITLE_REQUIRED" }, { status: 400 });
  }

  if (!description) {
    return NextResponse.json({ error: "DESCRIPTION_REQUIRED" }, { status: 400 });
  }

  if (!category) {
    return NextResponse.json({ error: "INVALID_CATEGORY" }, { status: 400 });
  }

  const extraFields = parseExtraFields(extraFieldsRaw);
  if (extraFields === null) {
    return NextResponse.json({ error: "INVALID_EXTRA_FIELDS" }, { status: 400 });
  }

  const coverImage = formData.get("coverImage");
  if (!(coverImage instanceof File)) {
    return NextResponse.json({ error: "COVER_IMAGE_REQUIRED" }, { status: 400 });
  }

  if (coverImage.size === 0) {
    return NextResponse.json({ error: "COVER_IMAGE_EMPTY" }, { status: 400 });
  }

  if (coverImage.size > MAX_COVER_IMAGE_BYTES) {
    return NextResponse.json({ error: "COVER_IMAGE_TOO_LARGE" }, { status: 400 });
  }

  const extension = MIME_TO_EXTENSION[coverImage.type];
  if (!extension) {
    return NextResponse.json({ error: "COVER_IMAGE_TYPE_NOT_ALLOWED" }, { status: 400 });
  }

  // 使用 uuid 命名元数据与图片文件，避免本地开发环境文件名冲突。
  const metadataId = randomUUID();
  const rootDir = path.join(process.cwd(), "public", "event-metadata");
  const assetsDir = path.join(rootDir, "assets");

  await mkdir(assetsDir, { recursive: true });

  const coverFilename = `${metadataId}.${extension}`;
  const coverOutputPath = path.join(assetsDir, coverFilename);
  const coverBuffer = Buffer.from(await coverImage.arrayBuffer());
  await writeFile(coverOutputPath, coverBuffer);

  const metadataFilename = `${metadataId}.json`;
  const metadataURI = `/event-metadata/${metadataFilename}`;
  const metadataFilePath = path.join(rootDir, metadataFilename);

  const metadata: TeachingEventMetadata = {
    title,
    description,
    category,
    tags: (() => {
      // 标签必须收敛到白名单；若未提供有效 tags，至少保留主分类，确保首页筛选一致。
      const parsedTags = parseTags(tagsRaw)
        .map((item) => normalizeEventTag(item))
        .filter((item): item is NonNullable<typeof item> => item !== null);
      if (parsedTags.length === 0) {
        return [category];
      }
      if (!parsedTags.includes(category)) {
        parsedTags.unshift(category);
      }
      return Array.from(new Set(parsedTags));
    })(),
    coverImage: `/event-metadata/assets/${coverFilename}`,
    extraFields,
    createdAt: new Date().toISOString(),
    version: "lulu-v1"
  };

  await writeFile(metadataFilePath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

  return NextResponse.json({ metadataURI });
}
