import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "当前项目已移除单独补资流程，请改用“保存并激活”一次完成资金上链。" },
    { status: 410 }
  );
}
