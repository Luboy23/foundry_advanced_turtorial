import "server-only";

import { randomUUID } from "crypto";
import type { Address } from "@/types/contract-config";

/**
 * 申请人领取私有凭证前的 challenge 服务。
 *
 * 这里不直接决定“有没有资格”，只负责发放短期 challenge 并做过期清理；真正的资格判断
 * 会在路由层结合当前资格名单再做一次。
 */
type CredentialChallengeRecord = {
  message: string;
  expiresAt: number;
};

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

/** 返回全局 challenge store，便于开发态热更新时保留内存状态。 */
function getChallengeStore() {
  const globalStore = globalThis as typeof globalThis & {
    __unemploymentBenefitCredentialChallenges__?: Map<string, CredentialChallengeRecord>;
  };

  if (!globalStore.__unemploymentBenefitCredentialChallenges__) {
    globalStore.__unemploymentBenefitCredentialChallenges__ = new Map();
  }

  return globalStore.__unemploymentBenefitCredentialChallenges__;
}

/** 统一地址大小写。 */
function normalizeAddress(address: Address) {
  return address.toLowerCase();
}

/** 清理已过期的 challenge。 */
function cleanupExpiredChallenges() {
  const store = getChallengeStore();
  const now = Date.now();

  for (const [address, challenge] of store.entries()) {
    if (challenge.expiresAt <= now) {
      store.delete(address);
    }
  }
}

/** 为某个申请地址创建一条短期 challenge。 */
export function createCredentialChallenge(address: Address) {
  cleanupExpiredChallenges();

  const expiresAt = Date.now() + CHALLENGE_TTL_MS;
  const nonce = randomUUID();
  const message = [
    "失业补助资格凭证申请确认",
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    `ExpiresAt: ${expiresAt}`
  ].join("\n");

  const challenge = {
    message,
    expiresAt
  } satisfies CredentialChallengeRecord;

  getChallengeStore().set(normalizeAddress(address), challenge);
  return challenge;
}

/** 读取当前地址最近一条有效 challenge。 */
export function getCredentialChallenge(address: Address) {
  cleanupExpiredChallenges();
  return getChallengeStore().get(normalizeAddress(address)) ?? null;
}
