import { NextRequest, NextResponse } from "next/server";
import { createServerPublicClient } from "@/lib/server/public-client";

const TX_HASH_PATTERN = /^0x[a-fA-F0-9]{64}$/;
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store"
} as const;

function isReceiptPollingError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("timed out") ||
    message.includes("timeout") ||
    message.includes("transaction receipt") ||
    message.includes("transaction not found")
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const hash = searchParams.get("hash");

  if (!hash || !TX_HASH_PATTERN.test(hash)) {
    return NextResponse.json({ error: "无效的交易哈希。" }, { status: 400, headers: NO_STORE_HEADERS });
  }

  try {
    const receipt = await createServerPublicClient().waitForTransactionReceipt({
      hash: hash as `0x${string}`,
      timeout: 45_000
    });

    return NextResponse.json(
      {
        hash: receipt.transactionHash,
        blockNumber: receipt.blockNumber.toString(),
        status: receipt.status
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    const fallbackMessage = "交易已提交，但暂时没有读取到链上确认，请稍后刷新状态确认结果。";
    const pollingError = isReceiptPollingError(error);
    const message =
      error instanceof Error && error.message.trim().length > 0 && !pollingError
        ? error.message
        : fallbackMessage;

    return NextResponse.json({ error: message }, { status: pollingError ? 504 : 500, headers: NO_STORE_HEADERS });
  }
}
