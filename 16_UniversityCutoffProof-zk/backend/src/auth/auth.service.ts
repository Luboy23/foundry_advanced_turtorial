import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { isAddressEqual, recoverMessageAddress } from "viem";
import { PrismaService } from "../prisma/prisma.service";
import { ChainService } from "../chain/chain.service";
import { loadAppConfig } from "../config/app-config";

// 后台签名登录的唯一入口。
// 这一层只负责 challenge、签名校验、session 生命周期，不负责页面角色跳转或钱包连接本身。
@Injectable()
export class AuthService {
  private readonly appConfig = loadAppConfig();

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(ChainService)
    private readonly chainService: ChainService
  ) {}

  // 为当前钱包生成一次性 challenge。
  // challenge 里固定带上域、链 ID、nonce 和过期时间，防止不同环境之间互相复用登录材料。
  async createChallenge(walletAddress: string) {
    const normalizedWallet = walletAddress.toLowerCase();
    const nonce = randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const challenge = [
      "UniversityCutoffProof 登录确认",
      `domain: university-cutoff-proof-zk`,
      `wallet: ${normalizedWallet}`,
      `chainId: ${this.appConfig.chainId}`,
      `nonce: ${nonce}`,
      `expiresAt: ${expiresAt.toISOString()}`
    ].join("\n");

    await this.prisma.walletChallenge.upsert({
      where: { walletAddress: normalizedWallet },
      create: {
        walletAddress: normalizedWallet,
        challenge,
        expiresAt
      },
      update: {
        challenge,
        expiresAt
      }
    });

    return {
      walletAddress: normalizedWallet,
      challenge,
      expiresAt: expiresAt.toISOString(),
      nonce
    };
  }

  // 校验 challenge 与签名，并在通过后建立后端 session。
  // 当前项目的角色真相仍然来自链上角色注册表，因此这里会在签名通过后再去链上读取角色。
  async verifyWallet(walletAddress: string, challenge: string, signature: string) {
    const normalizedWallet = walletAddress.toLowerCase();
    const existing = await this.prisma.walletChallenge.findUnique({
      where: { walletAddress: normalizedWallet }
    });

    if (!existing || existing.challenge !== challenge || existing.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException("钱包挑战已过期，请重新发起登录。");
    }

    if (!this.appConfig.authDevSignatureBypass) {
      if (!signature) {
        throw new UnauthorizedException("当前签名无效。");
      }
      let recovered: `0x${string}`;
      try {
        recovered = await recoverMessageAddress({
          message: challenge,
          signature: signature as `0x${string}`
        });
      } catch {
        throw new UnauthorizedException("当前签名格式不正确。");
      }
      if (!isAddressEqual(recovered, normalizedWallet as `0x${string}`)) {
        throw new UnauthorizedException("当前签名与钱包地址不匹配。");
      }
    }

    const roleIdentity = await this.chainService.getRole(normalizedWallet as `0x${string}`);
    const sessionId = randomUUID();
    const nonce = randomUUID();
    const expiresAt = new Date(Date.now() + this.appConfig.sessionTtlMinutes * 60 * 1000);

    await this.prisma.walletSession.create({
      data: {
        sessionId,
        walletAddress: normalizedWallet,
        role: roleIdentity.role,
        nonce,
        expiresAt
      }
    });

    await this.prisma.walletChallenge.delete({
      where: { walletAddress: normalizedWallet }
    });

    return {
      sessionId,
      walletAddress: normalizedWallet,
      role: roleIdentity.role,
      expiresAt: expiresAt.toISOString(),
      devSignatureBypass: this.appConfig.authDevSignatureBypass
    };
  }

  // 读取已有 session，并顺手清理过期会话。
  // 页面进入工作台时依赖这个接口判断“是否已经登录后台”，而不是直接假设钱包已连接就有后台权限。
  async getSession(sessionId?: string) {
    if (!sessionId) {
      return null;
    }

    const existing = await this.prisma.walletSession.findUnique({
      where: { sessionId }
    });
    if (!existing) {
      return null;
    }

    if (existing.expiresAt.getTime() < Date.now()) {
      await this.prisma.walletSession.deleteMany({
        where: { sessionId }
      });
      return null;
    }

    return {
      sessionId: existing.sessionId,
      walletAddress: existing.walletAddress,
      role: existing.role,
      expiresAt: existing.expiresAt.toISOString(),
      devSignatureBypass: this.appConfig.authDevSignatureBypass
    };
  }

  // 主动退出后台会话。
  // 这里不报错而是静默删除，目的是让前端“断开后台会话”操作具备幂等性。
  async logout(sessionId?: string) {
    if (!sessionId) {
      return;
    }

    await this.prisma.walletSession.deleteMany({
      where: { sessionId }
    });
  }
}
