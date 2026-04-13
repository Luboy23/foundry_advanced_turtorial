import type { ReactNode } from "react";

export function PageContainer({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-[calc(100vh-64px-105px)] bg-[radial-gradient(circle_at_top,_rgba(219,234,254,0.45),_transparent_32%),linear-gradient(180deg,_#f8fafc_0%,_#f1f5f9_100%)]">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">{children}</div>
    </main>
  );
}
