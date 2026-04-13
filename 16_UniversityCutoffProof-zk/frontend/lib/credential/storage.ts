"use client";

import type { AdmissionCredential } from "@/types/credential";
import type { ContractConfig } from "@/types/contract-config";

// 学生侧只保存一份当前正在使用的成绩凭证。
const STORAGE_PREFIX = "zk-exam-pass:student:credential:v2";
const LEGACY_STORAGE_KEY = "zk-exam-pass:student:credential";

type StoredCredentialState = {
  fileName: string | null;
  credential: AdmissionCredential;
};

// 成绩凭证缓存必须跟随当前部署作用域隔离。
// 否则切到新一轮 make dev 后，学生页面会误读旧链上的历史凭证。
function getStorageScope(config: ContractConfig) {
  return [
    config.chainId,
    config.scoreRootRegistryAddress.toLowerCase(),
    config.universityAdmissionVerifierAddress.toLowerCase()
  ].join(":");
}

// 单独抽出 key 生成函数，保证读写删三条路径始终使用同一套作用域规则。
function getStorageKey(config: ContractConfig) {
  return `${STORAGE_PREFIX}:${getStorageScope(config)}`;
}

// 读取浏览器本地缓存中的成绩凭证。
export function readStoredCredential(config: ContractConfig): StoredCredentialState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    const raw = window.localStorage.getItem(getStorageKey(config));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredCredentialState>;
    if (!parsed || typeof parsed !== "object" || !parsed.credential) {
      return null;
    }

    return {
      fileName: typeof parsed.fileName === "string" ? parsed.fileName : null,
      credential: parsed.credential as AdmissionCredential
    };
  } catch {
    return null;
  }
}

// 把当前成绩凭证写入本地缓存，便于学生刷新页面后继续操作。
export function writeStoredCredential(config: ContractConfig, credential: AdmissionCredential, fileName: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  const payload: StoredCredentialState = {
    fileName,
    credential
  };
  window.localStorage.setItem(getStorageKey(config), JSON.stringify(payload));
}

// 主动清空本地成绩凭证，通常用于切换学生材料或退出当前申请场景。
export function clearStoredCredential(config: ContractConfig) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(getStorageKey(config));
}
