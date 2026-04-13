"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  applicationApprovedEvent,
  applicationRejectedEvent,
  applicationSubmittedEvent,
  getApplicationRecord,
  getSchoolApplicants
} from "@/lib/contracts/university-admission-verifier";
import { useReadClient } from "@/hooks/useReadClient";
import type { ContractConfig } from "@/types/contract-config";
import type { SchoolRuleVersion } from "@/types/admission";
import type { UniversityApplicationRecord } from "@/types/history";

type EventMeta = {
  txHash?: `0x${string}`;
  blockNumber?: bigint;
};

function getRecordKey(schoolId: `0x${string}`, applicant: `0x${string}`) {
  return `${schoolId.toLowerCase()}:${applicant.toLowerCase()}`;
}

async function safeGetLogs<T>(fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn();
  } catch {
    return [];
  }
}

export function useUniversityApplications(args: {
  config: ContractConfig;
  versions: SchoolRuleVersion[];
  enabled?: boolean;
}) {
  const { config, versions, enabled = true } = args;
  const readClientState = useReadClient(config);
  const publicClient = readClientState.client;

  const versionsBySchoolId = useMemo(() => {
    const map = new Map<string, SchoolRuleVersion>();
    for (const version of versions) {
      map.set(version.schoolId.toLowerCase(), version);
    }
    return map;
  }, [versions]);

  const schoolIds = useMemo(
    () => versions.map((version) => version.schoolId),
    [versions]
  );

  const query = useQuery({
    queryKey: [
      "university-applications",
      config.universityAdmissionVerifierAddress,
      schoolIds.join(","),
      readClientState.sourceKey
    ],
    enabled: Boolean(enabled && readClientState.isReady && publicClient && versions.length > 0),
    queryFn: async () => {
      const applicantsBySchool = await Promise.all(
        schoolIds.map(async (schoolId) => {
          const applicants = await getSchoolApplicants(
            publicClient!,
            config.universityAdmissionVerifierAddress,
            schoolId
          );
          return [schoolId, applicants] as const;
        })
      );

      const applicationEntries = (
        await Promise.all(
          applicantsBySchool.flatMap(([schoolId, applicants]) =>
            applicants.map(async (applicant) => {
              const application = await getApplicationRecord(
                publicClient!,
                config.universityAdmissionVerifierAddress,
                schoolId,
                applicant
              );
              return {
                schoolId,
                applicant,
                application
              };
            })
          )
        )
      ).filter((entry) => entry.application.status !== 0);

      const [submittedLogs, approvedLogs, rejectedLogs] = await Promise.all([
        safeGetLogs(() =>
          publicClient!.getLogs({
            address: config.universityAdmissionVerifierAddress,
            event: applicationSubmittedEvent,
            fromBlock: 0n
          })
        ),
        safeGetLogs(() =>
          publicClient!.getLogs({
            address: config.universityAdmissionVerifierAddress,
            event: applicationApprovedEvent,
            fromBlock: 0n
          })
        ),
        safeGetLogs(() =>
          publicClient!.getLogs({
            address: config.universityAdmissionVerifierAddress,
            event: applicationRejectedEvent,
            fromBlock: 0n
          })
        )
      ]);

      const submittedMeta = new Map<string, EventMeta>();
      for (const log of submittedLogs) {
        const schoolId = log.args.schoolId!;
        if (!versionsBySchoolId.has(schoolId.toLowerCase())) {
          continue;
        }
        submittedMeta.set(getRecordKey(schoolId, log.args.applicant!), {
          txHash: log.transactionHash,
          blockNumber: log.blockNumber
        });
      }

      const decisionMeta = new Map<string, EventMeta>();
      for (const log of [...approvedLogs, ...rejectedLogs]) {
        const schoolId = log.args.schoolId!;
        if (!versionsBySchoolId.has(schoolId.toLowerCase())) {
          continue;
        }

        const key = getRecordKey(schoolId, log.args.applicant!);
        const current = decisionMeta.get(key);
        if (!current?.blockNumber || (log.blockNumber && log.blockNumber > current.blockNumber)) {
          decisionMeta.set(key, {
            txHash: log.transactionHash,
            blockNumber: log.blockNumber
          });
        }
      }

      return applicationEntries
        .map(({ schoolId, applicant, application }) => {
          const version = versionsBySchoolId.get(schoolId.toLowerCase());
          const key = getRecordKey(schoolId, applicant);
          const status =
            application.status === 3
              ? "APPROVED"
              : application.status === 2
                ? "REJECTED"
                : "PENDING";

          return {
            id: `${schoolId}-${applicant}`,
            schoolId,
            schoolName: version?.schoolName ?? schoolId,
            versionId: version?.versionId ?? "unknown",
            versionNumber: version?.versionNumber ?? null,
            applicant,
            submittedAt: application.submittedAt * 1000,
            updatedAt: application.decidedAt ? application.decidedAt * 1000 : application.submittedAt * 1000,
            status,
            submittedTxHash: submittedMeta.get(key)?.txHash,
            latestTxHash: decisionMeta.get(key)?.txHash ?? submittedMeta.get(key)?.txHash
          } satisfies UniversityApplicationRecord;
        })
        .sort((left, right) => right.updatedAt - left.updatedAt);
    }
  });

  return {
    records: query.data ?? [],
    isLoading:
      Boolean(query.isLoading) ||
      Boolean(enabled && versions.length > 0 && !readClientState.isReady && !readClientState.isWrongChain),
    isError: query.isError,
    error: query.error,
    readSourceKey: readClientState.sourceKey
  };
}
