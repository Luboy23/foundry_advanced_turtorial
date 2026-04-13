import { apiFetch } from "@/lib/api/client";
import type {
  StudentApplicationDto,
  StudentCurrentApplicationDto,
  StudentEligibilityDto,
  StudentWorkbenchDto
} from "@/types/backend";

export function getStudentApplications(walletAddress: string) {
  return apiFetch<StudentApplicationDto[]>(
    `/api/students/${walletAddress}/applications`
  );
}

export function getStudentEligibility(walletAddress: string) {
  return apiFetch<StudentEligibilityDto>(
    `/api/students/${walletAddress}/eligibility`
  );
}

export function getStudentCurrentApplication(walletAddress: string) {
  return apiFetch<StudentCurrentApplicationDto>(
    `/api/students/${walletAddress}/current-application`
  );
}

export function getStudentWorkbench(walletAddress: string) {
  return apiFetch<StudentWorkbenchDto>(`/api/students/${walletAddress}/workbench`);
}

export function createStudentAuxiliaryRecord(
  walletAddress: string,
  payload: {
    schoolId: string;
    schoolName: string;
    status: string;
    message: string;
    versionId?: string;
  }
) {
  return apiFetch(`/api/students/${walletAddress}/auxiliary-records`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
