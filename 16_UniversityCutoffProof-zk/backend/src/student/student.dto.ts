import { ApiProperty } from "@nestjs/swagger";
import { IsEthereumAddress, IsOptional, IsString } from "class-validator";
import {
  ScoreSourcePublicationDto,
  StudentApplicationDto,
  StudentAuxiliaryRecordDto,
  StudentCurrentApplicationDto as StudentCurrentApplicationBaseDto,
  UniversityRuleVersionDto,
  StudentEligibilityDto as StudentEligibilityResponseDto
} from "../common/response.dto";
import { WorkbenchSyncStatusDto } from "../authority/authority.dto";

// 学生侧 DTO。
// 学生工作台既要展示链上真实申请，也要展示未上链辅助记录，因此需要把两类数据明确分区。
export class CreateStudentAuxiliaryRecordDto {
  @ApiProperty()
  @IsString()
  schoolId!: string;

  @ApiProperty()
  @IsString()
  schoolName!: string;

  @ApiProperty()
  @IsString()
  status!: string;

  @ApiProperty()
  @IsString()
  message!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  versionId?: string;
}

export class StudentWorkbenchDto {
  @ApiProperty()
  walletAddress!: string;

  @ApiProperty({ type: ScoreSourcePublicationDto, nullable: true, required: false })
  latestActiveSource!: ScoreSourcePublicationDto | null;

  @ApiProperty({ type: [StudentApplicationDto] })
  applications!: StudentApplicationDto[];

  @ApiProperty({ type: StudentApplicationDto, nullable: true, required: false })
  currentApplication!: StudentApplicationDto | null;

  @ApiProperty({ type: [UniversityRuleVersionDto] })
  rules!: UniversityRuleVersionDto[];

  @ApiProperty({ type: [StudentAuxiliaryRecordDto] })
  auxiliaryRecords!: StudentAuxiliaryRecordDto[];

  @ApiProperty()
  note!: string;

  @ApiProperty({ type: WorkbenchSyncStatusDto })
  syncStatus!: WorkbenchSyncStatusDto;
}

export class StudentEligibilityDto extends StudentEligibilityResponseDto {}

export class StudentCurrentApplicationDto extends StudentCurrentApplicationBaseDto {}
