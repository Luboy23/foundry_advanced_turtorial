"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getRoleIdentity } from "@/lib/contracts/admission-role-registry";
import { createRuntimeReadClient } from "@/lib/blockchain/read-client";
import { useReadClient } from "@/hooks/useReadClient";
import type { ContractConfig } from "@/types/contract-config";
import type { RoleIdentity } from "@/types/auth";

// 组件首屏在角色查询未完成前统一看到这个空身份，避免不同页面各自拼一套默认值。
const EMPTY_ROLE_IDENTITY: RoleIdentity = {
  walletAddress: undefined,
  isWhitelisted: false,
  role: "none",
  universityKey: null,
  universityFamily: null
};

// 读取当前钱包在链上角色注册合约中的身份。
// 该 hook 是前端所有角色守卫、首页入口禁用状态和大学范围限制的共同基础。
export function useRoleIdentity(args: {
  config: ContractConfig;
  walletAddress: `0x${string}` | undefined;
  enabled?: boolean;
}) {
  const { config, walletAddress, enabled = true } = args;
  const readClientState = useReadClient(config);
  const runtimeReadClient = useMemo(() => createRuntimeReadClient(config), [config]);
  const publicClient = readClientState.isWrongChain ? runtimeReadClient : readClientState.client;
  const sourceKey = readClientState.isWrongChain
    ? `role-runtime:${readClientState.sourceKey}`
    : readClientState.sourceKey;

  const query = useQuery({
    queryKey: [
      "role-identity",
      walletAddress,
      config.admissionRoleRegistryAddress,
      sourceKey
    ],
    enabled: Boolean(enabled && walletAddress && (readClientState.isWrongChain || (readClientState.isReady && publicClient))),
    queryFn: async () =>
      getRoleIdentity(publicClient!, config.admissionRoleRegistryAddress, walletAddress!)
  });

  // 即使查询还没回来，也返回一个结构完整的 identity，减少页面上的空值分支。
  return {
    ...query,
    isLoading:
      Boolean(query.isLoading) ||
      Boolean(enabled && walletAddress && !readClientState.isReady && !readClientState.isWrongChain),
    identity: query.data ?? { ...EMPTY_ROLE_IDENTITY, walletAddress }
  };
}
