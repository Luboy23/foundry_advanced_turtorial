import { Body, Controller, Get, Inject, Post, Req, Res } from "@nestjs/common";
import { ApiExtraModels, ApiOkResponse, ApiTags, getSchemaPath } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import {
  AuthChallengeDto,
  BackendSessionStatusDto,
  CreateChallengeDto,
  LogoutDto,
  VerifyWalletDto,
  WalletSessionDto
} from "./auth.dto";

@ApiTags("auth")
@ApiExtraModels(BackendSessionStatusDto)
@Controller("api/auth")
// 钱包后台会话控制器。
// 这里不处理角色判断，只负责 challenge、签名校验和 cookie 会话读写。
export class AuthController {
  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService
  ) {}

  @Post("challenge")
  @ApiOkResponse({ description: "创建钱包登录挑战", type: AuthChallengeDto })
  async createChallenge(@Body() dto: CreateChallengeDto) {
    return this.authService.createChallenge(dto.walletAddress);
  }

  @Post("verify")
  @ApiOkResponse({ description: "校验签名并建立会话", type: WalletSessionDto })
  async verify(@Body() dto: VerifyWalletDto, @Res({ passthrough: true }) response: Response) {
    const session = await this.authService.verifyWallet(
      dto.walletAddress,
      dto.challenge,
      dto.signature
    );
    response.cookie("ucp_session", session.sessionId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/"
    });
    return session;
  }

  @Get("session")
  @ApiOkResponse({
    description: "读取当前后台钱包会话",
    schema: {
      nullable: true,
      allOf: [{ $ref: getSchemaPath(BackendSessionStatusDto) }]
    }
  })
  async getSession(@Req() request: Request, @Res() response: Response) {
    const sessionId = String(request.cookies?.ucp_session || "");
    // 前端会频繁轮询当前会话；这里统一返回 null，而不是空响应，避免前端再自行猜测未登录语义。
    const session = await this.authService.getSession(sessionId || undefined);
    response.json(session ?? null);
  }

  @Post("logout")
  @ApiOkResponse({ description: "退出当前钱包会话", type: LogoutDto })
  async logout(@Res({ passthrough: true }) response: Response) {
    const sessionId = String(response.req?.cookies?.ucp_session || "");
    await this.authService.logout(sessionId || undefined);
    response.clearCookie("ucp_session", { path: "/" });
    return { ok: true };
  }
}
