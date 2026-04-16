"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useSignMessage } from "wagmi";
import type { Address } from "@/types/contract-config";
import type { EncryptedCredentialEnvelope, LocalAgeCredential } from "@/types/domain";
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

type LocalCredentialStatus = "missing" | "loading" | "ready" | "mismatch" | "error";

const getServerSnapshot = () => null as EncryptedCredentialEnvelope | null;

// 本地年龄凭证不是一段普通缓存，而是买家后续 proving 的私有材料。
// 这个 hook 负责把“challenge -> 签名 -> claim -> 本地加密持久化 -> 重新水合”收敛成统一能力。
export function useLocalCredential(address?: Address) {
  // 用外部 store 的原因是：领取、清空、切账号这些动作可能发生在多个页面，
  // 这里需要一个跨组件同步的凭证包快照，而不只是局部 state。
  const envelope = useSyncExternalStore(subscribeCredentialEnvelope, loadCredentialEnvelope, getServerSnapshot);
  const { signMessageAsync } = useSignMessage();
  const [credential, setCredential] = useState<LocalAgeCredential | null>(null);
  const [status, setStatus] = useState<LocalCredentialStatus>("missing");
  const [error, setError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);

  const matchesAddress = useMemo(() => {
    if (!envelope || !address) {
      return false;
    }

    return envelope.address.toLowerCase() === address.toLowerCase();
  }, [address, envelope]);

  useEffect(() => {
    let active = true;

    async function hydrateCredential() {
      // 没有 envelope 时，代表浏览器里还没有任何已加密的本地凭证。
      if (!envelope) {
        if (!active) {
          return;
        }
        setCredential(null);
        setStatus("missing");
        setError(null);
        return;
      }

      if (!address) {
        if (!active) {
          return;
        }
        setCredential(null);
        setStatus("missing");
        setError(null);
        return;
      }

      // envelope 属于别的钱包时，页面不应继续尝试解密，而要明确进入 mismatch 分支。
      if (envelope.address.toLowerCase() !== address.toLowerCase()) {
        if (!active) {
          return;
        }
        setCredential(null);
        setStatus("mismatch");
        setError(null);
        return;
      }

      if (!active) {
        return;
      }

      setStatus("loading");
      setError(null);

      try {
        // 这里真正解密并读取的是本地私有凭证正文，不只是 localStorage 里的 envelope。
        const nextCredential = await readStoredCredential(address);
        if (!active) {
          return;
        }

        if (!nextCredential) {
          setCredential(null);
          setStatus("missing");
          return;
        }

        setCredential(nextCredential);
        setStatus("ready");
      } catch (nextError) {
        if (!active) {
          return;
        }
        setCredential(null);
        setStatus("error");
        setError(getFriendlyErrorMessage(nextError, "credential-storage"));
      }
    }

    void hydrateCredential();

    return () => {
      active = false;
    };
  }, [address, envelope]);

  async function claimCredential() {
    if (!address) {
      const nextError = new Error("请先连接买家账户后再领取年龄凭证。");
      setError(getFriendlyErrorMessage(nextError, "credential-claim"));
      throw nextError;
    }

    setIsClaiming(true);
    setError(null);

    try {
      // 领取链路分成两段：
      // 1. challenge + 签名，证明当前用户真的控制着这个地址；
      // 2. claim + 本地加密保存，把私有凭证变成浏览器内可持续使用的证明材料。
      const challenge = await requestCredentialChallenge(address);
      const signature = await signMessageAsync({
        message: challenge.message
      });
      const nextCredential = await claimPrivateCredential({
        address,
        message: challenge.message,
        signature
      });

      await persistEncryptedCredential({
        address,
        credential: nextCredential,
        signature
      });

      setCredential(nextCredential);
      setStatus("ready");
      setError(null);
      return nextCredential;
    } catch (nextError) {
      setStatus(envelope ? "error" : "missing");
      setError(getFriendlyErrorMessage(nextError, "credential-claim"));
      throw nextError;
    } finally {
      setIsClaiming(false);
    }
  }

  async function clearCredential() {
    // 清空不只是移除明文 envelope，也会一起删除对应地址的本地加密密钥。
    await clearStoredCredential(address ?? envelope?.address);
    setCredential(null);
    setStatus("missing");
    setError(null);
  }

  return {
    credential,
    envelope,
    status,
    error,
    isClaiming,
    hasStoredCredential: Boolean(envelope),
    matchesAddress,
    claimCredential,
    refreshCredential: claimCredential,
    clearCredential,
    reload: reloadCredentialEnvelope
  };
}
