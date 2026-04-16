import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { isEligibleOnYmd } from "@/lib/domain/age-eligibility";
import type { Address } from "@/types/contract-config";
import { getCachedCurrentUtcDateYmd, getServerPublicClient, getServerRuntimeConfig } from "@/lib/server/public-client";
import { isAddressInActiveIssuerSet, loadClaimableCredentialByAddress } from "@/lib/server/issuer-storage";
import { readEligibilityStatus, readRoleStatus } from "@/lib/contracts/query";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");

    if (!address || !isAddress(address)) {
      return NextResponse.json({ error: "请提供有效的钱包地址。" }, { status: 400 });
    }

    const normalizedAddress = address as Address;
    const publicClient = getServerPublicClient();
    const config = getServerRuntimeConfig();
    const [roleStatus, eligibility, currentDateYmd] = await Promise.all([
      readRoleStatus(publicClient, config, normalizedAddress),
      readEligibilityStatus(publicClient, config, normalizedAddress),
      getCachedCurrentUtcDateYmd()
    ]);
    const credential = loadClaimableCredentialByAddress(normalizedAddress);

    return NextResponse.json({
      address: normalizedAddress,
      inActiveSet: isAddressInActiveIssuerSet(normalizedAddress),
      hasClaimableCredential: Boolean(credential),
      isBuyer: roleStatus.isBuyer,
      currentlyEligible: isEligibleOnYmd(credential?.eligibleFromYmd ?? null, currentDateYmd),
      eligibleFromYmd: credential?.eligibleFromYmd ?? null,
      eligibility
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "当前未能查询买家资格状态，请稍后重试。"
      },
      { status: 500 }
    );
  }
}
