import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { BACKEND_SESSION_ROLES_KEY, type BackendSessionRole } from "./roles.decorator";

@Injectable()
// 角色守卫。
// 会话守卫只负责“是不是已登录”，这一层再负责“已登录的钱包有没有访问这类后台接口的权限”。
export class RoleGuard implements CanActivate {
  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector
  ) {}

  canActivate(context: ExecutionContext) {
    const requiredRoles = this.reflector.getAllAndOverride<BackendSessionRole[]>(
      BACKEND_SESSION_ROLES_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      backendSession?: { role: BackendSessionRole };
    }>();
    const currentRole = request.backendSession?.role;

    // 没有角色或角色不在声明列表中时，直接拒绝访问，避免前端绕过页面入口直接调后台接口。
    if (!currentRole || !requiredRoles.includes(currentRole)) {
      throw new ForbiddenException("当前钱包会话没有访问该接口的权限。");
    }

    return true;
  }
}
