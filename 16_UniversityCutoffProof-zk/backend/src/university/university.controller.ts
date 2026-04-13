import { Controller, Get, Inject, Param } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { UniversityService } from "./university.service";
import { UniversityWorkbenchDto } from "./university.dto";
import { StudentApplicationDto, UniversityRuleVersionDto, UniversitySummaryDto } from "../common/response.dto";

// 大学控制器全部走公开读取。
// 真正的大学管理员写操作仍然由前端钱包直发链上交易，后端这里只负责投影和聚合。
@ApiTags("university")
@Controller("api/universities/:family")
export class UniversityController {
  constructor(
    @Inject(UniversityService)
    private readonly universityService: UniversityService
  ) {}

  // 大学工作台主读接口：规则、摘要、审批记录、当前成绩源都从这里拿。
  @Get("workbench")
  @ApiOkResponse({ description: "大学工作台聚合数据", type: UniversityWorkbenchDto })
  async getWorkbench(@Param("family") family: string) {
    return this.universityService.getWorkbench(family);
  }

  @Get("rules")
  @ApiOkResponse({ type: [UniversityRuleVersionDto] })
  async getRules(@Param("family") family: string) {
    return this.universityService.getRuleVersions(family);
  }

  @Get("applications")
  @ApiOkResponse({ type: [StudentApplicationDto] })
  async getApplications(@Param("family") family: string) {
    return this.universityService.getApplications(family);
  }

  @Get("summary")
  @ApiOkResponse({ type: UniversitySummaryDto })
  async getSummary(@Param("family") family: string) {
    return this.universityService.getSummary(family);
  }
}
