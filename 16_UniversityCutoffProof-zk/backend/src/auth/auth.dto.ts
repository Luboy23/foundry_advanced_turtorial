import { ApiProperty } from "@nestjs/swagger";
import { IsEthereumAddress, IsString } from "class-validator";
import { SimpleOkDto } from "../common/response.dto";

// 后台钱包鉴权 DTO。
// 这些结构同时服务于 Swagger/OpenAPI 导出和运行时参数校验，因此字段命名必须稳定。
export class CreateChallengeDto {
  @ApiProperty()
  @IsEthereumAddress()
  walletAddress!: string;
}

export class VerifyWalletDto {
  @ApiProperty()
  @IsEthereumAddress()
  walletAddress!: string;

  @ApiProperty()
  @IsString()
  challenge!: string;

  @ApiProperty()
  @IsString()
  signature!: string;
}

// challenge 返回值既要给前端签名，也要把过期时间和 nonce 暴露出来用于调试和安全校验。
export class AuthChallengeDto {
  @ApiProperty()
  walletAddress!: string;

  @ApiProperty()
  challenge!: string;

  @ApiProperty()
  expiresAt!: string;

  @ApiProperty()
  nonce!: string;
}

// 后台会话 DTO 代表已经完成签名并落 cookie 的结果，不等同于链上角色本身。
export class WalletSessionDto {
  @ApiProperty()
  sessionId!: string;

  @ApiProperty()
  walletAddress!: string;

  @ApiProperty()
  role!: string;

  @ApiProperty()
  expiresAt!: string;

  @ApiProperty()
  devSignatureBypass!: boolean;
}

export class BackendSessionStatusDto extends WalletSessionDto {}

export class LogoutDto extends SimpleOkDto {}
