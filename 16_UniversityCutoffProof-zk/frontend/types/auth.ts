import type { Address } from "@/types/contract-config";
import type { SchoolFamilyKey } from "@/types/admission";

// 当前前端识别到的四种角色状态。
export type AppRole = "authority" | "student" | "university" | "none";

// 角色识别结果会同时给出原始钱包地址、角色类型和大学归属范围。
export type RoleIdentity = {
  walletAddress: Address | undefined;
  isWhitelisted: boolean;
  role: AppRole;
  universityKey: `0x${string}` | null;
  universityFamily: SchoolFamilyKey | null;
};
