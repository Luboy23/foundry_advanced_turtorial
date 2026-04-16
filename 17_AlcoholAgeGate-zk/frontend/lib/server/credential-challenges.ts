import "server-only";

import { randomUUID } from "crypto";
import type { Address } from "@/types/contract-config";
import {
  consumeCredentialChallenge,
  deleteExpiredCredentialChallenges,
  loadCredentialChallenge,
  upsertCredentialChallenge
} from "@/lib/server/runtime-db";

type CredentialChallengeRecord = {
  message: string;
  expiresAt: number;
};

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

// challenge 持久化的意义，是让“签完名但页面刷新 / 服务重启”的场景仍能继续 claim，
// 而不是把这条领取链绑死在进程内存里。
export function createCredentialChallenge(address: Address) {
  deleteExpiredCredentialChallenges();

  const expiresAt = Date.now() + CHALLENGE_TTL_MS;
  const nonce = randomUUID();
  const message = [
    "AlcoholAgeGate 私有年龄凭证领取确认",
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    `ExpiresAt: ${expiresAt}`
  ].join("\n");

  upsertCredentialChallenge({
    address,
    message,
    nonce,
    expiresAt
  });

  return {
    message,
    expiresAt
  } satisfies CredentialChallengeRecord;
}

export function getCredentialChallenge(address: Address) {
  const challenge = loadCredentialChallenge(address);
  // 已消费 challenge 不允许复用，避免一份签名被拿来重复领取私有凭证。
  if (!challenge || challenge.consumed_at) {
    return null;
  }

  return {
    message: challenge.message,
    expiresAt: challenge.expires_at
  } satisfies CredentialChallengeRecord;
}

export function markCredentialChallengeConsumed(address: Address) {
  consumeCredentialChallenge(address);
}
