import { NextResponse } from "next/server";
import { isAddress } from "viem";
import type { Address } from "@/types/contract-config";
import { createGovernmentSessionChallenge } from "@/lib/server/government-sessions";

export const runtime = "nodejs";

/** 政府端管理 challenge 接口。 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { address?: string } | null;
    const address = body?.address;

    if (!address || !isAddress(address)) {
      return NextResponse.json({ error: "当前请求缺少有效的审核管理账户地址。" }, { status: 400 });
    }

    const challenge = await createGovernmentSessionChallenge(address as Address);
    return NextResponse.json(challenge);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "当前未能创建管理确认，请稍后重试。" },
      { status: 403 }
    );
  }
}
