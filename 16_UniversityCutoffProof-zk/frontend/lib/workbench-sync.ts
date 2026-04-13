"use client";

import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { getAuthorityWorkbench } from "@/lib/api/authority";
import { getStudentWorkbench } from "@/lib/api/student";
import { getUniversityWorkbench } from "@/lib/api/university";
import type {
  AuthorityWorkbenchDto,
  StudentWorkbenchDto,
  UniversityWorkbenchDto
} from "@/types/backend";

type WaitForWorkbenchArgs<T> = {
  queryClient: QueryClient;
  queryKey: QueryKey;
  queryFn: () => Promise<T>;
  predicate: (data: T) => boolean;
  timeoutMs?: number;
  intervalMs?: number;
  timeoutMessage: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForWorkbench<T>(args: WaitForWorkbenchArgs<T>) {
  const {
    queryClient,
    queryKey,
    queryFn,
    predicate,
    timeoutMs = 12_000,
    intervalMs = 400,
    timeoutMessage
  } = args;
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    const data = await queryClient.fetchQuery({
      queryKey,
      queryFn,
      staleTime: 0
    });

    if (predicate(data)) {
      return data;
    }

    await sleep(intervalMs);
  }

  throw new Error(timeoutMessage);
}

export function waitForAuthorityWorkbench(args: {
  queryClient: QueryClient;
  predicate: (data: AuthorityWorkbenchDto) => boolean;
  timeoutMessage: string;
  timeoutMs?: number;
  intervalMs?: number;
}) {
  return waitForWorkbench<AuthorityWorkbenchDto>({
    queryKey: ["authority-workbench"],
    queryFn: getAuthorityWorkbench,
    ...args
  });
}

export function waitForUniversityWorkbench(args: {
  queryClient: QueryClient;
  familyKey: "pku" | "jiatingdun";
  predicate: (data: UniversityWorkbenchDto) => boolean;
  timeoutMessage: string;
  timeoutMs?: number;
  intervalMs?: number;
}) {
  const { familyKey, ...rest } = args;
  return waitForWorkbench<UniversityWorkbenchDto>({
    queryKey: ["university-workbench", familyKey],
    queryFn: () => getUniversityWorkbench(familyKey),
    ...rest
  });
}

export function waitForStudentWorkbench(args: {
  queryClient: QueryClient;
  walletAddress: `0x${string}`;
  predicate: (data: StudentWorkbenchDto) => boolean;
  timeoutMessage: string;
  timeoutMs?: number;
  intervalMs?: number;
}) {
  const { walletAddress, ...rest } = args;
  return waitForWorkbench<StudentWorkbenchDto>({
    queryKey: ["student-workbench", walletAddress],
    queryFn: () => getStudentWorkbench(walletAddress),
    ...rest
  });
}
