import { parseAbiItem } from "viem";
import type { ReadClient } from "@/lib/blockchain/read-client";
import type { Address } from "@/types/contract-config";
import type { SchoolConfig } from "@/types/admission";
import universityAdmissionVerifierAbiJson from "@/abi/UniversityAdmissionVerifier.json";

export const universityAdmissionVerifierAbi = universityAdmissionVerifierAbiJson;

// 前端通过这些事件回溯学校规则、学生申请和大学审批状态。
export const schoolCreatedEvent = parseAbiItem(
  "event SchoolCreated(bytes32 indexed schoolId, bytes32 indexed universityKey, string schoolName, bytes32 scoreSourceId, uint32 cutoffScore, address indexed admin)"
);

export const schoolConfigUpdatedEvent = parseAbiItem(
  "event SchoolConfigUpdated(bytes32 indexed schoolId, uint32 cutoffScore, bool active)"
);

export const applicationSubmittedEvent = parseAbiItem(
  "event ApplicationSubmitted(bytes32 indexed schoolId, address indexed applicant, uint256 nullifierHash)"
);

export const applicationApprovedEvent = parseAbiItem(
  "event ApplicationApproved(bytes32 indexed schoolId, address indexed applicant, uint64 approvedAt)"
);

export const applicationRejectedEvent = parseAbiItem(
  "event ApplicationRejected(bytes32 indexed schoolId, address indexed applicant, uint64 rejectedAt)"
);

export type ContractApplicationRecord = {
  schoolId: `0x${string}`;
  applicant: Address;
  nullifierHash: bigint;
  submittedAt: number;
  decidedAt: number;
  status: number;
};

export type ContractAdmissionRecord = {
  schoolId: `0x${string}`;
  admittedAt: number;
  admitted: boolean;
};

type SchoolTupleResult = readonly [
  `0x${string}`,
  `0x${string}`,
  string,
  `0x${string}`,
  bigint,
  bigint,
  Address,
  boolean,
  boolean
];

type SchoolObjectResult = {
  schoolId: `0x${string}`;
  universityKey: `0x${string}`;
  schoolName: string;
  scoreSourceId: `0x${string}`;
  cutoffScore: bigint;
  updatedAt: bigint;
  admin: Address;
  active: boolean;
  cutoffFrozen: boolean;
};

type ApplicationTupleResult = readonly [
  `0x${string}`,
  Address,
  bigint,
  bigint,
  bigint,
  number | bigint
];

type ApplicationObjectResult = {
  schoolId: `0x${string}`;
  applicant: Address;
  nullifierHash: bigint;
  submittedAt: bigint;
  decidedAt: bigint;
  status: number | bigint;
};

type StudentApplicationTupleResult = readonly [ApplicationTupleResult | ApplicationObjectResult, boolean];

type StudentApplicationObjectResult = {
  application: ApplicationTupleResult | ApplicationObjectResult;
  exists: boolean;
};

type AdmissionTupleResult = readonly [`0x${string}`, bigint, boolean];

type AdmissionObjectResult = {
  schoolId: `0x${string}`;
  admittedAt: bigint;
  admitted: boolean;
};

function isSchoolTupleResult(value: unknown): value is SchoolTupleResult {
  return Array.isArray(value) && value.length === 9;
}

function isApplicationTupleResult(value: unknown): value is ApplicationTupleResult {
  return Array.isArray(value) && value.length === 6;
}

function isStudentApplicationTupleResult(value: unknown): value is StudentApplicationTupleResult {
  return Array.isArray(value) && value.length === 2 && typeof value[1] === "boolean";
}

function isAdmissionTupleResult(value: unknown): value is AdmissionTupleResult {
  return Array.isArray(value) && value.length === 3;
}

function toNumber(value: bigint | number): number {
  return typeof value === "bigint" ? Number(value) : value;
}

