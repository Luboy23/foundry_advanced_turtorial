import type { Address } from "@/types/contract-config";
import type { CredentialChallengeResponse, CredentialClaimRequest, LocalAgeCredential } from "@/types/domain";

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as { error?: string } & T | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "当前未能完成年龄凭证操作，请稍后重试。");
  }

  if (!payload) {
    throw new Error("当前未能读取年龄凭证响应，请稍后重试。");
  }

  return payload as T;
}

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

export async function claimPrivateCredential(request: CredentialClaimRequest) {
  const response = await fetch("/api/private-credentials/claim", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    cache: "no-store",
    body: JSON.stringify(request)
  });

  return parseJsonResponse<LocalAgeCredential>(response);
}
