"use client";

import { useEffect, useMemo, useState } from "react";
import { parseCredentialFile, parseCredentialJson } from "@/lib/credential/parser";
import { clearStoredCredential, readStoredCredential, writeStoredCredential } from "@/lib/credential/storage";
import type { ContractConfig } from "@/types/contract-config";
import type { AdmissionCredential } from "@/types/credential";

// 负责学生侧成绩凭证的导入、读取和本地持久化恢复。
export function useCredentialParser(config: ContractConfig) {
  // 首次渲染就把本地缓存带回页面，避免学生刷新后需要重新导入成绩凭证。
  const storageScopeKey = useMemo(
    () =>
      [
        config.chainId,
        config.scoreRootRegistryAddress.toLowerCase(),
        config.universityAdmissionVerifierAddress.toLowerCase()
      ].join(":"),
    [config.chainId, config.scoreRootRegistryAddress, config.universityAdmissionVerifierAddress]
  );
  const [initialStored] = useState(() => readStoredCredential(config));
  const [credential, setCredential] = useState<AdmissionCredential | null>(initialStored?.credential ?? null);
  const [fileName, setFileName] = useState<string | null>(initialStored?.fileName ?? null);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  function applyParsedCredential(
    result:
      | {
          ok: true;
          credential: AdmissionCredential;
        }
      | {
          ok: false;
          error: string;
        },
    sourceName: string
  ) {
    if (!result.ok) {
      setCredential(null);
      setFileName(sourceName);
      setError(result.error);
      return;
    }

    setCredential(result.credential);
    setFileName(sourceName);
    writeStoredCredential(config, result.credential, sourceName);
  }

  useEffect(() => {
    // 当前部署作用域一旦变化，就按新的链 ID 和合约地址范围重新读取本地凭证，
    // 防止旧链缓存的凭证继续污染新一轮教学流程。
    const stored = readStoredCredential(config);
    setCredential(stored?.credential ?? null);
    setFileName(stored?.fileName ?? null);
    setError(null);
  }, [config, storageScopeKey]);

  // 用户导入考试院发放的成绩凭证文件。
  async function importFile(file: File) {
    setIsParsing(true);
    setError(null);

    try {
      const result = await parseCredentialFile(file);
      applyParsedCredential(result, file.name);
    } catch (importError) {
      setCredential(null);
      setFileName(file.name);
      setError(importError instanceof Error ? importError.message : "读取成绩凭证失败。");
    } finally {
      setIsParsing(false);
    }
  }

  // 给学生工作台提供一键导入演示凭证的能力，仍然复用同一套解析与本地缓存逻辑。
  async function importFromUrl(url: string, sourceName: string) {
    setIsParsing(true);
    setError(null);

    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("加载演示成绩凭证失败。");
      }

      const raw = await response.text();
      const result = parseCredentialJson(raw);
      applyParsedCredential(result, sourceName);
    } catch (importError) {
      setCredential(null);
      setFileName(sourceName);
      setError(importError instanceof Error ? importError.message : "读取成绩凭证失败。");
    } finally {
      setIsParsing(false);
    }
  }

  // 主动清除本地缓存和当前页面状态，给学生切换成绩凭证留出干净起点。
  function resetCredential() {
    setCredential(null);
    setFileName(null);
    setError(null);
    clearStoredCredential(config);
  }

  return {
    credential,
    fileName,
    error,
    isParsing,
    importFile,
    importFromUrl,
    resetCredential
  };
}
