import { readRuntimeConfigForScript } from "@/lib/runtime-config.server";
import type { ReadModelMeta, ReadModelPayload, ReadModelSource } from "@/types/domain";

const INFRA_ERROR_PATTERNS = [
  /fetch failed/i,
  /econnrefused/i,
  /econnreset/i,
  /enotfound/i,
  /etimedout/i,
  /indexer_http_\d+/i,
  /indexer_empty_data/i,
  /indexer_graphql_error/i
];

function normalizeReason(reason: string | null | undefined) {
  if (!reason) return null;
  const trimmed = reason.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return normalizeReason(error.message);
  }

  if (typeof error === "string") {
    return normalizeReason(error);
  }

  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
    return normalizeReason(error.message);
  }

  return null;
}

function isInfrastructureError(message: string) {
  return INFRA_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export function buildReadModelMeta(args: {
  source: ReadModelSource;
  degraded?: boolean;
  reason?: string | null;
  syncedAt?: string;
}): ReadModelMeta {
  const config = readRuntimeConfigForScript();

  return {
    source: args.source,
    degraded: Boolean(args.degraded),
    reason: normalizeReason(args.reason),
    syncedAt: args.syncedAt ?? new Date().toISOString(),
    deploymentId: config.deploymentId
  };
}

export function withReadModelMeta<T extends object>(payload: T, meta: ReadModelMeta): T & ReadModelPayload {
  return {
    ...payload,
    meta
  };
}

export function toReadModelReason(error: unknown, fallback = "当前读模型同步失败，已切换到回退路径。") {
  const message = extractErrorMessage(error);
  if (!message) return fallback;

  return isInfrastructureError(message) ? fallback : message;
}
