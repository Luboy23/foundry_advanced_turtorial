import { isAddress } from "viem";
import type {
  CredentialSetDraftInput,
  EditableApplicantRecord,
  ResolvedApplicantRecord,
  ResolvedCredentialSetDraftInput
} from "@/types/domain";

/**
 * 政府端资格名单草稿的轻量工具。
 *
 * 这一层只保留页面录入、草稿比较和字段校验所需的纯函数，不依赖 Poseidon、Buffer
 * 或其他重型加密库，确保 client page 可以安全复用而不会把重依赖打进首屏 bundle。
 */
export const CREDENTIAL_SET_MERKLE_DEPTH = 20;
export const CREDENTIAL_SET_ID_LABEL = "unemployment-credential-set";
export const CREDENTIAL_SET_SOURCE_TITLE = "失业资格审核名单";

type ApplicantRowField = "applicantAddress" | "identityHash" | "secretSalt";

export type ApplicantRowErrors = Partial<Record<ApplicantRowField, string>>;

export type CredentialSetDraftValidationResult = {
  valid: boolean;
  normalizedInput: CredentialSetDraftInput;
  errors: string[];
  rowErrors: ApplicantRowErrors[];
  referenceDateError?: string;
};

export type ResolvedCredentialSetDraftValidationResult = {
  valid: boolean;
  normalizedInput: ResolvedCredentialSetDraftInput;
  errors: string[];
  rowErrors: ApplicantRowErrors[];
  referenceDateError?: string;
};

/** 创建一条空白的申请记录，供政府端新增行时复用默认结构。 */
export function createEmptyApplicantRecord(): EditableApplicantRecord {
  return {
    applicantAddress: "",
    applicantLabel: ""
  };
}

/** 生成今天零点的 UTC 秒级时间戳，作为新草稿默认参考日期。 */
export function getTodayReferenceDate() {
  const now = new Date();
  return Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000);
}

/** 把秒级 referenceDate 转成 `<input type="date">` 可直接显示的字符串。 */
export function referenceDateToInputValue(referenceDate: number) {
  const date = new Date(referenceDate * 1000);
  return date.toISOString().slice(0, 10);
}

/** 解析日期输入框值；解析失败时返回 `null`，由上层统一决定提示文案。 */
export function parseReferenceDateInput(value: string) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (Number.isNaN(timestamp)) {
    return null;
  }

  return Math.floor(timestamp / 1000);
}

/** 清理政府端可编辑记录中的首尾空白，避免“看起来一样、实际不一致”的草稿比较问题。 */
export function normalizeApplicantRecord(record: EditableApplicantRecord): EditableApplicantRecord {
  return {
    applicantAddress: record.applicantAddress.trim(),
    applicantLabel: record.applicantLabel?.trim() ?? ""
  };
}

/** 规范化前端草稿输入，确保版本号和日期在校验前就转成数值。 */
export function normalizeCredentialSetDraftInput(input: CredentialSetDraftInput): CredentialSetDraftInput {
  return {
    version: Number(input.version),
    referenceDate: Number(input.referenceDate),
    records: input.records.map(normalizeApplicantRecord)
  };
}

/** 规范化已经带 identityHash / secretSalt 的解析后记录，便于快照比较和二次校验。 */
export function normalizeResolvedApplicantRecord(record: ResolvedApplicantRecord): ResolvedApplicantRecord {
  return {
    applicantAddress: record.applicantAddress.trim(),
    identityHash: record.identityHash.trim(),
    secretSalt: record.secretSalt.trim(),
    applicantLabel: record.applicantLabel?.trim() ?? ""
  };
}

/** 规范化服务端使用的 resolved 草稿输入。 */
export function normalizeResolvedCredentialSetDraftInput(
  input: ResolvedCredentialSetDraftInput
): ResolvedCredentialSetDraftInput {
  return {
    version: Number(input.version),
    referenceDate: Number(input.referenceDate),
    records: input.records.map(normalizeResolvedApplicantRecord)
  };
}

/** 判断字符串是否是严格大于 0 的整数，用于校验 identityHash 与 secretSalt。 */
function isPositiveIntegerString(value: string) {
  if (!/^\d+$/.test(value)) {
    return false;
  }

  try {
    return BigInt(value) > 0n;
  } catch {
    return false;
  }
}

/**
 * 校验政府端提交的“可编辑草稿”。
 *
 * 这一层只校验页面能直接编辑的字段，比如版本号、参考日期、地址合法性和去重；真正
 * 带 identityHash / secretSalt 的 resolved 校验会在后续步骤完成。
 */
