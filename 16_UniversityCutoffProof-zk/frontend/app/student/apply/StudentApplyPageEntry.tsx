"use client";

import dynamic from "next/dynamic";

const StudentApplyPageClient = dynamic(() => import("./StudentApplyPageClient"), {
  ssr: false
});

export function StudentApplyPageEntry() {
  return <StudentApplyPageClient />;
}