export async function getSchoolConfig(
  publicClient: ReadClient,
  verifierAddress: Address,
  schoolId: `0x${string}`
): Promise<SchoolConfig> {
  const result = await publicClient.readContract({
    abi: universityAdmissionVerifierAbi,
    address: verifierAddress,
    functionName: "getSchool",
    args: [schoolId]
  });

  if (isSchoolTupleResult(result)) {
    return {
      schoolId: result[0],
      universityKey: result[1],
      schoolName: result[2],
      scoreSourceId: result[3],
      cutoffScore: toNumber(result[4]),
      updatedAt: toNumber(result[5]),
      admin: result[6],
      active: result[7],
      cutoffFrozen: result[8]
    };
  }

  const school = result as SchoolObjectResult;
  return {
    schoolId: school.schoolId,
    universityKey: school.universityKey,
    schoolName: school.schoolName,
    scoreSourceId: school.scoreSourceId,
    cutoffScore: toNumber(school.cutoffScore),
    updatedAt: toNumber(school.updatedAt),
    admin: school.admin,
    active: school.active,
    cutoffFrozen: school.cutoffFrozen
  };
}

export async function getApplicationRecord(
  publicClient: ReadClient,
  verifierAddress: Address,
  schoolId: `0x${string}`,
  applicant: Address
): Promise<ContractApplicationRecord> {
  const result = await publicClient.readContract({
    abi: universityAdmissionVerifierAbi,
    address: verifierAddress,
    functionName: "getApplication",
    args: [schoolId, applicant]
  });

  if (isApplicationTupleResult(result)) {
    return {
      schoolId: result[0],
      applicant: result[1],
      nullifierHash: result[2],
      submittedAt: toNumber(result[3]),
      decidedAt: toNumber(result[4]),
      status: toNumber(result[5])
    };
  }

  const application = result as ApplicationObjectResult;
  return {
    schoolId: application.schoolId,
    applicant: application.applicant,
    nullifierHash: application.nullifierHash,
    submittedAt: toNumber(application.submittedAt),
    decidedAt: toNumber(application.decidedAt),
    status: toNumber(application.status)
  };
}

function toApplicationRecord(result: ApplicationTupleResult | ApplicationObjectResult): ContractApplicationRecord {
  if (isApplicationTupleResult(result)) {
    return {
      schoolId: result[0],
      applicant: result[1],
      nullifierHash: result[2],
      submittedAt: toNumber(result[3]),
      decidedAt: toNumber(result[4]),
      status: toNumber(result[5])
    };
  }

  return {
    schoolId: result.schoolId,
    applicant: result.applicant,
    nullifierHash: result.nullifierHash,
    submittedAt: toNumber(result.submittedAt),
    decidedAt: toNumber(result.decidedAt),
    status: toNumber(result.status)
  };
}

export async function getStudentApplicationRecord(
  publicClient: ReadClient,
  verifierAddress: Address,
  student: Address
): Promise<{ application: ContractApplicationRecord | null; exists: boolean }> {
  const result = await publicClient.readContract({
    abi: universityAdmissionVerifierAbi,
    address: verifierAddress,
    functionName: "getStudentApplication",
    args: [student]
  });

  if (isStudentApplicationTupleResult(result)) {
    return {
      application: result[1] ? toApplicationRecord(result[0]) : null,
      exists: result[1]
    };
  }

  const studentApplication = result as StudentApplicationObjectResult;
  return {
    application: studentApplication.exists ? toApplicationRecord(studentApplication.application) : null,
    exists: studentApplication.exists
  };
}

export async function getSchoolApplicants(
  publicClient: ReadClient,
  verifierAddress: Address,
  schoolId: `0x${string}`
): Promise<Address[]> {
  const result = await publicClient.readContract({
    abi: universityAdmissionVerifierAbi,
    address: verifierAddress,
    functionName: "getSchoolApplicants",
    args: [schoolId]
  });

  return [...(result as Address[])];
}

export async function getAdmissionRecord(
  publicClient: ReadClient,
  verifierAddress: Address,
  student: Address
): Promise<ContractAdmissionRecord> {
  const result = await publicClient.readContract({
    abi: universityAdmissionVerifierAbi,
    address: verifierAddress,
    functionName: "getAdmission",
    args: [student]
  });

  if (isAdmissionTupleResult(result)) {
    return {
      schoolId: result[0],
      admittedAt: toNumber(result[1]),
      admitted: result[2]
    };
  }

  const admission = result as AdmissionObjectResult;
  return {
    schoolId: admission.schoolId,
    admittedAt: toNumber(admission.admittedAt),
    admitted: admission.admitted
  };
}
