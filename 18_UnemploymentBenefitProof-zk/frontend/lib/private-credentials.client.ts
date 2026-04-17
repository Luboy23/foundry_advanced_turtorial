import type { Address } from "@/types/contract-config";
import type {
  CredentialChallengeResponse,
  CredentialClaimRequest,
  LocalUnemploymentCredential
} from "@/types/domain";

/**
 * 申请人私有凭证 API 客户端。
 *
 * 页面层只需要知道“先拿 challenge，再提交签名换凭证”，所有响应解析和错误映射都收敛在这里。
 */
async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as { error?: string } & T | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "当前未能完成资格凭证操作，请稍后重试。");
  }

  if (!payload) {
    throw new Error("当前未能读取资格凭证响应，请稍后重试。");
  }

  return payload as T;
}

/** 请求当前地址的资格凭证 challenge。 */
export async function requestCredentialChallenge(address: Address) {
  const response = await fetch("/api/private-credentials/challenge", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    cache: "no-store",
    body: JSON.stringify({ address })
  });

  return parseJsonResponse<CredentialChallengeResponse>(response);
}

/** 提交签名后的凭证领取请求，返回服务端准备好的私有凭证样例。 */
export async function claimPrivateCredential(request: CredentialClaimRequest) {
  const response = await fetch("/api/private-credentials/claim", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    cache: "no-store",
    body: JSON.stringify(request)
  });

  return parseJsonResponse<LocalUnemploymentCredential>(response);
}
