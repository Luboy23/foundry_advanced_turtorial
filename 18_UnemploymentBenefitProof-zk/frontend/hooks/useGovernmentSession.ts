"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSignMessage } from "wagmi";
import type { Address } from "@/types/contract-config";
import {
  requestGovernmentSessionChallenge,
  verifyGovernmentSession
} from "@/lib/government-credential-sets.client";

/**
 * 政府端管理会话 Hook。
 *
 * 该 Hook 把“请求 challenge -> 钱包签名 -> 换取 session token”的流程缓存成可复用的
 * `ensureSession`，避免政府页面的多个 API 请求重复触发签名。
 */
export function useGovernmentSession(address?: Address, enabled = false) {
  const { signMessageAsync } = useSignMessage();
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const previousAddressRef = useRef<Address | undefined>(address);
  const pendingSessionPromiseRef = useRef<Promise<string> | null>(null);

  /** 清空当前会话和错误状态，通常在切换账户或权限失效时调用。 */
  const clearSession = useCallback(() => {
    pendingSessionPromiseRef.current = null;
    setToken(null);
    setExpiresAt(null);
    setError(null);
  }, []);

  /** 确保当前政府账户拥有一枚仍有效的 session token。 */
  const ensureSession = useCallback(async () => {
    if (!address) {
      throw new Error("当前缺少审核管理账户地址。");
    }

    if (token && expiresAt && expiresAt > Date.now() + 5_000) {
      return token;
    }

    if (pendingSessionPromiseRef.current) {
      return pendingSessionPromiseRef.current;
    }

    // 并发请求复用同一个 Promise，避免政府端一次点击触发多次签名弹窗。
    const pendingPromise = (async () => {
      setIsAuthorizing(true);
      setError(null);

      try {
        const challenge = await requestGovernmentSessionChallenge(address);
        const signature = await signMessageAsync({ message: challenge.message });
        const session = await verifyGovernmentSession({
          address,
          message: challenge.message,
          signature
        });

        setToken(session.token);
        setExpiresAt(session.expiresAt);
        return session.token;
      } catch (nextError) {
        const message = nextError instanceof Error ? nextError.message : "当前未能完成管理确认，请稍后重试。";
        setError(message);
        throw nextError;
      } finally {
        pendingSessionPromiseRef.current = null;
        setIsAuthorizing(false);
      }
    })();

    pendingSessionPromiseRef.current = pendingPromise;
    return pendingPromise;
  }, [address, expiresAt, signMessageAsync, token]);

  useEffect(() => {
    // 页面失去政府权限时立即清空会话，避免旧 token 被误复用。
    if (!enabled) {
      clearSession();
      return;
    }
  }, [clearSession, enabled]);

  useEffect(() => {
    // 地址发生变化时，旧地址的 session 不能继续复用。
    if (previousAddressRef.current && address !== previousAddressRef.current) {
      clearSession();
    }

    previousAddressRef.current = address;
  }, [address, clearSession]);

  return {
    token,
    expiresAt,
    error,
    isAuthorizing,
    ensureSession,
    clearSession,
    setError
  };
}
