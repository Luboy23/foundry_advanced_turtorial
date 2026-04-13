import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { SessionGuard } from "./session.guard";
import { RoleGuard } from "./role.guard";

@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionGuard, RoleGuard],
  exports: [AuthService, SessionGuard, RoleGuard]
})
// 鉴权模块把 challenge、会话恢复和角色守卫统一打包导出，供考试院和大学后台接口复用。
export class AuthModule {}
