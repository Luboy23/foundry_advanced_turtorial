import { NextResponse } from "next/server";

import { extractEventTagFromUnknown, resolveMetadataUri } from "@/lib/event-metadata";

/** URI metadata 校验入口：校验可访问性并提取合法标签。 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const uri = (url.searchParams.get("uri") ?? "").trim();
  if (!uri) {
    return NextResponse.json({ error: "URI_REQUIRED" }, { status: 400 });
  }

  const resolvedUrl = resolveMetadataUri(uri);
  if (!resolvedUrl) {
    return NextResponse.json({ error: "INVALID_URI" }, { status: 400 });
  }
  // 站内相对路径补齐 origin，保证本地模式和外部 URI 共用同一 fetch 流程。
  const fetchUrl = resolvedUrl.startsWith("/") ? `${url.origin}${resolvedUrl}` : resolvedUrl;

  let response: Response;
  try {
    response = await fetch(fetchUrl, { method: "GET", cache: "no-store" });
  } catch {
    return NextResponse.json({ error: "METADATA_FETCH_FAILED" }, { status: 400 });
  }

  if (!response.ok) {
    return NextResponse.json({ error: "METADATA_FETCH_FAILED" }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = (await response.json()) as unknown;
  } catch {
    return NextResponse.json({ error: "INVALID_METADATA_JSON" }, { status: 400 });
  }

  const tag = extractEventTagFromUnknown(raw);
  if (!tag) {
    return NextResponse.json({ error: "INVALID_CATEGORY" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, tag });
}
