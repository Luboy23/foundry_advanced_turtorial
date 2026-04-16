"use client";

import { useEffect } from "react";
import { StatePanel } from "@/components/shared/StatePanel";

export default function GlobalError({
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
    <div className="mx-auto max-w-3xl py-10">
      <StatePanel
        title="页面加载失败"
        description="当前页面暂时无法显示。你可以重新尝试，或稍后再回来。"
        tone="danger"
        action={
          <button onClick={reset} className="btn-primary">
            重新加载页面
          </button>
        }
      />
    </div>
  );
}
