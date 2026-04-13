import { apiFetch } from "@/lib/api/client";
import type {
  AuthChallengeDto,
  BackendSessionStatusDto,
  WalletSessionDto
} from "@/types/backend";

export function createAuthChallenge(walletAddress: string) {
  return apiFetch<AuthChallengeDto>("/api/auth/challenge", {
    method: "POST",
    body: JSON.stringify({ walletAddress })
  });
}

export function verifyAuthChallenge(args: {
  walletAddress: string;
  challenge: string;
  signature: string;
}) {
  return apiFetch<WalletSessionDto>("/api/auth/verify", {
    method: "POST",
    body: JSON.stringify(args)
  });
}

export function getBackendSession() {
  return apiFetch<BackendSessionStatusDto | null>("/api/auth/session");
}

export function logoutBackendSession(sessionId?: string) {
  return apiFetch<{ ok: boolean }>("/api/auth/logout", {
    method: "POST",
    body: JSON.stringify({ sessionId })
  });
}
