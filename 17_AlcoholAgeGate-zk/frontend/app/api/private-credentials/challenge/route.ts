import { NextResponse } from "next/server";
import { isAddress } from "viem";
import type { Address } from "@/types/contract-config";
import { createCredentialChallenge } from "@/lib/server/credential-challenges";
import { hasClaimableCredentialForAddress } from "@/lib/server/private-credentials";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { address?: string } | null;
    const address = body?.address;

    if (!address || !isAddress(address)) {
      return NextResponse.json({ error: "当前领取请求缺少有效账户地址。" }, { status: 400 });
    }

    const normalizedAddress = address as Address;
    if (!hasClaimableCredentialForAddress(normalizedAddress)) {
      return NextResponse.json({ error: "当前账户暂无可领取的年龄凭证。" }, { status: 403 });
    }

    const challenge = createCredentialChallenge(normalizedAddress);
    return NextResponse.json(challenge);
  } catch {
    return NextResponse.json({ error: "当前未能创建年龄凭证领取请求，请稍后重试。" }, { status: 500 });
  }
}
