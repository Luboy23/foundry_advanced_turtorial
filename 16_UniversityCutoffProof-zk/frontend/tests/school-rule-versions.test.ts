import { describe, expect, it } from "vitest";
import { resolveSchoolRuleConfigs } from "@/hooks/useSchoolRuleVersions";
import type { SampleSchool, SchoolConfig } from "@/types/admission";

const fallbackScoreSourceId =
  "0x47414f4b414f5f32303236000000000000000000000000000000000000000000" as const;

const sampleSchool: SampleSchool = {
  universityKey: "jiatingdun",
  universityKeyBytes32: "0x6a696174696e6764756e00000000000000000000000000000000000000000000",
  schoolIdLabel: "jiatingdun-v1",
  schoolIdBytes32: "0x6a696174696e6764756e2d763100000000000000000000000000000000000000",
  schoolIdField: "1",
  schoolName: "家里蹲大学",
  cutoffScore: 50,
  active: true
};

const liveConfig: SchoolConfig = {
  schoolId: sampleSchool.schoolIdBytes32,
  universityKey: sampleSchool.universityKeyBytes32,
  schoolName: sampleSchool.schoolName,
  scoreSourceId: fallbackScoreSourceId,
  cutoffScore: 60,
  updatedAt: 1,
  admin: "0x0000000000000000000000000000000000000001",
  active: true,
  cutoffFrozen: true
};

describe("resolveSchoolRuleConfigs", () => {
  // 保护目标：链上规则一旦读到，就必须完全以链上为准，不能再混入样例配置。
  it("keeps live configs when the chain query succeeds", () => {
    expect(
      resolveSchoolRuleConfigs({
        queryConfigs: [liveConfig],
        sampleSchools: [sampleSchool],
        fallbackScoreSourceId,
        allowFallback: true
      })
    ).toEqual([liveConfig]);
  });

  // 保护目标：关键页面启用 strict live-data 模式后，没读到真实规则时必须显示空状态而不是样例。
  it("does not fall back to sample configs in strict live-data mode", () => {
    expect(
      resolveSchoolRuleConfigs({
        queryConfigs: undefined,
        sampleSchools: [sampleSchool],
        fallbackScoreSourceId,
        allowFallback: false
      })
    ).toEqual([]);
  });

  // 保护目标：非关键展示页仍保留样例回退能力，方便教学环境在链上规则未就绪时继续展示页面结构。
  it("still falls back to sample configs on non-critical pages", () => {
    expect(
      resolveSchoolRuleConfigs({
        queryConfigs: undefined,
        sampleSchools: [sampleSchool],
        fallbackScoreSourceId,
        allowFallback: true
      })
    ).toMatchObject([
      {
        schoolId: sampleSchool.schoolIdBytes32,
        schoolName: sampleSchool.schoolName,
        scoreSourceId: fallbackScoreSourceId,
        cutoffScore: sampleSchool.cutoffScore
      }
    ]);
  });
});
