"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSchoolConfig, schoolCreatedEvent } from "@/lib/contracts/university-admission-verifier";
import { useReadClient } from "@/hooks/useReadClient";
import { groupSchoolRuleVersions, getCurrentFrozenVersion } from "@/lib/admission/rule-version";
import type { ContractConfig } from "@/types/contract-config";
import type { SampleSchool, SchoolConfig } from "@/types/admission";

// 把样例学校配置转成链上 SchoolConfig 形状。
// 这个分支只服务非关键展示页的教学回退，不应该进入真实申请和真实审批主链路。
function toFallbackConfig(sampleSchool: SampleSchool, fallbackScoreSourceId: `0x${string}`): SchoolConfig {
  return {
    schoolId: sampleSchool.schoolIdBytes32,
    universityKey: sampleSchool.universityKeyBytes32,
    schoolName: sampleSchool.schoolName,
    scoreSourceId: fallbackScoreSourceId,
    cutoffScore: sampleSchool.cutoffScore,
    updatedAt: 0,
    admin: "0x0000000000000000000000000000000000000000",
    active: sampleSchool.active,
    cutoffFrozen: sampleSchool.active
  };
}

// 决定当前页面到底使用链上规则，还是使用样例回退规则。
// 关键页面会传 allowFallback=false，从而把“没有真实规则”显式暴露成空状态而不是假数据。
export function resolveSchoolRuleConfigs(args: {
  queryConfigs: SchoolConfig[] | undefined;
  sampleSchools: SampleSchool[] | undefined;
  fallbackScoreSourceId: `0x${string}`;
  allowFallback: boolean;
}) {
  const { queryConfigs, sampleSchools, fallbackScoreSourceId, allowFallback } = args;

  if (queryConfigs?.length) {
    return queryConfigs;
  }
  if (!allowFallback) {
    return [];
  }

  return (sampleSchools ?? []).map((sampleSchool) =>
    toFallbackConfig(sampleSchool, fallbackScoreSourceId)
  );
}

// 统一读取大学申请规则，并把“链上真实数据优先、本地样例回退”这一套策略封装成单个 hook。
export function useSchoolRuleVersions(args: {
  config: ContractConfig;
  sampleSchools?: SampleSchool[] | undefined;
  fallbackScoreSourceId?: `0x${string}`;
  enabled?: boolean;
  allowFallback?: boolean;
}) {
  const {
    config,
    sampleSchools,
    fallbackScoreSourceId = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
    enabled = true,
    allowFallback = true
  } = args;
  const readClientState = useReadClient(config);
  const publicClient = readClientState.client;
  const liveQueryEnabled = Boolean(enabled && readClientState.isReady && publicClient);
  const fallbackKey = allowFallback ? fallbackScoreSourceId : "strict-live";

  const query = useQuery({
    queryKey: [
      "school-rule-versions",
      config.universityAdmissionVerifierAddress,
      readClientState.sourceKey,
      fallbackKey,
      allowFallback
    ],
    enabled: liveQueryEnabled,
    queryFn: async () => {
      // 规则版本没有独立列表接口，因此前端通过 SchoolCreated 事件回溯所有 schoolId。
      const logs = await publicClient!.getLogs({
        address: config.universityAdmissionVerifierAddress,
        event: schoolCreatedEvent,
        fromBlock: 0n
      });

      const schoolIds = [...new Set(logs.map((log) => log.args.schoolId!))];
      const configs = await Promise.all(
        schoolIds.map((schoolId) =>
          getSchoolConfig(publicClient!, config.universityAdmissionVerifierAddress, schoolId)
        )
      );

      return configs;
    }
  });

  // 只要链上有真实配置，就以链上为准；否则才按页面策略决定是否允许样例回退。
  const configs = useMemo(
    () =>
      resolveSchoolRuleConfigs({
        queryConfigs: query.data,
        sampleSchools,
        fallbackScoreSourceId,
        allowFallback
      }),
    [allowFallback, fallbackScoreSourceId, query.data, sampleSchools]
  );

  const groupedVersions = useMemo(() => groupSchoolRuleVersions(configs), [configs]);

  // 学生历史记录、申请页和大学管理页都需要 schoolId -> version 的快速索引。
  const versionsBySchoolId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof groupSchoolRuleVersions>[keyof ReturnType<typeof groupSchoolRuleVersions>][number]>();
    for (const familyVersions of Object.values(groupedVersions)) {
      for (const version of familyVersions) {
        map.set(version.schoolId.toLowerCase(), version);
      }
    }
    return map;
  }, [groupedVersions]);

  // 学生首页只关心每所大学“当前真正可申请的那一版规则”。
  const currentFrozenVersions = useMemo(
    () => ({
      pku: getCurrentFrozenVersion(groupedVersions.pku),
      jiatingdun: getCurrentFrozenVersion(groupedVersions.jiatingdun)
    }),
    [groupedVersions]
  );

  return {
    configs,
    groupedVersions,
    versionsBySchoolId,
    currentFrozenVersions,
    isLoading: Boolean(liveQueryEnabled && query.isLoading) || Boolean(enabled && !readClientState.isReady && !readClientState.isWrongChain),
    isError: query.isError,
    error: query.error
  };
}
