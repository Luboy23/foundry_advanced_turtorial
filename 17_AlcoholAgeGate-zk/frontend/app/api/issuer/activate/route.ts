import { NextResponse } from "next/server";
import { activatePendingIssuerDraft, loadPendingIssuerSet } from "@/lib/server/issuer-storage";
import { getServerPublicClient, getServerRuntimeConfig } from "@/lib/server/public-client";
import { readCurrentCredentialSet } from "@/lib/contracts/query";

export const runtime = "nodejs";

export async function POST() {
  try {
    const pendingSummary = loadPendingIssuerSet();
    if (!pendingSummary) {
      return NextResponse.json({ error: "当前没有待发布的资格集合。" }, { status: 404 });
    }

    const publicClient = getServerPublicClient();
    const config = getServerRuntimeConfig();
    const currentSet = await readCurrentCredentialSet(publicClient, config);

    if (
      currentSet.setId.toLowerCase() !== pendingSummary.setId.toLowerCase() ||
      currentSet.version !== pendingSummary.version ||
      currentSet.referenceDate !== pendingSummary.referenceDate ||
      currentSet.merkleRoot.toString() !== pendingSummary.merkleRoot
    ) {
      return NextResponse.json(
        { error: "链上当前资格集合与待发布草稿不一致，请重新上传并生成草稿后再试。" },
        { status: 409 }
      );
    }

    const activeSummary = {
      setId: pendingSummary.setId,
      sourceTitle: pendingSummary.sourceTitle,
      version: pendingSummary.version,
      referenceDate: pendingSummary.referenceDate,
      merkleRoot: pendingSummary.merkleRoot,
      memberCount: pendingSummary.memberCount,
      adultCountNow: pendingSummary.adultCountNow,
      minorCountNow: pendingSummary.minorCountNow,
      updatedAt: currentSet.updatedAt,
      buyerAddresses: pendingSummary.buyerAddresses
    };

    activatePendingIssuerDraft(activeSummary);

    return NextResponse.json({
      activeSummary
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "当前未能激活已发布的资格集合，请稍后重试。"
      },
      { status: 500 }
    );
  }
}
