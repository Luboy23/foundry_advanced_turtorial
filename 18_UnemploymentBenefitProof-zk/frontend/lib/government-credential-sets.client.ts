import type { Address } from "@/types/contract-config";
import type {
  CredentialSetDraftInput,
  GeneratedCredentialSetSnapshot,
  GovernmentActionChallenge,
  GovernmentCredentialSetState,
  GovernmentSession,
  SignedGovernmentRequest,
  UnemploymentCredentialSet
} from "@/types/domain";

/**
 * 政府端管理 API 客户端。
 *
 * 页面层通过这些函数访问 session challenge、草稿生成和发布状态更新接口，不直接处理
 * `fetch` 细节或序列化差异。
 */
type SerializedUnemploymentCredentialSet = Omit<UnemploymentCredentialSet, "merkleRoot"> & {
  merkleRoot: string;
};

type SerializedGovernmentCredentialSetState = Omit<GovernmentCredentialSetState, "currentChainSet"> & {
  currentChainSet: SerializedUnemploymentCredentialSet | null;
};

/** 统一解析 API JSON 响应，并把服务端错误转成页面可展示的 Error。 */
async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as { error?: string } & T | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "当前未能完成资格名单管理操作，请稍后重试。");
  }

  if (!payload) {
    throw new Error("当前未能读取资格名单管理响应，请稍后重试。");
  }

  return payload as T;
}

/** 根据是否存在 token 构造管理接口的 Authorization 头。 */
function buildAuthHeaders(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** 请求政府端签名 challenge。 */
export async function requestGovernmentSessionChallenge(address: Address) {
  const response = await fetch("/api/government/session/challenge", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    cache: "no-store",
    body: JSON.stringify({ address })
  });

  return parseJsonResponse<GovernmentActionChallenge>(response);
}

/** 提交签名后的政府 challenge，换取短期 session token。 */
export async function verifyGovernmentSession(request: SignedGovernmentRequest) {
  const response = await fetch("/api/government/session/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    cache: "no-store",
    body: JSON.stringify(request)
  });

  return parseJsonResponse<GovernmentSession>(response);
}

/** 拉取政府工作台所需的完整管理状态，并把字符串化的 merkleRoot 还原成 bigint。 */
export async function fetchGovernmentCredentialSetState(token?: string) {
  const response = await fetch("/api/government/credential-sets", {
    method: "GET",
    headers: buildAuthHeaders(token),
    cache: "no-store"
  });

  const payload = await parseJsonResponse<SerializedGovernmentCredentialSetState>(response);

  return {
    ...payload,
    currentChainSet: payload.currentChainSet
      ? {
          ...payload.currentChainSet,
          merkleRoot: BigInt(payload.currentChainSet.merkleRoot)
        }
      : null
  } satisfies GovernmentCredentialSetState;
}

/** 把当前编辑器草稿提交给服务端，生成待发布快照和新增申请地址列表。 */
export async function prepareGovernmentCredentialSetDraft(token: string, draft: CredentialSetDraftInput) {
  const response = await fetch("/api/government/credential-sets/draft", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(token)
    },
    cache: "no-store",
    body: JSON.stringify(draft)
  });

  return parseJsonResponse<{
    snapshot: GeneratedCredentialSetSnapshot;
    pendingApplicantAddresses: Address[];
  }>(response);
}

/** 在链上发布完成后，通知服务端把本地快照标记为已发布。 */
export async function markGovernmentCredentialSetPublished(args: {
  token: string;
  version: number;
  publishedTxHash: `0x${string}`;
  roleSyncTxHash?: `0x${string}`;
}) {
  const response = await fetch("/api/government/credential-sets/publish", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(args.token)
    },
    cache: "no-store",
    body: JSON.stringify({
      version: args.version,
      publishedTxHash: args.publishedTxHash,
      roleSyncTxHash: args.roleSyncTxHash
    })
  });

  return parseJsonResponse<GeneratedCredentialSetSnapshot>(response);
}
