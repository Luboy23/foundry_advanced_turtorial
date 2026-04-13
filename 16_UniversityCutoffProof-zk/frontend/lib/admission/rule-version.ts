import type { SchoolConfig, SchoolFamilyKey, SchoolRuleVersion } from "@/types/admission";

// 前端内部用固定 familyKey 统一管理同一所大学的多个申请规则版本。
const FAMILY_NAME_MAP: Record<SchoolFamilyKey, string> = {
  pku: "北京大学",
  jiatingdun: "家里蹲大学"
};

// 学校、大学键和成绩源编号在链上都以 bytes32 保存，这里把它们还原为前端可读标签。
export function decodeBytes32Label(value: string) {
  const hex = value.replace(/^0x/, "");
  let output = "";
  for (let index = 0; index < hex.length; index += 2) {
    const chunk = hex.slice(index, index + 2);
    if (chunk === "00") break;
    output += String.fromCharCode(Number.parseInt(chunk, 16));
  }
  return output;
}

// schoolId 在页面里经常承担“规则版本标签”的角色，因此保留一个更语义化的别名入口。
export function decodeSchoolIdLabel(schoolId: `0x${string}`) {
  return decodeBytes32Label(schoolId);
}

// 根据 familyKey 回到统一学校名称，避免多个页面各自写一套名称映射。
export function getSchoolNameByFamily(familyKey: SchoolFamilyKey) {
  return FAMILY_NAME_MAP[familyKey];
}

// 把链上大学键、schoolId 标签和学校名称三类来源统一归一到稳定 familyKey。
// 这是“新 schoolId = 新规则版本”模式下最重要的归并步骤。
export function deriveSchoolFamilyKey(
  universityKey: `0x${string}`,
  label: string,
  schoolName: string
): SchoolFamilyKey {
  const decodedUniversityKey = decodeBytes32Label(universityKey);
  if (decodedUniversityKey === "pku" || label.startsWith("pku") || schoolName === FAMILY_NAME_MAP.pku) {
    return "pku";
  }
  return "jiatingdun";
}

// versionId 是前端自己的展示标识，不直接写链上，只用于页面和历史记录。
export function buildSchoolRuleVersionId(familyKey: SchoolFamilyKey, versionNumber: number) {
  return `${familyKey}-v${versionNumber}`;
}

// schoolIdLabel 既要适合作为链上可读标签，也要适合放进学生申请页路由参数里。
// 第一版规则直接沿用 familyKey，后续版本才追加 -v2 / -v3，兼顾可读性和历史兼容。
export function buildSchoolIdLabelForVersion(familyKey: SchoolFamilyKey, versionNumber: number) {
  if (versionNumber <= 1) {
    return familyKey;
  }
  return buildSchoolRuleVersionId(familyKey, versionNumber);
}

// 教学项目里大量使用可读字符串作为离线标签，因此需要一个稳定的 ascii -> bytes32 编码器。
export function asciiToBytes32Hex(value: string): `0x${string}` {
  const bytes = new TextEncoder().encode(value);
  const hex = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `0x${hex.padEnd(64, "0").slice(0, 64)}` as `0x${string}`;
}

// 录取线输入框只接受正整数，并且不能超过当前成绩源允许的总分。
export function normalizeCutoffInput(value: string, maxScore?: number | null) {
  const digitsOnly = value.replace(/\D/g, "");
  if (!digitsOnly) {
    return "";
  }

  const parsed = Number.parseInt(digitsOnly, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return "";
  }

  if (typeof maxScore === "number" && Number.isFinite(maxScore) && maxScore > 0) {
    return String(Math.min(parsed, maxScore));
  }

  return String(parsed);
}

// 提交前再做一次运行时校验，避免绕过输入框约束后把无效录取线继续发到链上。
export function getCutoffValidationError(value: string, maxScore?: number | null) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return "录取线必须是大于 0 的整数。";
  }

  if (typeof maxScore === "number" && Number.isFinite(maxScore) && maxScore > 0 && parsed > maxScore) {
    return `录取线不能超过当前成绩总分 ${maxScore} 分。`;
  }

  return null;
}

// 从标签里回推出版本号，保证前端即使只拿到 schoolId 也能恢复“第几轮申请规则”。
export function parseVersionNumberFromLabel(label: string, familyKey: SchoolFamilyKey) {
  if (label === familyKey) {
    return 1;
  }

  const match = label.match(new RegExp(`^${familyKey}-v(\\d+)$`));
  if (!match) {
    return 1;
  }

  const version = Number(match[1]);
  return Number.isFinite(version) && version > 0 ? version : 1;
}

// 当前项目的规则生命周期只有三态：草稿、已冻结开放、旧规则。
function toRuleStatus(config: SchoolConfig) {
  if (!config.cutoffFrozen) {
    return "draft" as const;
  }
  if (config.active) {
    return "frozen" as const;
  }
  return "superseded" as const;
}

// 把链上 SchoolConfig 转成前端更适合消费的规则版本对象。
export function toSchoolRuleVersion(config: SchoolConfig): SchoolRuleVersion {
  const label = decodeSchoolIdLabel(config.schoolId);
  const familyKey = deriveSchoolFamilyKey(config.universityKey, label, config.schoolName);
  const versionNumber = parseVersionNumberFromLabel(label, familyKey);

  return {
    schoolId: config.schoolId,
    universityKey: config.universityKey,
    schoolIdLabel: label,
    familyKey,
    schoolName: config.schoolName,
    versionId: buildSchoolRuleVersionId(familyKey, versionNumber),
    versionNumber,
    scoreSourceId: config.scoreSourceId,
    cutoffScore: config.cutoffScore,
    updatedAt: config.updatedAt,
    admin: config.admin,
    active: config.active,
    cutoffFrozen: config.cutoffFrozen,
    status: toRuleStatus(config)
  };
}

// 把散落的 schoolId 配置按大学归并，供学生端和大学端各自读取。
export function groupSchoolRuleVersions(configs: SchoolConfig[]) {
  const grouped: Record<SchoolFamilyKey, SchoolRuleVersion[]> = {
    pku: [],
    jiatingdun: []
  };

  for (const config of configs) {
    const version = toSchoolRuleVersion(config);
    grouped[version.familyKey].push(version);
  }

  for (const familyKey of Object.keys(grouped) as SchoolFamilyKey[]) {
    grouped[familyKey].sort((left, right) => right.versionNumber - left.versionNumber);
  }

  return grouped;
}

// 学生端和大学端都优先关心“当前正在开放申请的那一版规则”。
export function getCurrentFrozenVersion(versions: SchoolRuleVersion[]) {
  return versions.find((version) => version.active && version.cutoffFrozen) ?? null;
}

// 大学端需要快速定位最近一版尚未冻结的草稿，便于继续编辑录取线。
export function getLatestDraftVersion(versions: SchoolRuleVersion[]) {
  return versions.find((version) => !version.cutoffFrozen) ?? null;
}

// 新建草稿时用已知最大版本号 + 1，保证版本号单调递增。
export function getNextVersionNumber(versions: SchoolRuleVersion[]) {
  if (!versions.length) {
    return 1;
  }

  return Math.max(...versions.map((version) => version.versionNumber)) + 1;
}
