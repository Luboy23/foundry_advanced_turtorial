import "server-only";

import { randomUUID } from "crypto";
import { createPublicClient, http, recoverMessageAddress } from "viem";
import { benefitRoleRegistryAbi } from "@/lib/contracts/abis";
import { readRuntimeConfigForScript } from "@/lib/runtime-config.server";
import type { Address } from "@/types/contract-config";
import type { GovernmentActionChallenge, GovernmentSession, SignedGovernmentRequest } from "@/types/domain";

/**
 * 政府端管理会话服务。
 *
 * 这里把“地址是否真有政府权限”“签名 challenge 是否有效”“会话 token 是否过期”三层
 * 检查统一放在服务端，避免前端只靠本地状态就误判自己拥有发布资格。
 */
type ChallengeRecord = GovernmentActionChallenge & {
  address: Address;
};

type SessionRecord = GovernmentSession;

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = 20 * 60 * 1000;

/** 统一把地址转成小写，避免签名校验和 Map 键因为大小写不一致出错。 */
function normalizeAddress(address: Address) {
  return address.toLowerCase();
}

/** 返回全局 challenge store，开发态热更新时也能复用同一份内存状态。 */
function getChallengeStore() {
  const globalStore = globalThis as typeof globalThis & {
    __unemploymentBenefitGovernmentChallenges__?: Map<string, ChallengeRecord>;
  };

  if (!globalStore.__unemploymentBenefitGovernmentChallenges__) {
    globalStore.__unemploymentBenefitGovernmentChallenges__ = new Map();
  }

  return globalStore.__unemploymentBenefitGovernmentChallenges__;
}

/** 返回全局 session store。 */
function getSessionStore() {
  const globalStore = globalThis as typeof globalThis & {
    __unemploymentBenefitGovernmentSessions__?: Map<string, SessionRecord>;
  };

  if (!globalStore.__unemploymentBenefitGovernmentSessions__) {
    globalStore.__unemploymentBenefitGovernmentSessions__ = new Map();
  }

  return globalStore.__unemploymentBenefitGovernmentSessions__;
}

/** 清理已过期的 challenge 和 session，避免内存里的旧会话长期残留。 */
function cleanupExpiredEntries() {
  const now = Date.now();

  for (const [address, challenge] of getChallengeStore().entries()) {
    if (challenge.expiresAt <= now) {
      getChallengeStore().delete(address);
    }
  }

  for (const [token, session] of getSessionStore().entries()) {
    if (session.expiresAt <= now) {
      getSessionStore().delete(token);
    }
  }
}

/** 创建只读 public client，用于服务端复查政府角色。 */
function getPublicClient() {
  const config = readRuntimeConfigForScript();
  return createPublicClient({
    transport: http(config.rpcUrl)
  });
}

/** 判断地址当前是否仍具备 government 角色。 */
export async function isGovernmentAddress(address: Address) {
  const config = readRuntimeConfigForScript();
  const publicClient = getPublicClient();

  return (await publicClient.readContract({
    abi: benefitRoleRegistryAbi,
    address: config.roleRegistryAddress,
    functionName: "isGovernment",
    args: [address]
  })) as boolean;
}

/** 创建一条政府端管理 challenge，要求地址在链上确实具备 government 权限。 */
export async function createGovernmentSessionChallenge(address: Address) {
  cleanupExpiredEntries();

  if (!(await isGovernmentAddress(address))) {
    throw new Error("当前账户暂无审核管理权限。");
  }

  const expiresAt = Date.now() + CHALLENGE_TTL_MS;
  const nonce = randomUUID();
  const message = [
    "失业补助资格审核管理确认",
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    `ExpiresAt: ${expiresAt}`
  ].join("\n");

  const challenge = {
    address,
    message,
    expiresAt
  } satisfies ChallengeRecord;

  getChallengeStore().set(message, challenge);
  return {
    message: challenge.message,
    expiresAt: challenge.expiresAt
  };
}

/** 校验签名后的政府管理 challenge，并签发短期 session token。 */
export async function verifyGovernmentSession(request: SignedGovernmentRequest) {
  cleanupExpiredEntries();

  if (!(await isGovernmentAddress(request.address))) {
    throw new Error("当前账户暂无审核管理权限。");
  }

  const challenge = getChallengeStore().get(request.message);
  if (!challenge || challenge.expiresAt <= Date.now()) {
    throw new Error("当前管理确认已过期，请重新发起。");
  }

  if (challenge.address.toLowerCase() !== normalizeAddress(request.address)) {
    throw new Error("当前管理确认已失效，请重新发起。");
  }

  const recoveredAddress = (await recoverMessageAddress({
    message: request.message,
    signature: request.signature
  })) as Address;

  if (normalizeAddress(recoveredAddress) !== normalizeAddress(request.address)) {
    throw new Error("当前签名与审核管理账户不一致。");
  }

  const session: SessionRecord = {
    token: randomUUID(),
    expiresAt: Date.now() + SESSION_TTL_MS,
    address: request.address
  };

  getSessionStore().set(session.token, session);
  getChallengeStore().delete(request.message);
  return session;
}

/** 校验 Bearer token 对应的政府会话是否仍有效。 */
export async function requireGovernmentSession(token: string | null | undefined) {
  cleanupExpiredEntries();

  if (!token) {
    throw new Error("当前管理会话无效，请重新确认账户权限。");
  }

  const session = getSessionStore().get(token);
  if (!session || session.expiresAt <= Date.now()) {
    throw new Error("当前管理会话已过期，请重新确认账户权限。");
  }

  if (!(await isGovernmentAddress(session.address))) {
    getSessionStore().delete(token);
    throw new Error("当前账户暂无审核管理权限。");
  }

  return session;
}

/** 从 Authorization 头里提取 Bearer token。 */
export function parseBearerToken(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim() || null;
}
