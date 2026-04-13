import type { components } from "@/types/generated/backend-api";

type Schema<Name extends keyof components["schemas"]> = components["schemas"][Name];
type MaybeScalar<T> = Exclude<T, Record<string, never>>;

// 保留生成文件导出，便于页面和 API 层逐步直接引用 OpenAPI 产物。
export * from "@/types/generated/backend-api";

export type BackendRole = "authority" | "student" | "university" | "unknown";

export type AuthChallengeDto = Schema<"AuthChallengeDto">;

export type WalletSessionDto = Omit<Schema<"WalletSessionDto">, "role"> & {
  role: BackendRole;
};

export type BackendSessionStatusDto = Omit<Schema<"BackendSessionStatusDto">, "role"> & {
  role: BackendRole;
};

export type AuthorityDraftDto = Schema<"AuthorityDraftDto">;

export type AuthorityIssuanceRecordDto = Schema<"AuthorityIssuanceRecordDto">;

export type AuthorityIssuanceBatchDto = Schema<"AuthorityIssuanceBatchDto">;

export type GeneratedScoreSourceDto = Schema<"GeneratedScoreSourceDto">;

export type GeneratedCredentialDto = Schema<"GeneratedCredentialDto">;

export type AuthorityDraftGenerationDto = Schema<"AuthorityDraftGenerationDto">;

export type ScoreSourcePublicationDto = Omit<
  Schema<"ScoreSourcePublicationDto">,
  "txHash" | "blockNumber"
> & {
  txHash?: MaybeScalar<Schema<"ScoreSourcePublicationDto">["txHash"]> | null;
  blockNumber?: MaybeScalar<Schema<"ScoreSourcePublicationDto">["blockNumber"]> | null;
};

export type AuthorityPublishHistoryItemDto = Omit<
  Schema<"AuthorityPublishHistoryItemDto">,
  "txHash" | "blockNumber"
> & {
  txHash?: MaybeScalar<Schema<"AuthorityPublishHistoryItemDto">["txHash"]> | null;
  blockNumber?: MaybeScalar<Schema<"AuthorityPublishHistoryItemDto">["blockNumber"]> | null;
};

export type WorkbenchSyncStatusDto = Schema<"WorkbenchSyncStatusDto">;

export type AuthorityWorkbenchDto = Schema<"AuthorityWorkbenchDto">;

export type UniversityRuleVersionDto = Omit<Schema<"UniversityRuleVersionDto">, "txHash"> & {
  txHash?: MaybeScalar<Schema<"UniversityRuleVersionDto">["txHash"]> | null;
};

export type StudentApplicationDto = Omit<
  Schema<"StudentApplicationDto">,
  "decidedAt" | "submittedTxHash" | "decisionTxHash"
> & {
  decidedAt?: MaybeScalar<Schema<"StudentApplicationDto">["decidedAt"]> | null;
  submittedTxHash?: MaybeScalar<Schema<"StudentApplicationDto">["submittedTxHash"]> | null;
  decisionTxHash?: MaybeScalar<Schema<"StudentApplicationDto">["decisionTxHash"]> | null;
};

export type UniversityApplicationDto = StudentApplicationDto;

export type UniversitySummaryDto = Omit<
  Schema<"UniversitySummaryDto">,
  "latestScoreSourceIdLabel"
> & {
  latestScoreSourceIdLabel?: MaybeScalar<Schema<"UniversitySummaryDto">["latestScoreSourceIdLabel"]> | null;
};

export type UniversityWorkbenchDto = Omit<
  Schema<"UniversityWorkbenchDto">,
  "createDraftGuardReason" | "summary" | "rules" | "applications"
> & {
  createDraftGuardReason?: MaybeScalar<Schema<"UniversityWorkbenchDto">["createDraftGuardReason"]> | null;
  summary: UniversitySummaryDto;
  rules: UniversityRuleVersionDto[];
  applications: UniversityApplicationDto[];
};

export type StudentCurrentApplicationDto = Schema<"StudentCurrentApplicationDto">;

export type StudentAuxiliaryRecordDto = Omit<Schema<"StudentAuxiliaryRecordDto">, "versionId"> & {
  versionId?: MaybeScalar<Schema<"StudentAuxiliaryRecordDto">["versionId"]> | null;
};

export type StudentEligibilityDto = Schema<"StudentEligibilityDto">;

export type StudentWorkbenchDto = Omit<
  Schema<"StudentWorkbenchDto">,
  "applications" | "currentApplication" | "rules" | "auxiliaryRecords"
> & {
  applications: StudentApplicationDto[];
  currentApplication?: StudentApplicationDto | null;
  rules: UniversityRuleVersionDto[];
  auxiliaryRecords: StudentAuxiliaryRecordDto[];
};
