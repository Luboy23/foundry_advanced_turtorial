import { describe, expect, it } from "vitest";
import { formatDuration, formatUpdatedAt, shortenAddress } from "./format";

describe("formatDuration", () => {
  it("formats zero or invalid values", () => {
    expect(formatDuration(0)).toBe("00:00");
    expect(formatDuration(-1)).toBe("00:00");
    expect(formatDuration(Number.NaN)).toBe("00:00");
  });

  it("formats seconds into mm:ss", () => {
    expect(formatDuration(5)).toBe("00:05");
    expect(formatDuration(65)).toBe("01:05");
    expect(formatDuration(600)).toBe("10:00");
  });
});

describe("shortenAddress", () => {
  it("shortens addresses with a default size", () => {
    expect(shortenAddress("0x1234567890abcdef")).toBe("0x1234...cdef");
  });

  it("handles empty input", () => {
    expect(shortenAddress("")).toBe("");
  });
});

describe("formatUpdatedAt", () => {
  it("formats timestamp in ms", () => {
    const output = formatUpdatedAt(1700000000000);
    expect(output).toContain("2023");
  });

  it("handles empty timestamp", () => {
    expect(formatUpdatedAt(0)).toBe("-");
  });
});
