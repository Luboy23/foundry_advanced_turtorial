import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsEthereumAddress,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested
} from "class-validator";
import { ScoreSourcePublicationDto } from "../common/response.dto";

// 考试院 DTO。
// 这一组结构把“导入成绩文件”“生成批次”“工作台读模型”三种接口形状固定下来。
export class ScoreRecordInputDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  candidateLabel!: string;

  @ApiProperty()
  @IsString()
  candidateIdHash!: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  score!: number;

  @ApiProperty()
  @IsString()
  secretSalt!: string;

  @ApiProperty()
  @IsEthereumAddress()
  boundStudentAddress!: string;
}

export class ScoreSourceInfoDto {
  @ApiProperty()
  @IsString()
  scoreSourceIdLabel!: string;

  @ApiProperty()
  @IsString()
  sourceTitle!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(1000)
  maxScore!: number;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  merkleDepth?: number;
}

// 导入载荷是考试院成绩 JSON 的后端标准形状，前后端与演示数据模板都要遵守它。
export class AuthorityImportPayloadDto {
  @ApiProperty({ type: ScoreSourceInfoDto })
  @ValidateNested()
  @Type(() => ScoreSourceInfoDto)
  scoreSource!: ScoreSourceInfoDto;

  @ApiProperty({ type: [ScoreRecordInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScoreRecordInputDto)
  records!: ScoreRecordInputDto[];
}

export class CreateAuthorityDraftDto {
  @ApiProperty()
  @IsEthereumAddress()
  createdBy!: string;

  @ApiProperty({ type: AuthorityImportPayloadDto })
  @ValidateNested()
  @Type(() => AuthorityImportPayloadDto)
  payload!: AuthorityImportPayloadDto;
}

export class IssuanceRecordInputDto {
  @ApiProperty()
  @IsString()
  candidateLabel!: string;

  @ApiProperty()
  @IsEthereumAddress()
  boundStudentAddress!: string;

  @ApiProperty()
  @IsInt()
  score!: number;
}

export class GenerateAuthorityDraftBatchDto {
  @ApiProperty()
  @IsEthereumAddress()
  createdBy!: string;

  @ApiProperty({ required: false, default: "preview" })
  @IsOptional()
  @IsString()
  mode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiProperty({ type: [IssuanceRecordInputDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IssuanceRecordInputDto)
  records?: IssuanceRecordInputDto[];
}

// 草稿 DTO 表示“已经被后端接受并存储”的成绩草稿，而不是链上已发布的成绩源。
export class AuthorityDraftDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  scoreSourceIdLabel!: string;

  @ApiProperty()
  sourceTitle!: string;

  @ApiProperty()
  maxScore!: number;

  @ApiProperty({ type: AuthorityImportPayloadDto })
  payloadJson!: AuthorityImportPayloadDto;

  @ApiProperty()
  createdBy!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class AuthorityIssuanceRecordDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  batchId!: string;

  @ApiProperty()
  scoreSourceIdLabel!: string;

  @ApiProperty()
  candidateLabel!: string;

  @ApiProperty()
  boundStudentAddress!: string;

  @ApiProperty()
  score!: number;

  @ApiProperty()
  fileName!: string;

  @ApiProperty()
  createdAt!: string;
}

// 批次 DTO 汇总一次凭证生成的结果，便于考试院工作台恢复导出记录和文件路径。
export class AuthorityIssuanceBatchDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  draftId!: string;

  @ApiProperty()
  scoreSourceIdLabel!: string;

  @ApiProperty()
  filePath!: string;

  @ApiProperty()
  credentialCount!: number;

  @ApiProperty()
  createdBy!: string;

  @ApiProperty()
  mode!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty({ type: [AuthorityIssuanceRecordDto] })
  issuanceRecords!: AuthorityIssuanceRecordDto[];
}

export class AuthorityPublishHistoryItemDto extends ScoreSourcePublicationDto {}

// 生成后的成绩源摘要是发布到链上的直接输入，因此字段顺序和命名要与前端、脚本保持一致。
export class GeneratedScoreSourceDto {
  @ApiProperty()
  scoreSourceIdLabel!: string;

  @ApiProperty()
  scoreSourceIdBytes32!: string;

  @ApiProperty()
  scoreSourceIdField!: string;

  @ApiProperty()
  sourceTitle!: string;

  @ApiProperty()
  maxScore!: number;

  @ApiProperty()
  merkleDepth!: number;

  @ApiProperty()
  merkleRoot!: string;

  @ApiProperty()
  merkleRootHex!: string;
}

export class GeneratedCredentialDto {
  @ApiProperty()
  version!: number;

  @ApiProperty()
  scoreSourceId!: string;

  @ApiProperty()
  scoreSourceIdBytes32!: string;

  @ApiProperty()
  scoreSourceTitle!: string;

  @ApiProperty()
  boundStudentAddress!: string;

  @ApiProperty()
  boundStudentField!: string;

  @ApiProperty()
  candidateLabel!: string;

  @ApiProperty()
  candidateIdHash!: string;

  @ApiProperty()
  score!: number;

  @ApiProperty()
  maxScore!: number;

  @ApiProperty()
  secretSalt!: string;

  @ApiProperty()
  leaf!: string;

  @ApiProperty()
  merkleRoot!: string;

  @ApiProperty({ type: [String] })
  pathElements!: string[];

  @ApiProperty({ type: [Number] })
  pathIndices!: number[];

  @ApiProperty()
  issuedAt!: number;
}

export class AuthorityDraftGenerationDto {
  @ApiProperty()
  draftId!: string;

  @ApiProperty()
  mode!: string;

  @ApiProperty({ type: GeneratedScoreSourceDto })
  scoreSource!: GeneratedScoreSourceDto;

  @ApiProperty({ type: [GeneratedCredentialDto] })
  credentials!: GeneratedCredentialDto[];

  @ApiProperty({ type: AuthorityIssuanceBatchDto, nullable: true, required: false })
  batch!: AuthorityIssuanceBatchDto | null;
}

export class WorkbenchSyncStatusDto {
  @ApiProperty()
  stale!: boolean;

  @ApiProperty({ type: [String] })
  partialErrors!: string[];
}

export class AuthorityWorkbenchDto {
  @ApiProperty({ type: AuthorityDraftDto, nullable: true, required: false })
  currentDraft!: AuthorityDraftDto | null;

  @ApiProperty({ type: [AuthorityPublishHistoryItemDto] })
  publishHistory!: AuthorityPublishHistoryItemDto[];

  @ApiProperty({ type: [AuthorityIssuanceRecordDto] })
  issuanceRecords!: AuthorityIssuanceRecordDto[];

  @ApiProperty({ type: ScoreSourcePublicationDto, nullable: true, required: false })
  latestActiveSource!: ScoreSourcePublicationDto | null;

  @ApiProperty({ type: ScoreSourcePublicationDto, nullable: true, required: false })
  latestSource!: ScoreSourcePublicationDto | null;

  @ApiProperty({ type: WorkbenchSyncStatusDto })
  syncStatus!: WorkbenchSyncStatusDto;
}
