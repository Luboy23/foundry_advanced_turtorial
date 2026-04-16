import "server-only";

import type { Address } from "@/types/contract-config";
import type { LocalAgeCredential } from "@/types/domain";
import { hasClaimableCredential, loadClaimableCredentialByAddress } from "@/lib/server/issuer-storage";

// 这一层故意保持很薄：服务端只根据当前 active 身份集合判断“这个地址是否可领取凭证”，
// 不在这里重新参与年龄判断或链上资格判断。
export function hasClaimableCredentialForAddress(address: Address) {
  return hasClaimableCredential(address);
}

export function loadPrivateCredentialByAddress(address: Address): LocalAgeCredential | null {
  return loadClaimableCredentialByAddress(address);
}
