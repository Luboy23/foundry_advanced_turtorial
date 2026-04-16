import type { Address } from "@/types/contract-config";
import type {
  IssuerBuyerStatus,
  IssuerSetSnapshot,
  IssuerPendingSetSummary,
  IssuerUploadInvalidRow
} from "@/types/domain";

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as { error?: string } & T | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "当前未能完成年龄验证方操作，请稍后重试。");
  }

  if (!payload) {
    throw new Error("当前未能读取年龄验证方响应，请稍后重试。");
  }

  return payload as T;
}

export function fetchIssuerSetSnapshot() {
  return fetch("/api/issuer/pending", { cache: "no-store" }).then((response) => parseJsonResponse<IssuerSetSnapshot>(response));
}

export function uploadIssuerBuyerCsv(args: {
  csv: string;
  referenceDate: string;
}) {
  return fetch("/api/issuer/upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    cache: "no-store",
    body: JSON.stringify(args)
  }).then((response) =>
    parseJsonResponse<{
      pendingSummary: IssuerPendingSetSummary | null;
      invalidRows: IssuerUploadInvalidRow[];
    }>(response)
  );
}

export function activateIssuerPendingSet() {
  return fetch("/api/issuer/activate", {
    method: "POST",
    cache: "no-store"
  }).then((response) => parseJsonResponse<{ activeSummary: IssuerSetSnapshot["activeSummary"] }>(response));
}

export function fetchIssuerBuyerStatus(address: Address) {
  return fetch(`/api/issuer/buyers?address=${address}`, {
    cache: "no-store"
  }).then((response) => parseJsonResponse<IssuerBuyerStatus>(response));
}
