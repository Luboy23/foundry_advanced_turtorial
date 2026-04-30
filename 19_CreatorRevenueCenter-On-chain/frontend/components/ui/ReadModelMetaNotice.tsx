"use client";

import { getReadModelMetaDescription, getReadModelMetaTitle, getReadModelMetaTone } from "@/lib/read-model-meta";
import { InfoNotice } from "@/components/ui/StatePanels";
import type { ReadModelMeta } from "@/types/domain";

export function ReadModelMetaNotice({ meta }: { meta: ReadModelMeta }) {
  if (!meta.degraded) {
    return null;
  }

  return (
    <InfoNotice
      title={getReadModelMetaTitle(meta)}
      description={getReadModelMetaDescription(meta)}
      tone={getReadModelMetaTone(meta)}
    />
  );
}
