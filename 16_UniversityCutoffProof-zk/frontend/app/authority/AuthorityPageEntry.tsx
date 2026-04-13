"use client";

import dynamic from "next/dynamic";

const AuthorityPageClient = dynamic(() => import("./AuthorityPageClient"), {
  ssr: false
});

export function AuthorityPageEntry() {
  return <AuthorityPageClient />;
}
