import { NextResponse } from "next/server";
import type { CredentialSetDraftInput } from "@/types/domain";
import { parseBearerToken, requireGovernmentSession } from "@/lib/server/government-sessions";
import { prepareCredentialSetDraft } from "@/lib/server/credential-set-store";

export const runtime = "nodejs";

/** 生成待发布资格名单草稿。 */
export async function POST(request: Request) {
  try {
    // 草稿生成属于政府管理动作，服务端必须先验 session。
    await requireGovernmentSession(parseBearerToken(request));
    const body = (await request.json().catch(() => null)) as CredentialSetDraftInput | null;
    if (!body) {
      return NextResponse.json({ error: "当前请求缺少资格名单草稿内容。" }, { status: 400 });
    }

    const result = await prepareCredentialSetDraft(body);
    return NextResponse.json(result);
  } catch (error) {
    // 会话/权限问题返回 401，其余输入或业务校验问题返回 400，方便前端区分重签名和改数据。
    const message = error instanceof Error ? error.message : "当前未能生成资格名单草稿，请稍后重试。";
    const status = /会话|权限/.test(message) ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
