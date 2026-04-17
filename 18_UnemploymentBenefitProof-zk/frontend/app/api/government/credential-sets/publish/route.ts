import { NextResponse } from "next/server";
import { isHash } from "viem";
import { parseBearerToken, requireGovernmentSession } from "@/lib/server/government-sessions";
import { markCredentialSetPublished } from "@/lib/server/credential-set-store";

export const runtime = "nodejs";

/** 把链上发布结果回写到本地快照。 */
export async function POST(request: Request) {
  try {
    await requireGovernmentSession(parseBearerToken(request));
    const body = (await request.json().catch(() => null)) as {
      version?: number;
      publishedTxHash?: string;
      roleSyncTxHash?: string;
    } | null;

    if (!body?.version || !body.publishedTxHash || !isHash(body.publishedTxHash)) {
      return NextResponse.json({ error: "当前请求缺少有效的发布结果信息。" }, { status: 400 });
    }

    if (body.roleSyncTxHash && !isHash(body.roleSyncTxHash)) {
      return NextResponse.json({ error: "当前请求中的角色同步交易哈希无效。" }, { status: 400 });
    }

    // 这里只更新链下快照状态，不发起链上交易；链上动作已经由前端钱包签名完成。
    const snapshot = await markCredentialSetPublished(
      Number(body.version),
      body.publishedTxHash as `0x${string}`,
      body.roleSyncTxHash as `0x${string}` | undefined
    );
    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "当前未能更新资格名单发布状态，请稍后重试。";
    const status = /会话|权限/.test(message) ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
