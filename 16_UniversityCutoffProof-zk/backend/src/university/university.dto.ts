import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ScoreSourcePublicationDto,
  StudentApplicationDto,
  UniversityRuleVersionDto,
  UniversitySummaryDto
} from "../common/response.dto";
import { WorkbenchSyncStatusDto } from "../authority/authority.dto";

// 大学工作台 DTO。
// 这里把“成绩源、规则、申请、摘要卡”合并成一次返回，避免前端再自己拼多个读链查询。
export class UniversityWorkbenchDto {
  @ApiProperty()
  familyKey!: string;

  @ApiProperty({ type: ScoreSourcePublicationDto, nullable: true, required: false })
  latestActiveSource!: ScoreSourcePublicationDto | null;

  @ApiProperty({ type: UniversitySummaryDto })
  summary!: UniversitySummaryDto;

  @ApiPropertyOptional({ type: UniversityRuleVersionDto, nullable: true })
  currentSourceRule!: UniversityRuleVersionDto | null;

  @ApiProperty()
  canCreateDraft!: boolean;

  @ApiPropertyOptional({ nullable: true })
  createDraftGuardReason!: string | null;

  @ApiProperty({ type: [UniversityRuleVersionDto] })
  rules!: UniversityRuleVersionDto[];

  @ApiProperty({ type: [StudentApplicationDto] })
  applications!: StudentApplicationDto[];

  @ApiProperty({ type: WorkbenchSyncStatusDto })
  syncStatus!: WorkbenchSyncStatusDto;
}
