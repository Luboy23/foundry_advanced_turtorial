import { describe, expect, it } from "vitest";
import {
  asciiToBytes32Hex,
  buildSchoolIdLabelForVersion,
  buildSchoolRuleVersionId,
  getCutoffValidationError,
  groupSchoolRuleVersions,
  normalizeCutoffInput
} from "@/lib/admission/rule-version";
import type { SchoolConfig } from "@/types/admission";

describe("groupSchoolRuleVersions", () => {
  // 保护目标：同一所大学的不同 schoolId 应该能被稳定映射到连续版本号。
  it("treats pku as version 1 and pku-v2 as version 2", () => {
    const configs: SchoolConfig[] = [
      {
        schoolId: asciiToBytes32Hex("pku"),
        universityKey: asciiToBytes32Hex("pku"),
        schoolName: "北京大学",
        scoreSourceId: asciiToBytes32Hex("GAOKAO_2026"),
        cutoffScore: 100,
        updatedAt: 1,
        admin: "0x0000000000000000000000000000000000000001",
        active: false,
        cutoffFrozen: true
      },
      {
        schoolId: asciiToBytes32Hex("pku-v2"),
        universityKey: asciiToBytes32Hex("pku"),
        schoolName: "北京大学",
        scoreSourceId: asciiToBytes32Hex("GAOKAO_2026"),
        cutoffScore: 95,
        updatedAt: 2,
        admin: "0x0000000000000000000000000000000000000001",
        active: true,
        cutoffFrozen: true
      }
    ];

    const grouped = groupSchoolRuleVersions(configs);

    expect(grouped.pku[0].versionId).toBe("pku-v2");
    expect(grouped.pku[0].versionNumber).toBe(2);
    expect(grouped.pku[1].versionId).toBe("pku-v1");
    expect(grouped.pku[1].versionNumber).toBe(1);
  });

  // 保护目标：前端生成版本标识的规则必须稳定，避免历史记录与路由参数漂移。
  it("builds version ids consistently", () => {
    expect(buildSchoolIdLabelForVersion("jiatingdun", 1)).toBe("jiatingdun");
    expect(buildSchoolIdLabelForVersion("jiatingdun", 3)).toBe("jiatingdun-v3");
    expect(buildSchoolRuleVersionId("jiatingdun", 3)).toBe("jiatingdun-v3");
  });

  it("clamps cutoff input to the current score source max score", () => {
    expect(normalizeCutoffInput("7000", 100)).toBe("100");
    expect(normalizeCutoffInput("088", 100)).toBe("88");
    expect(normalizeCutoffInput("abc70", 100)).toBe("70");
  });

  it("reports a validation error when cutoff exceeds the max score", () => {
    expect(getCutoffValidationError("101", 100)).toContain("不能超过当前成绩总分 100 分");
    expect(getCutoffValidationError("100", 100)).toBeNull();
  });
});
