"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-5 text-center">
      <div className="soft-pill">页面暂时不可用</div>
      <h1 className="page-title">页面暂不可用</h1>
      <p className="max-w-xl text-sm leading-7 text-text-muted">请重新加载，或稍后再试。</p>
      <button onClick={reset} className="rounded-full bg-brand-pink px-6 py-3 text-sm font-bold text-white">
        重新加载
      </button>
    </div>
  );
}
