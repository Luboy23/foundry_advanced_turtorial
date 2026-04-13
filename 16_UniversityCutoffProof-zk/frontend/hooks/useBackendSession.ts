"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSignMessage } from "wagmi";
import {
  createAuthChallenge,
  getBackendSession,
  verifyAuthChallenge
} from "@/lib/api/auth";
import type { BackendSessionStatusDto } from "@/types/backend";

// 后台会话 hook。
// 钱包地址与后端 cookie 会话必须同时成立，页面才把当前用户视为“已登录后台”。
export function useBackendSession(args: {
  walletAddress?: `0x${string}`;
  enabled?: boolean;
  autoSignIn?: boolean;
}) {
  const { walletAddress, enabled = true, autoSignIn = false } = args;
  const queryClient = useQueryClient();
  const attemptedWalletRef = useRef<string | null>(null);
  const { signMessageAsync, isPending: isSigning } = useSignMessage();

  const sessionQuery = useQuery({
    queryKey: ["backend-session", walletAddress],
    enabled: Boolean(enabled && walletAddress),
    retry: false,
    queryFn: async () => {
      const session = await getBackendSession();
      if (!session || !walletAddress) {
        return null;
      }
      // 会话 cookie 可能来自其他钱包地址，这里要再次对齐当前页面连接的钱包。
      return session.walletAddress.toLowerCase() === walletAddress.toLowerCase() ? session : null;
    }
  });

  const authMutation = useMutation({
    mutationFn: async () => {
      if (!walletAddress) {
        throw new Error("当前未连接钱包。");
      }
      const challenge = await createAuthChallenge(walletAddress);
      const signature = await signMessageAsync({ message: challenge.challenge });
      return verifyAuthChallenge({
        walletAddress,
        challenge: challenge.challenge,
        signature
      });
    },
    onSuccess: (session) => {
      queryClient.setQueryData(["backend-session", walletAddress], session);
    }
  });

  const session = sessionQuery.data as BackendSessionStatusDto | null | undefined;
  const isAuthenticated = Boolean(session);
  const isChecking = sessionQuery.isLoading;
  const isAuthenticating = authMutation.isPending || isSigning;
  const error = isAuthenticated
    ? null
    : ((authMutation.error as Error | null)?.message ??
      (sessionQuery.error as Error | null)?.message ??
      null);

  useEffect(() => {
    if (!walletAddress) {
      attemptedWalletRef.current = null;
      queryClient.removeQueries({ queryKey: ["backend-session"] });
      return;
    }

    if (!enabled || !autoSignIn) {
      return;
    }

    if (sessionQuery.isLoading || authMutation.isPending || isSigning) {
      return;
    }

    if (sessionQuery.data) {
      return;
    }

    if (attemptedWalletRef.current === walletAddress) {
      return;
    }

    // 自动登录只尝试一次，避免签名失败后页面反复弹钱包请求。
    attemptedWalletRef.current = walletAddress;
    void authMutation.mutateAsync().catch(() => {
      // 错误交给 mutation 状态暴露给页面。
    });
  }, [
    authMutation,
    autoSignIn,
    enabled,
    isSigning,
    queryClient,
    sessionQuery.data,
    sessionQuery.isLoading,
    walletAddress
  ]);

  useEffect(() => {
    if (sessionQuery.data) {
      attemptedWalletRef.current = null;
    }
  }, [sessionQuery.data]);

  return {
    session,
    isLoading: isChecking || isAuthenticating,
    isChecking,
    isAuthenticating,
    isAuthenticated,
    error,
    async authenticate() {
      if (isAuthenticated) {
        return session;
      }
      attemptedWalletRef.current = walletAddress ?? null;
      return authMutation.mutateAsync();
    },
    refetch: sessionQuery.refetch
  };
}
