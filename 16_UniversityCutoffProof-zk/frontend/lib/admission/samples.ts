import type { SampleSchool, SampleScoreSource, SchoolFamilyKey } from "@/types/admission";

export const DEMO_SCHOOL_FAMILIES: Array<{
  familyKey: SchoolFamilyKey;
  schoolName: string;
}> = [
  {
    familyKey: "pku",
    schoolName: "北京大学"
  },
  {
    familyKey: "jiatingdun",
    schoolName: "家里蹲大学"
  }
];

export async function fetchSampleSchools(): Promise<SampleSchool[]> {
  const response = await fetch("/examples/sample-schools.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("系统内置学校信息暂不可用。");
  }
  return (await response.json()) as SampleSchool[];
}

export async function fetchSampleScoreSource(): Promise<SampleScoreSource> {
  const response = await fetch("/examples/sample-score-source.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("系统内置成绩来源信息暂不可用。");
  }
  return (await response.json()) as SampleScoreSource;
}
