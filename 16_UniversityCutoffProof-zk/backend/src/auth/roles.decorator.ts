import { SetMetadata } from "@nestjs/common";

// 角色装饰器。
// 控制器只声明“哪些角色能访问”，真正的判定由 RoleGuard 在运行时完成。
export const BACKEND_SESSION_ROLES_KEY = "backendSessionRoles";

export type BackendSessionRole = "authority" | "student" | "university" | "unknown";

export const RequireRoles = (...roles: BackendSessionRole[]) =>
  SetMetadata(BACKEND_SESSION_ROLES_KEY, roles);
