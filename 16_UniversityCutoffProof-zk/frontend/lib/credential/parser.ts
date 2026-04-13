import type { AdmissionCredential, CredentialParserResult } from "@/types/credential";
import { isAddress, isBytes32Hex } from "@/lib/utils";

// 当前系统固定使用深度为 20 的成绩 Merkle 树，因此凭证路径长度也必须稳定为 20。
const PATH_DEPTH = 20;

// 凭证里的大整数字段都以十进制字符串存储，避免 JSON 对 bigint 的兼容问题。
const isNumberishString = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 && /^-?\d+$/.test(value.trim());

// 对单份成绩凭证做结构化校验，并把外部输入收敛成业务层真正消费的 AdmissionCredential。
function parseCandidatePayload(input: unknown): CredentialParserResult {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "成绩凭证内容格式不正确。" };
  }

  const value = input as Record<string, unknown>;

  if (value.version !== 2) {
    return { ok: false, error: "当前成绩凭证版本不受支持。" };
  }

  if (typeof value.scoreSourceId !== "string" || value.scoreSourceId.trim().length === 0) {
    return { ok: false, error: "成绩凭证缺少成绩来源信息。" };
  }

  if (!isBytes32Hex(value.scoreSourceIdBytes32)) {
    return { ok: false, error: "成绩凭证缺少有效的成绩来源标识。" };
  }

  if (typeof value.scoreSourceTitle !== "string" || value.scoreSourceTitle.trim().length === 0) {
    return { ok: false, error: "成绩凭证缺少成绩来源名称。" };
  }

  if (!isAddress(value.boundStudentAddress)) {
    return { ok: false, error: "成绩凭证缺少有效的学生账户信息。" };
  }

  if (!isNumberishString(value.boundStudentField)) {
    return { ok: false, error: "成绩凭证中的学生绑定信息不完整。" };
  }

  if (typeof value.candidateLabel !== "string" || value.candidateLabel.trim().length === 0) {
    return { ok: false, error: "成绩凭证缺少学生信息。" };
  }

  if (!isNumberishString(value.candidateIdHash) || !isNumberishString(value.secretSalt)) {
    return { ok: false, error: "成绩凭证中的安全校验信息不完整。" };
  }

  if (!isNumberishString(value.leaf) || !isNumberishString(value.merkleRoot)) {
    return { ok: false, error: "成绩凭证中的校验摘要不完整。" };
  }

  if (!Array.isArray(value.pathElements) || value.pathElements.length !== PATH_DEPTH) {
    return { ok: false, error: "成绩凭证中的校验路径不完整。" };
  }

  if (!Array.isArray(value.pathIndices) || value.pathIndices.length !== PATH_DEPTH) {
    return { ok: false, error: "成绩凭证中的校验路径不完整。" };
  }

  if (!value.pathElements.every(isNumberishString)) {
    return { ok: false, error: "成绩凭证中的校验路径格式不正确。" };
  }

  if (
    !value.pathIndices.every(
      (entry) => typeof entry === "number" && Number.isInteger(entry) && (entry === 0 || entry === 1)
    )
  ) {
    return { ok: false, error: "成绩凭证中的校验路径格式不正确。" };
  }

  const score = Number(value.score);
  const maxScore = Number(value.maxScore);
  const issuedAt = Number(value.issuedAt);

  if (!Number.isInteger(score) || !Number.isInteger(maxScore)) {
    return { ok: false, error: "成绩凭证中的分数字段格式不正确。" };
  }

  if (score < 0 || maxScore <= 0 || score > maxScore) {
    return { ok: false, error: "分数范围不合法，请检查 score 与 maxScore。" };
  }

  if (!Number.isFinite(issuedAt) || issuedAt <= 0) {
    return { ok: false, error: "成绩凭证中的签发时间不正确。" };
  }

  const credential: AdmissionCredential = {
    version: 2,
    scoreSourceId: value.scoreSourceId,
    scoreSourceIdBytes32: value.scoreSourceIdBytes32,
    scoreSourceTitle: value.scoreSourceTitle,
    boundStudentAddress: value.boundStudentAddress,
    boundStudentField: value.boundStudentField as string,
    candidateLabel: value.candidateLabel,
    candidateIdHash: value.candidateIdHash as string,
    score,
    maxScore,
    secretSalt: value.secretSalt as string,
    leaf: value.leaf as string,
    merkleRoot: value.merkleRoot as string,
    pathElements: value.pathElements as string[],
    pathIndices: value.pathIndices as number[],
    issuedAt
  };

  return { ok: true, credential };
}

// 解析原始 JSON 字符串，是文件上传和内置样例加载共用的统一入口。
export function parseCredentialJson(raw: string): CredentialParserResult {
  try {
    const parsed = JSON.parse(raw);
    return parseCandidatePayload(parsed);
  } catch {
    return { ok: false, error: "成绩凭证文件格式不正确。" };
  }
}

// 读取用户上传的文件并进入统一 JSON 解析流程。
export async function parseCredentialFile(file: File) {
  const text = await file.text();
  return parseCredentialJson(text);
}
