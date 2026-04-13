import { apiFetch } from "@/lib/api/client";
import type {
  UniversityApplicationDto,
  UniversityRuleVersionDto,
  UniversitySummaryDto,
  UniversityWorkbenchDto
} from "@/types/backend";

export function getUniversityRuleVersions(familyKey: string) {
  return apiFetch<UniversityRuleVersionDto[]>(
    `/api/universities/${familyKey}/rules`
  );
}

export function getUniversityApplications(familyKey: string) {
  return apiFetch<UniversityApplicationDto[]>(
    `/api/universities/${familyKey}/applications`
  );
}

export function getUniversitySummary(familyKey: string) {
  return apiFetch<UniversitySummaryDto>(
    `/api/universities/${familyKey}/summary`
  );
}

export function getUniversityWorkbench(familyKey: string) {
  return apiFetch<UniversityWorkbenchDto>(
    `/api/universities/${familyKey}/workbench`
  );
}
