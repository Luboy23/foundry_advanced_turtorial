import { NextRequest, NextResponse } from "next/server";
import { previewPlatformMonthlyActivation, readPlatformMonthlyConfigs } from "@/lib/server/platform-monthly-config";
import { buildReadModelMeta, toReadModelReason, withReadModelMeta } from "@/lib/server/read-model-meta";

function buildEmptyPayload() {
  return {
    configs: [],
    activeMonth: null as string | null,
    minAllowedMonth: ""
  };
}

export async function GET() {
  try {
    const payload = readPlatformMonthlyConfigs();
    return NextResponse.json(withReadModelMeta(payload, buildReadModelMeta({ source: "server-data" })));
  } catch (error) {
    const meta = buildReadModelMeta({
      source: "server-data",
      degraded: true,
      reason: toReadModelReason(error, "当前月度配置读取失败。")
    });
    return NextResponse.json(withReadModelMeta(buildEmptyPayload(), meta));
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | {
        monthLabel?: unknown;
        grossAmountEth?: unknown;
      }
    | null;

  const monthLabel = typeof body?.monthLabel === "string" ? body.monthLabel : "";
  const grossAmountEth = typeof body?.grossAmountEth === "string" ? body.grossAmountEth : "";

  try {
    const payload = previewPlatformMonthlyActivation({ monthLabel, grossAmountEth });
    return NextResponse.json(withReadModelMeta(payload, buildReadModelMeta({ source: "server-data" })));
  } catch (error) {
    const reason = toReadModelReason(error, "月度激活预览生成失败。");
    const status =
      reason.includes("格式") ||
      reason.includes("请输入") ||
      reason.includes("必须") ||
      reason.includes("只能录入") ||
      reason.includes("不能再次设置")
        ? 400
        : 500;
    return NextResponse.json({ error: reason }, { status });
  }
}
