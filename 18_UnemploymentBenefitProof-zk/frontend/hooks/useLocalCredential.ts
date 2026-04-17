"use client";

import { useEffect, useMemo, useState } from "react";
import { useSignMessage } from "wagmi";
import type { Address } from "@/types/contract-config";
import type { EncryptedCredentialEnvelope, LocalUnemploymentCredential } from "@/types/domain";
import { useRuntimeConfig } from "@/hooks/useRuntimeConfig";
import { claimPrivateCredential, requestCredentialChallenge } from "@/lib/private-credentials.client";
import { getFriendlyErrorMessage } from "@/lib/friendly-errors";
import {
  clearStoredCredential,
  loadCredentialEnvelope,
  persistEncryptedCredential,
  readStoredCredential,
  reloadCredentialEnvelope,
  subscribeCredentialEnvelope
} from "@/lib/storage/credential-store";

/**
 * 申请人本地资格凭证 Hook。
 *
 * 该 Hook 负责把“服务端签发私有凭证、钱包签名派生本地密钥、浏览器解密恢复”串成一个
 * 可消费状态机，让页面只关注 ready / missing / error 等业务状态。
 */
type LocalCredentialStatus = "missing" | "loading" | "ready" | "error";

/** 管理当前钱包地址对应的本地资格凭证。 */
export function useLocalCredential(address?: Address) {
  const config = useRuntimeConfig();
  const { signMessageAsync } = useSignMessage();
  const [envelope, setEnvelope] = useState<EncryptedCredentialEnvelope | null>(null);
  const [credential, setCredential] = useState<LocalUnemploymentCredential | null>(null);
  const [status, setStatus] = useState<LocalCredentialStatus>("missing");
  const [error, setError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);

  const scope = useMemo(() => (address ? `${config.chainId}:${config.deploymentId}:${address.toLowerCase()}` : null), [
    address,
    config.chainId,
    config.deploymentId
  ]);

  useEffect(() => {
    if (!address) {
      setEnvelope(null);
      return;
    }

    // envelope 变化可能来自本标签页签发，也可能来自其他标签页写 localStorage，因此统一走订阅刷新。
    const applySnapshot = () => {
      setEnvelope(loadCredentialEnvelope(config, address));
    };

    applySnapshot();
    const unsubscribe = subscribeCredentialEnvelope(applySnapshot);
    return unsubscribe;
  }, [address, config]);

  useEffect(() => {
    let active = true;

    // address / envelope 变化后重新尝试解密本地凭证；active 标记用于避免异步回写污染已卸载组件。
    async function hydrate() {
      if (!address) {
        setCredential(null);
        setStatus("missing");
        setError(null);
        return;
      }

      setStatus("loading");
      setError(null);

      try {
        const nextCredential = await readStoredCredential(config, address);
        if (!active) {
          return;
        }

        setCredential(nextCredential);
        setStatus(nextCredential ? "ready" : "missing");
      } catch (nextError) {
        if (!active) {
          return;
        }
        setCredential(null);
        setStatus("error");
        setError(getFriendlyErrorMessage(nextError, "credential-storage"));
      }
    }

    void hydrate();

    return () => {
      active = false;
    };
  }, [address, config, envelope]);

  /** 申请或刷新本地资格凭证，并在本地完成加密持久化。 */
  async function claimCredential() {
    if (!address) {
      const nextError = new Error("请先连接账户后再领取资格凭证。");
      setError(getFriendlyErrorMessage(nextError, "credential-claim"));
      throw nextError;
    }

    setIsClaiming(true);
    setError(null);

    try {
      const challenge = await requestCredentialChallenge(address);
      const signature = await signMessageAsync({ message: challenge.message });
      const nextCredential = await claimPrivateCredential({
        address,
        message: challenge.message,
        signature
      });

      await persistEncryptedCredential({
        config,
        address,
        credential: nextCredential,
        signature
      });

      setCredential(nextCredential);
      setStatus("ready");
      setError(null);
      setEnvelope(loadCredentialEnvelope(config, address));
      return nextCredential;
    } catch (nextError) {
      setStatus("error");
      setError(getFriendlyErrorMessage(nextError, "credential-claim"));
      throw nextError;
    } finally {
      setIsClaiming(false);
    }
  }

  /** 清除当前地址的本地资格凭证，常用于切换账户或调试恢复。 */
  async function clearCredential() {
    if (!address) {
      return;
    }

    await clearStoredCredential(config, address);
    setCredential(null);
    setStatus("missing");
    setError(null);
  }

  return {
    scope,
    envelope,
    credential,
    status,
    error,
    isClaiming,
    hasStoredCredential: Boolean(envelope),
    claimCredential,
    refreshCredential: claimCredential,
    clearCredential,
    reload: reloadCredentialEnvelope
  };
}
