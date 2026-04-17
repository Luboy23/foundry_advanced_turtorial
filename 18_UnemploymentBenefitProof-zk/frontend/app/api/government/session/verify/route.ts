import { NextResponse } from "next/server";
import { isAddress } from "viem";
import type { Address } from "@/types/contract-config";
import type { SignedGovernmentRequest } from "@/types/domain";
import { verifyGovernmentSession } from "@/lib/server/government-sessions";

export const runtime = "nodejs";

/** 政府端管理签名验证接口。 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Partial<SignedGovernmentRequest> | null;
    const address = body?.address;
    const message = body?.message;
    const signature = body?.signature;

    if (!address || !isAddress(address) || !message || !signature) {
      return NextResponse.json({ error: "当前请求缺少完整的管理确认信息。" }, { status: 400 });
    }

    const session = await verifyGovernmentSession({
      address: address as Address,
      message,
      signature
    });

    return NextResponse.json(session);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "当前未能完成管理确认，请稍后重试。" },
      { status: 401 }
    );
  }
}
