import { NextResponse } from "next/server";
import { alcoholRoleRegistryAbi } from "@/lib/contracts/abis";
import { getServerPublicClient, getServerRuntimeConfig } from "@/lib/server/public-client";
import { loadActiveIssuerSet, savePendingIssuerDraft } from "@/lib/server/issuer-storage";
import { buildPendingIssuerSet, parseIssuerBuyerCsv } from "@/lib/server/issuer-zk";
import { readCurrentCredentialSet } from "@/lib/contracts/query";
import type { Address } from "@/types/contract-config";

export const runtime = "nodejs";

async function loadBuyerStatuses(
  publicClient: ReturnType<typeof getServerPublicClient>,
  config: ReturnType<typeof getServerRuntimeConfig>,
  addresses: Address[]
) {
  try {
    return await publicClient.multicall({
      contracts: addresses.map((address) => ({
        abi: alcoholRoleRegistryAbi,
        address: config.roleRegistryAddress,
        functionName: "isBuyer",
        args: [address]
      }))
    });
  } catch {
    return Promise.all(
      addresses.map(async (address) => ({
        status: "success" as const,
        result: await publicClient.readContract({
          abi: alcoholRoleRegistryAbi,
          address: config.roleRegistryAddress,
          functionName: "isBuyer",
          args: [address]
        })
      }))
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      csv?: string;
      referenceDate?: string;
    } | null;

    const csv = body?.csv?.trim();
    const referenceDate = body?.referenceDate?.trim();

    if (!csv || !referenceDate) {
      return NextResponse.json({ error: "请先上传买家名单并填写参考日期。" }, { status: 400 });
    }

    const publicClient = getServerPublicClient();
    const config = getServerRuntimeConfig();
    const currentSet = await readCurrentCredentialSet(publicClient, config);
    const currentSummary = loadActiveIssuerSet();
    const parsed = parseIssuerBuyerCsv(csv, referenceDate);

    if (parsed.normalizedRecords.length === 0) {
      return NextResponse.json({
        pendingSummary: null,
        invalidRows: parsed.invalidRows
      });
    }

    const buyerStatuses = await loadBuyerStatuses(
      publicClient,
      config,
      parsed.normalizedRecords.map((record) => record.walletAddress as Address)
    );

    const newBuyerAddresses = parsed.normalizedRecords
      .filter((record, index) => {
        const result = buyerStatuses[index];
        const isBuyer =
          result.status === "success" ? Boolean(result.result) : false;
        return !isBuyer;
      })
      .map((record) => record.walletAddress as Address);

    const pendingSet = await buildPendingIssuerSet({
      setId: currentSet.setId,
      sourceTitle: currentSummary?.sourceTitle ?? "政府购酒年龄资格集合",
      version: currentSet.version + 1,
      baseVersion: currentSet.version,
      referenceDate: parsed.referenceDate,
      issuer: currentSet.issuer,
      records: parsed.normalizedRecords,
      invalidRows: parsed.invalidRows,
      newBuyerAddresses
    });

    savePendingIssuerDraft({
      summary: pendingSet.summary,
      records: pendingSet.normalizedRecords,
      credentials: pendingSet.credentials
    });

    return NextResponse.json({
      pendingSummary: pendingSet.summary,
      invalidRows: pendingSet.summary.invalidRows
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "当前未能生成待发布资格集合，请稍后重试。"
      },
      { status: 500 }
    );
  }
}
