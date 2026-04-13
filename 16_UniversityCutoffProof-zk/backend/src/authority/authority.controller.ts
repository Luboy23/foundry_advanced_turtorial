import { Body, Controller, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { AuthorityService } from "./authority.service";
import {
  AuthorityDraftDto,
  AuthorityDraftGenerationDto,
  AuthorityIssuanceBatchDto,
  AuthorityIssuanceRecordDto,
  AuthorityPublishHistoryItemDto,
  AuthorityWorkbenchDto,
  CreateAuthorityDraftDto,
  GenerateAuthorityDraftBatchDto
} from "./authority.dto";
import { RoleGuard } from "../auth/role.guard";
import { RequireRoles } from "../auth/roles.decorator";
import { SessionGuard } from "../auth/session.guard";

// 考试院控制器只暴露两类能力：
// 1. workbench 和预览这类公开读取；
// 2. 导入草稿、生成批次这类需要后台会话保护的写操作。
@ApiTags("authority")
@Controller("api/authority")
export class AuthorityController {
  constructor(
    @Inject(AuthorityService)
    private readonly authorityService: AuthorityService
  ) {}

  // 考试院页的唯一主读接口。
  @Get("workbench")
  @ApiOkResponse({ description: "考试院工作台聚合数据", type: AuthorityWorkbenchDto })
  async getWorkbench() {
    return this.authorityService.getWorkbench();
  }

  // 导入成绩草稿会写后台记录，因此要求 authority session。
  @Post("drafts")
  @UseGuards(SessionGuard, RoleGuard)
  @RequireRoles("authority")
  @ApiOkResponse({ description: "创建考试院成绩草稿", type: AuthorityDraftDto })
  async createDraft(@Body() dto: CreateAuthorityDraftDto) {
    return this.authorityService.createDraft(dto);
  }

  @Get("drafts/current")
  @ApiOkResponse({ description: "读取当前最新草稿", type: AuthorityDraftDto })
  async getCurrentDraft() {
    return this.authorityService.getCurrentDraft();
  }

  // 预览只读，不写批次记录，因此不要求后台签名。
  @Get("drafts/:draftId/preview")
  @ApiOkResponse({ description: "预览当前草稿的成绩源摘要与学生凭证", type: AuthorityDraftGenerationDto })
  async getDraftPreview(@Param("draftId") draftId: string) {
    return this.authorityService.generateDraftPreview(draftId);
  }

  // 正式生成 single / batch 批次时会写发放记录，因此继续走受保护接口。
  @Post("drafts/:draftId/generate")
  @UseGuards(SessionGuard, RoleGuard)
  @RequireRoles("authority")
  @ApiOkResponse({ description: "生成当前草稿的成绩源摘要与学生凭证批次", type: AuthorityDraftGenerationDto })
  async generateDraftBatch(
    @Param("draftId") draftId: string,
    @Body() dto: GenerateAuthorityDraftBatchDto
  ) {
    return this.authorityService.generateDraftBatch(draftId, dto);
  }

  @Get("issuance-records")
  @UseGuards(SessionGuard, RoleGuard)
  @RequireRoles("authority")
  @ApiOkResponse({ type: [AuthorityIssuanceRecordDto] })
  async getIssuanceRecords() {
    return this.authorityService.getIssuanceRecords();
  }

  // 链上发布历史是公开可读的，不依赖后台会话。
  @Get("publish-history")
  @ApiOkResponse({ type: [AuthorityPublishHistoryItemDto] })
  async getPublishHistory() {
    return this.authorityService.getPublishHistory();
  }
}
