import { apiFetch } from "@/lib/api/client";
import type {
  AuthorityDraftDto,
  AuthorityDraftGenerationDto,
  AuthorityIssuanceRecordDto,
  AuthorityPublishHistoryItemDto,
  AuthorityWorkbenchDto
} from "@/types/backend";
import type { AuthorityImportPayload } from "@/types/admission";

export function createAuthorityDraft(args: {
  createdBy: string;
  payload: AuthorityImportPayload;
}) {
  return apiFetch<AuthorityDraftDto>("/api/authority/drafts", {
    method: "POST",
    body: JSON.stringify(args)
  });
}

export function getAuthorityWorkbench() {
  return apiFetch<AuthorityWorkbenchDto>("/api/authority/workbench");
}

export function getCurrentAuthorityDraft() {
  return apiFetch<AuthorityDraftDto | null>("/api/authority/drafts/current");
}

export function getAuthorityDraftPreview(draftId: string) {
  return apiFetch<AuthorityDraftGenerationDto>(`/api/authority/drafts/${draftId}/preview`);
}

export function generateAuthorityDraftBatch(args: {
  draftId: string;
  createdBy: string;
  mode?: string;
  fileName?: string;
  records?: Array<{
    candidateLabel: string;
    boundStudentAddress: string;
    score: number;
  }>;
}) {
  return apiFetch<AuthorityDraftGenerationDto>(
    `/api/authority/drafts/${args.draftId}/generate`,
    {
      method: "POST",
      body: JSON.stringify({
        createdBy: args.createdBy,
        mode: args.mode,
        fileName: args.fileName,
        records: args.records
      })
    }
  );
}

export function getAuthorityIssuanceRecords() {
  return apiFetch<AuthorityIssuanceRecordDto[]>(
    "/api/authority/issuance-records"
  );
}

export function getAuthorityPublishHistory() {
  return apiFetch<AuthorityPublishHistoryItemDto[]>(
    "/api/authority/publish-history"
  );
}
