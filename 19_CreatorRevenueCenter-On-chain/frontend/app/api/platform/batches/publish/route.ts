import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "当前项目已改为“保存并激活”流程，请改用 /api/platform/monthly-configs 预览接口。" },
    { status: 410 }
  );
}
