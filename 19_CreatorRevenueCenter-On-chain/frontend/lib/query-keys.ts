import type { RuntimeConfig } from "@/types/contract-config";

type ScopedPart = string | number;

export function scopedQueryKey(
  config: Pick<RuntimeConfig, "chainId" | "deploymentId">,
  ...parts: Array<ScopedPart>
) {
  return ["creator-revenue-center", config.chainId, config.deploymentId, ...parts] as const;
}
