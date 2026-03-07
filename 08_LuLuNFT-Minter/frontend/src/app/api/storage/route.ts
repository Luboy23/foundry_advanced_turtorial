import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const STORAGE_PUBLIC_DIR = process.env.STORAGE_PUBLIC_DIR ?? "uploads";
const ASSET_BASE_URL = process.env.NEXT_PUBLIC_ASSET_BASE_URL ?? "";

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });

const sanitize = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, "_");

const trimSlash = (value: string) => value.replace(/\/+$/, "");

// 简单探活：用于前端检查本地静态资源写入服务是否可用
export async function GET() {
  return jsonResponse({ online: true, dir: STORAGE_PUBLIC_DIR }, 200);
}

// 上传文件到 public 目录，并返回可直接写入 tokenURI 的 HTTP 地址
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const runId = formData.get("runId");
    const index = formData.get("index");
    const kind = formData.get("kind");

    if (!(file instanceof File)) {
      return jsonResponse({ error: "缺少文件" }, 400);
    }

    const safeRunId = sanitize(
      typeof runId === "string" && runId.trim()
        ? runId.trim()
        : `run-${Date.now()}`
    );
    const safeKind =
      typeof kind === "string" && kind.trim() ? `${sanitize(kind.trim())}-` : "";
    const safeIndex =
      typeof index === "string" && index.trim() ? `${sanitize(index.trim())}-` : "";
    const safeName = sanitize(file.name || "file");
    const finalName = `${safeKind}${safeIndex}${safeName}`;

    const targetDir = path.join(process.cwd(), "public", STORAGE_PUBLIC_DIR, safeRunId);
    await mkdir(targetDir, { recursive: true });

    const targetPath = path.join(targetDir, finalName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(targetPath, buffer);

    const publicPath = `/${STORAGE_PUBLIC_DIR}/${safeRunId}/${finalName}`;
    const origin = new URL(request.url).origin;
    const base = ASSET_BASE_URL ? trimSlash(ASSET_BASE_URL) : trimSlash(origin);
    const url = `${base}${publicPath}`;

    return jsonResponse({ url, path: publicPath });
  } catch (error) {
    return jsonResponse(
      {
        error: "上传失败",
        detail: error instanceof Error ? error.message : "未知错误"
      },
      500
    );
  }
}
