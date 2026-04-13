import { Controller, Get, Inject } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../prisma/prisma.service";
import { HealthStatusDto } from "./response.dto";

@ApiTags("system")
@Controller("api")
export class SystemController {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  @Get("health")
  @ApiOkResponse({ description: "后端健康检查", type: HealthStatusDto })
  async getHealth() {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      ok: true,
      service: "nestjs-backend",
      timestamp: new Date().toISOString()
    };
  }
}
