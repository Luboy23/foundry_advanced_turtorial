import { NextResponse } from "next/server";
import { isAddress, recoverMessageAddress } from "viem";
import type { Address } from "@/types/contract-config";
import type { CredentialClaimRequest } from "@/types/domain";
import { getCredentialChallenge, markCredentialChallengeConsumed } from "@/lib/server/credential-challenges";
import { hasClaimableCredentialForAddress, loadPrivateCredentialByAddress } from "@/lib/server/private-credentials";

export const runtime = "nodejs";

function normalizeAddress(address: Address) {
  return address.toLowerCase();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Partial<CredentialClaimRequest> | null;
    const address = body?.address;
    const message = body?.message;
    const signature = body?.signature;

    if (!address || !isAddress(address) || !message || !signature) {
      return NextResponse.json({ error: "当前领取请求缺少完整的签名信息。" }, { status: 400 });
    }

    const normalizedAddress = address as Address;
    if (!hasClaimableCredentialForAddress(normalizedAddress)) {
      return NextResponse.json({ error: "当前账户暂无可领取的年龄凭证。" }, { status: 403 });
    }

    const challenge = getCredentialChallenge(normalizedAddress);
    if (!challenge) {
      return NextResponse.json({ error: "当前领取请求已过期，请重新发起领取。" }, { status: 400 });
    }

    if (challenge.message !== message || challenge.expiresAt <= Date.now()) {
      return NextResponse.json({ error: "当前领取请求已失效，请重新发起领取。" }, { status: 400 });
    }

    const recoveredAddress = await recoverMessageAddress({
      message,
      signature
    });

    if (normalizeAddress(recoveredAddress as Address) !== normalizeAddress(normalizedAddress)) {
      return NextResponse.json({ error: "当前签名与领取账户不一致，请重新发起领取。" }, { status: 401 });
    }

    const credential = loadPrivateCredentialByAddress(normalizedAddress);
    if (!credential) {
      return NextResponse.json({ error: "未找到对应的年龄凭证，请联系年龄验证方后再试。" }, { status: 404 });
    }

    markCredentialChallengeConsumed(normalizedAddress);
    return NextResponse.json(credential);
  } catch {
    return NextResponse.json({ error: "当前未能完成年龄凭证领取，请稍后重试。" }, { status: 500 });
  }
}
