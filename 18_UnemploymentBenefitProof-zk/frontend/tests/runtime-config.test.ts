import { describe, expect, it } from "vitest";
import { normalizeRuntimeConfig } from "@/lib/runtime-config";

describe("normalizeRuntimeConfig", () => {
  it("normalizes deploymentStartBlock from decimal and hex input", () => {
    expect(normalizeRuntimeConfig({ deploymentStartBlock: "42" }).deploymentStartBlock).toBe(42);
    expect(normalizeRuntimeConfig({ deploymentStartBlock: "0x10" }).deploymentStartBlock).toBe(16);
    expect(normalizeRuntimeConfig({ deploymentStartBlock: 7 }).deploymentStartBlock).toBe(7);
  });

  it("drops invalid deploymentStartBlock values", () => {
    expect(normalizeRuntimeConfig({ deploymentStartBlock: "" }).deploymentStartBlock).toBeUndefined();
    expect(normalizeRuntimeConfig({ deploymentStartBlock: "-1" }).deploymentStartBlock).toBeUndefined();
    expect(normalizeRuntimeConfig({ deploymentStartBlock: "not-a-number" }).deploymentStartBlock).toBeUndefined();
  });
});
