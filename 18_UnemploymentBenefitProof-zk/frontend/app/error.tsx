"use client";

import { useEffect } from "react";
import { statusPageCopy } from "@/lib/copy";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[40vh] max-w-4xl items-center px-4 py-12">
      <div className="card space-y-4 border-brand-seal/25 bg-[#FFF8F7]">
        <h1 className="text-2xl font-semibold text-brand-seal">{statusPageCopy.genericErrorTitle}</h1>
        <p className="text-sm text-text-muted">{statusPageCopy.genericErrorDescription}</p>
        <button onClick={reset} className="btn-seal">
          {statusPageCopy.retryLoad}
        </button>
      </div>
    </div>
  );
}
