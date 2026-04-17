import type { Address } from "@/types/contract-config";
import type { BenefitClaimRecord, CredentialSetPublishRecord } from "@/types/domain";
import {
  deserializeClaimHistory,
  deserializeCredentialSetPublishHistory,
  type SerializedBenefitClaimRecord,
  type SerializedCredentialSetPublishRecord
} from "@/lib/history-shared";

/** 统一解析历史类 API 响应，并把服务端错误转成前端可展示的异常。 */
async function parseHistoryResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as { error?: string } & T | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "当前未能读取事件历史，请稍后重试。");
  }

  if (!payload) {
    throw new Error("当前未能读取事件历史响应，请稍后重试。");
  }

  return payload as T;
}

/** 从服务端聚合接口读取领取历史；传入 recipient 时仅返回该地址的记录。 */
export async function fetchClaimHistory(recipient?: Address): Promise<BenefitClaimRecord[]> {
  const params = new URLSearchParams();
  if (recipient) {
    params.set("recipient", recipient);
  }

  const query = params.toString();
  const response = await fetch(`/api/history/claims${query ? `?${query}` : ""}`, {
    method: "GET",
    cache: "no-store"
  });
  const payload = await parseHistoryResponse<{ records: SerializedBenefitClaimRecord[] }>(response);
  return deserializeClaimHistory(payload.records);
}

/** 从服务端聚合接口读取资格名单发布历史。 */
export async function fetchCredentialSetPublishHistory(): Promise<CredentialSetPublishRecord[]> {
  const response = await fetch("/api/history/credential-sets", {
    method: "GET",
    cache: "no-store"
  });
  const payload = await parseHistoryResponse<{ records: SerializedCredentialSetPublishRecord[] }>(response);
  return deserializeCredentialSetPublishHistory(payload.records);
}
