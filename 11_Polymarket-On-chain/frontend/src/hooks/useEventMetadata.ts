import { useQuery } from "@tanstack/react-query";

import { parseEventMetadata, resolveMetadataUri, type TeachingEventMetadata } from "@/lib/event-metadata";

/** metadata 读取结果：解析地址、原始数据与规范化结构。 */
export type EventMetadataResult = {
  resolvedUrl: string | null;
  raw: unknown | null;
  teaching: TeachingEventMetadata | null;
};

const emptyResult: EventMetadataResult = {
  resolvedUrl: null,
  raw: null,
  teaching: null
};

/** 根据 metadataURI 拉取并解析事件资料。 */
export function useEventMetadata(metadataURI: string | null | undefined) {
  const normalizedUri = (metadataURI ?? "").trim();

  return useQuery<EventMetadataResult>({
    queryKey: ["event-metadata", normalizedUri || "none"],
    queryFn: async () => {
      const resolvedUrl = resolveMetadataUri(normalizedUri);
      if (!resolvedUrl) {
        return emptyResult;
      }

      const response = await fetch(resolvedUrl, {
        method: "GET",
        cache: "no-store"
      });
      if (!response.ok) {
        throw new Error(`METADATA_FETCH_FAILED_${response.status}`);
      }

      const raw = (await response.json()) as unknown;
      return {
        resolvedUrl,
        raw,
        teaching: parseEventMetadata(raw)
      };
    },
    enabled: normalizedUri.length > 0,
    initialData: emptyResult
  });
}
