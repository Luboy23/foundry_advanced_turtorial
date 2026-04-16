import { NextResponse } from "next/server";
import { loadIssuerSetSnapshot } from "@/lib/server/issuer-storage";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(loadIssuerSetSnapshot());
  } catch {
    return NextResponse.json({ error: "当前未能读取年龄验证方数据，请稍后重试。" }, { status: 500 });
  }
}
