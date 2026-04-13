import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { AuthService } from "./auth.service";

@Injectable()
// 会话守卫。
// 受保护接口必须先从 cookie 中恢复后台会话，再把解析结果挂到 request 供后续控制器和角色守卫复用。
export class SessionGuard implements CanActivate {
  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      cookies?: Record<string, string | undefined>;
      backendSession?: Awaited<ReturnType<AuthService["getSession"]>>;
    }>();
    const sessionId = request.cookies?.ucp_session;
    const session = await this.authService.getSession(sessionId);

    if (!session) {
      throw new UnauthorizedException("请先完成钱包签名登录。");
    }

    // 后续控制器与 RoleGuard 都从 request.backendSession 读取当前会话，避免重复查库。
    request.backendSession = session;
    return true;
  }
}
