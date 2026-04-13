import type { ReadClient } from "@/lib/blockchain/read-client";
import admissionRoleRegistryAbiJson from "@/abi/AdmissionRoleRegistry.json";
import type { Address } from "@/types/contract-config";
import type { SchoolFamilyKey } from "@/types/admission";
import type { AppRole, RoleIdentity } from "@/types/auth";
import { asciiToBytes32Hex, decodeSchoolIdLabel } from "@/lib/admission/rule-version";

export const admissionRoleRegistryAbi = admissionRoleRegistryAbiJson;

// 零值 bytes32 在角色注册合约里表示“该地址没有绑定任何大学身份”。
const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000" as const;
export const UNIVERSITY_KEY_BYTES32: Record<SchoolFamilyKey, `0x${string}`> = {
  pku: asciiToBytes32Hex("pku"),
  jiatingdun: asciiToBytes32Hex("jiatingdun")
};

// 前端需要把链上 bytes32 大学键折叠成稳定的家族键，方便页面、路由和文案共用一套分支。
export function toSchoolFamilyKey(universityKey: `0x${string}` | null): SchoolFamilyKey | null {
  if (!universityKey || universityKey === ZERO_BYTES32) {
    return null;
  }

  const decoded = decodeSchoolIdLabel(universityKey);
  if (decoded === "pku") {
    return "pku";
  }
  if (decoded === "jiatingdun") {
    return "jiatingdun";
  }
  return null;
}

// 一次性读取当前钱包在角色注册合约中的全部身份信息。
// 这样可以避免前端分别多次查询 authority / student / university，减少闪烁和竞态。
export async function getRoleIdentity(
  publicClient: ReadClient,
  registryAddress: Address,
  walletAddress: Address
): Promise<RoleIdentity> {
  const [isAuthority, isStudent, universityKey] = await Promise.all([
    publicClient.readContract({
      abi: admissionRoleRegistryAbi,
      address: registryAddress,
      functionName: "isAuthority",
      args: [walletAddress]
    }) as Promise<boolean>,
    publicClient.readContract({
      abi: admissionRoleRegistryAbi,
      address: registryAddress,
      functionName: "isStudent",
      args: [walletAddress]
    }) as Promise<boolean>,
    publicClient.readContract({
      abi: admissionRoleRegistryAbi,
      address: registryAddress,
      functionName: "getUniversityKeyByAdmin",
      args: [walletAddress]
    }) as Promise<`0x${string}`>
  ]);

  let role: AppRole = "none";
  if (isAuthority) {
    role = "authority";
  } else if (isStudent) {
    role = "student";
  } else if (universityKey !== ZERO_BYTES32) {
    role = "university";
  }

  // 大学身份除了原始 universityKey，还会附带一个前端友好的 family 值，
  // 这样大学工作台可以直接定位到“北京大学”或“家里蹲大学”页面范围。
  return {
    walletAddress,
    isWhitelisted: role !== "none",
    role,
    universityKey: universityKey === ZERO_BYTES32 ? null : universityKey,
    universityFamily: toSchoolFamilyKey(universityKey === ZERO_BYTES32 ? null : universityKey)
  };
}
