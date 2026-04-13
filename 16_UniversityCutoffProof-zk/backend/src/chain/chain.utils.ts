export const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

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

export function deriveSchoolFamilyKey(universityKey: `0x${string}`, label: string, schoolName: string) {
  const decodedUniversityKey = decodeBytes32Label(universityKey);
  if (decodedUniversityKey === "pku" || label.startsWith("pku") || schoolName === "北京大学") {
    return "pku";
  }
  return "jiatingdun";
}

export function buildSchoolRuleVersionId(familyKey: string, versionNumber: number) {
  return `${familyKey}-v${versionNumber}`;
}

export function parseVersionNumberFromLabel(label: string, familyKey: string) {
  if (label === familyKey) {
    return 1;
  }
  const match = label.match(new RegExp(`^${familyKey}-v(\\d+)$`));
  if (!match) {
    return 1;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function toDateFromSeconds(value: bigint | number) {
  return new Date(Number(value) * 1000);
}
