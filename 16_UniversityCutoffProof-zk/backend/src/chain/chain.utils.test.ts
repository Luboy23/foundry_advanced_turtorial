import { describe, expect, it } from "vitest";
import {
  buildSchoolRuleVersionId,
  decodeBytes32Label,
  deriveSchoolFamilyKey,
  parseVersionNumberFromLabel,
  toDateFromSeconds
} from "./chain.utils";

describe("chain utils", () => {
  it("decodes bytes32 labels and derives university family keys", () => {
    expect(
      decodeBytes32Label(
        "0x706b750000000000000000000000000000000000000000000000000000000000"
      )
    ).toBe("pku");
    expect(
      deriveSchoolFamilyKey(
        "0x706b750000000000000000000000000000000000000000000000000000000000",
        "pku-v2",
        "北京大学"
      )
    ).toBe("pku");
    expect(
      deriveSchoolFamilyKey(
        "0x6a696174696e6764756e00000000000000000000000000000000000000000000",
        "jiatingdun-v1",
        "家里蹲大学"
      )
    ).toBe("jiatingdun");
  });

  it("builds version ids and parses fallback version numbers", () => {
    expect(buildSchoolRuleVersionId("pku", 3)).toBe("pku-v3");
    expect(parseVersionNumberFromLabel("pku-v5", "pku")).toBe(5);
    expect(parseVersionNumberFromLabel("pku", "pku")).toBe(1);
    expect(parseVersionNumberFromLabel("weird", "pku")).toBe(1);
  });

  it("converts seconds to dates", () => {
    expect(toDateFromSeconds(1710000000n).toISOString()).toBe("2024-03-09T16:00:00.000Z");
  });
});
