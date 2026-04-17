import { NextResponse } from "next/server";
import { isAddress, recoverMessageAddress } from "viem";
import type { Address } from "@/types/contract-config";
import type { CredentialClaimRequest } from "@/types/domain";
import { getCredentialChallenge } from "@/lib/server/credential-challenges";
import { hasCurrentPrivateCredential, loadPrivateCredentialByAddress } from "@/lib/server/private-credentials";

export const runtime = "nodejs";

/** 统一地址大小写，避免签名恢复结果和请求参数比较时因大小写差异误判。 */
function normalizeAddress(address: Address) {
  return address.toLowerCase();
}

/** 提交签名后的凭证领取接口。 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Partial<CredentialClaimRequest> | null;
    const address = body?.address;
    const message = body?.message;
    const signature = body?.signature;

    if (!address || !isAddress(address) || !message || !signature) {
      return NextResponse.json({ error: "当前申请缺少完整的签名信息。" }, { status: 400 });
    }

    const normalizedAddress = address as Address;
    if (!(await hasCurrentPrivateCredential(normalizedAddress))) {
      return NextResponse.json({ error: "当前账户暂无申请资格。" }, { status: 403 });
    }

    const challenge = getCredentialChallenge(normalizedAddress);
    if (!challenge) {
      return NextResponse.json({ error: "当前申请已过期，请重新发起资格凭证申请。" }, { status: 400 });
    }

    if (challenge.message !== message || challenge.expiresAt <= Date.now()) {
      return NextResponse.json({ error: "当前申请已失效，请重新发起资格凭证申请。" }, { status: 400 });
    }

    const recoveredAddress = await recoverMessageAddress({
      message,
      signature
    });

    // 服务端必须再次校验签名归属，不能只相信前端传来的 address。
    if (normalizeAddress(recoveredAddress as Address) !== normalizeAddress(normalizedAddress)) {
      return NextResponse.json({ error: "当前签名与申请账户不一致，请重新发起资格凭证申请。" }, { status: 401 });
    }

    const credential = await loadPrivateCredentialByAddress(normalizedAddress);
    if (!credential) {
      return NextResponse.json({ error: "当前资格名单尚未发布，或未找到对应的资格凭证。" }, { status: 404 });
    }

    return NextResponse.json(credential);
  } catch {
    return NextResponse.json({ error: "当前未能完成资格凭证申请，请稍后重试。" }, { status: 500 });
  }
}
