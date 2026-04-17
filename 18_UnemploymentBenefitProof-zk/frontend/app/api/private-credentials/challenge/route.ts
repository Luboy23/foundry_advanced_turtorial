import { NextResponse } from "next/server";
import { isAddress } from "viem";
import type { Address } from "@/types/contract-config";
import { createCredentialChallenge } from "@/lib/server/credential-challenges";
import { hasCurrentPrivateCredential } from "@/lib/server/private-credentials";

export const runtime = "nodejs";

/** 申请人领取私有凭证前的 challenge 接口。 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { address?: string } | null;
    const address = body?.address;

    if (!address || !isAddress(address)) {
      return NextResponse.json({ error: "当前申请缺少有效账户地址。" }, { status: 400 });
    }

    const normalizedAddress = address as Address;
    // 只有当前资格名单里的申请人才能拿到 challenge，避免无资格地址进入签名流程。
    if (!(await hasCurrentPrivateCredential(normalizedAddress))) {
      return NextResponse.json({ error: "当前账户暂无申请资格。" }, { status: 403 });
    }

    const challenge = createCredentialChallenge(normalizedAddress);
    return NextResponse.json(challenge);
  } catch {
    return NextResponse.json({ error: "当前未能创建资格凭证申请，请稍后重试。" }, { status: 500 });
  }
}