export function validateCredentialSetDraftInput(input: CredentialSetDraftInput): CredentialSetDraftValidationResult {
  const normalizedInput = normalizeCredentialSetDraftInput(input);
  const errors: string[] = [];
  const rowErrors: ApplicantRowErrors[] = normalizedInput.records.map(() => ({}));

  if (!Number.isInteger(normalizedInput.version) || normalizedInput.version <= 0) {
    errors.push("当前版本号无效，请刷新页面后重试。");
  }

  let referenceDateError: string | undefined;
  if (!Number.isInteger(normalizedInput.referenceDate) || normalizedInput.referenceDate <= 0) {
    referenceDateError = "请选择有效的参考日期。";
    errors.push(referenceDateError);
  }

  if (!normalizedInput.records.length) {
    errors.push("资格名单至少需要保留 1 条申请记录。");
  }

  const seenAddresses = new Set<string>();

  // 地址去重必须基于统一的小写形式，否则同一地址的大小写变体会绕过页面校验。
  normalizedInput.records.forEach((record, index) => {
    if (!record.applicantAddress || !isAddress(record.applicantAddress)) {
      rowErrors[index].applicantAddress = "请输入有效的钱包地址。";
    } else {
      const normalizedAddress = record.applicantAddress.toLowerCase();
      if (seenAddresses.has(normalizedAddress)) {
        rowErrors[index].applicantAddress = "钱包地址不能重复。";
      } else {
        seenAddresses.add(normalizedAddress);
      }
    }
  });

  rowErrors.forEach((rowError, index) => {
    if (rowError.applicantAddress) {
      errors.push(`第 ${index + 1} 条申请记录存在未修正的字段。`);
    }
  });

  return {
    valid: errors.length === 0,
    normalizedInput,
    errors,
    rowErrors,
    referenceDateError
  };
}

/**
 * 校验已经补齐 identityHash / secretSalt 的 resolved 草稿。
 *
 * 这一步通常发生在服务端准备快照或重新载入历史快照时，用来保证种子数据、历史快照
 * 和最新编辑草稿最终都会落到同一套约束上。
 */
export function validateResolvedCredentialSetDraftInput(
  input: ResolvedCredentialSetDraftInput
): ResolvedCredentialSetDraftValidationResult {
  const normalizedInput = normalizeResolvedCredentialSetDraftInput(input);
  const baseValidation = validateCredentialSetDraftInput(normalizedInput);
  const errors = [...baseValidation.errors];
  const rowErrors = baseValidation.rowErrors.map((rowError) => ({ ...rowError }));
  const seenIdentityHashes = new Set<string>();

  normalizedInput.records.forEach((record, index) => {
    if (!isPositiveIntegerString(record.identityHash)) {
      rowErrors[index].identityHash = "identityHash 需要是正整数。";
    } else if (seenIdentityHashes.has(record.identityHash)) {
      rowErrors[index].identityHash = "identityHash 不能重复。";
    } else {
      seenIdentityHashes.add(record.identityHash);
    }

    if (!isPositiveIntegerString(record.secretSalt)) {
      rowErrors[index].secretSalt = "secretSalt 需要是正整数。";
    }
  });

  rowErrors.forEach((rowError, index) => {
    if (rowError.identityHash || rowError.secretSalt) {
      errors.push(`第 ${index + 1} 条申请记录存在未修正的字段。`);
    }
  });

  return {
    valid: errors.length === 0,
    normalizedInput,
    errors,
    rowErrors,
    referenceDateError: baseValidation.referenceDateError
  };
}

/** 比较两份 resolved 草稿的记录是否一致，用于判断是否真的需要重新发布资格名单。 */
export function credentialSetRecordsAreEqual(
  left: ResolvedCredentialSetDraftInput,
  right: ResolvedCredentialSetDraftInput
) {
  return (
    JSON.stringify(normalizeResolvedCredentialSetDraftInput(left).records) ===
    JSON.stringify(normalizeResolvedCredentialSetDraftInput(right).records)
  );
}

/** 比较两份可编辑草稿是否一致，用于区分“继续发布现有草稿”和“用户改动后重新生成”。 */
export function draftsAreEqual(left: CredentialSetDraftInput, right: CredentialSetDraftInput) {
  return JSON.stringify(normalizeCredentialSetDraftInput(left)) === JSON.stringify(normalizeCredentialSetDraftInput(right));
}
