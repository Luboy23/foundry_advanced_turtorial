import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class SimpleOkDto {
  @ApiProperty()
  ok!: boolean;
}

export class HealthStatusDto extends SimpleOkDto {
  @ApiProperty()
  service!: string;

  @ApiProperty()
  timestamp!: string;
}

export class ScoreSourcePublicationDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  scoreSourceId!: string;

  @ApiProperty()
  scoreSourceIdLabel!: string;

  @ApiProperty()
  sourceTitle!: string;

  @ApiProperty()
  merkleRoot!: string;

  @ApiProperty()
  maxScore!: number;

  @ApiProperty()
  issuer!: string;

  @ApiProperty()
  issuedAt!: string;

  @ApiPropertyOptional({ nullable: true })
  txHash?: string | null;

  @ApiPropertyOptional({ nullable: true })
  blockNumber?: string | null;

  @ApiProperty()
  active!: boolean;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class UniversityRuleVersionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  schoolId!: string;

  @ApiProperty()
  schoolIdLabel!: string;

  @ApiProperty()
  familyKey!: string;

  @ApiProperty()
  schoolName!: string;

  @ApiProperty()
  versionId!: string;

  @ApiProperty()
  versionNumber!: number;

  @ApiProperty()
  universityKey!: string;

  @ApiProperty()
  scoreSourceId!: string;

  @ApiProperty()
  cutoffScore!: number;

  @ApiProperty()
  admin!: string;

  @ApiProperty()
  active!: boolean;

  @ApiProperty()
  cutoffFrozen!: boolean;

  @ApiProperty()
  updatedAt!: string;

  @ApiPropertyOptional({ nullable: true })
  txHash?: string | null;

  @ApiProperty()
  createdAt!: string;
}

export class StudentApplicationDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  schoolId!: string;

  @ApiProperty()
  schoolName!: string;

  @ApiProperty()
  familyKey!: string;

  @ApiProperty()
  applicant!: string;

  @ApiProperty()
  nullifierHash!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  submittedAt!: string;

  @ApiPropertyOptional({ nullable: true })
  decidedAt?: string | null;

  @ApiPropertyOptional({ nullable: true })
  submittedTxHash?: string | null;

  @ApiPropertyOptional({ nullable: true })
  decisionTxHash?: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class StudentCurrentApplicationDto {
  @ApiPropertyOptional({ type: StudentApplicationDto, nullable: true })
  application!: StudentApplicationDto | null;
}

export class StudentAuxiliaryRecordDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  walletAddress!: string;

  @ApiProperty()
  schoolId!: string;

  @ApiProperty()
  schoolName!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  message!: string;

  @ApiPropertyOptional({ nullable: true })
  versionId?: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  dedupeKey!: string;
}

export class StudentEligibilityDto {
  @ApiProperty()
  walletAddress!: string;

  @ApiProperty()
  hasActiveScoreSource!: boolean;

  @ApiProperty()
  hasOpenRules!: boolean;

  @ApiProperty({ type: [UniversityRuleVersionDto] })
  rules!: UniversityRuleVersionDto[];

  @ApiProperty()
  note!: string;
}

export class UniversitySummaryDto {
  @ApiProperty()
  familyKey!: string;

  @ApiProperty()
  ruleCount!: number;

  @ApiProperty()
  pendingApplicationCount!: number;

  @ApiProperty()
  approvedApplicationCount!: number;

  @ApiProperty()
  rejectedApplicationCount!: number;

  @ApiPropertyOptional({ nullable: true })
  latestScoreSourceIdLabel!: string | null;
}
