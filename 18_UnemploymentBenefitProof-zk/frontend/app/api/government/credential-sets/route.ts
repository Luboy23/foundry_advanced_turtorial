import { NextResponse } from "next/server";
import { readGovernmentCredentialSetState } from "@/lib/server/credential-set-store";

export const runtime = "nodejs";

/** 读取政府工作台完整状态。 */
export async function GET() {
  try {
    const state = await readGovernmentCredentialSetState();
    return NextResponse.json({
      ...state,
      // merkleRoot 在 JSON 里不能直接传 bigint，这里先转字符串，客户端再还原。
      currentChainSet: state.currentChainSet
        ? {
            ...state.currentChainSet,
            merkleRoot: state.currentChainSet.merkleRoot.toString()
          }
        : null
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "当前未能读取资格名单管理数据，请稍后重试。" },
      { status: 500 }
    );
  }
}
