import { describe, expect, it } from "vitest";
import {
  getFundAmountInputError,
  getValidatedFundAmount,
  isFundAmountInputAllowed,
  normalizeFundAmountInput
} from "@/lib/funding-amount";

describe("funding amount helpers", () => {
  it("accepts numeric input strings while rejecting invalid characters", () => {
    expect(isFundAmountInputAllowed("100")).toBe(true);
    expect(isFundAmountInputAllowed("250.5")).toBe(true);
    expect(isFundAmountInputAllowed("100.25.1")).toBe(false);
    expect(isFundAmountInputAllowed("1e3")).toBe(false);
    expect(isFundAmountInputAllowed("abc")).toBe(false);
  });

  it("normalizes leading zeros and trailing decimal zeros", () => {
    expect(normalizeFundAmountInput("00100.5000")).toBe("100.5");
    expect(normalizeFundAmountInput("0100")).toBe("100");
    expect(normalizeFundAmountInput("100.000")).toBe("100");
  });

  it("enforces the configured frontend range", () => {
    expect(getFundAmountInputError("99")).toBe("请输入 100 - 10000 ETH 之间的金额。");
    expect(getFundAmountInputError("10001")).toBe("请输入 100 - 10000 ETH 之间的金额。");
    expect(getFundAmountInputError("100")).toBeNull();
    expect(getFundAmountInputError("10000")).toBeNull();
    expect(getFundAmountInputError("250.75")).toBeNull();
  });

  it("returns normalized values for valid submissions", () => {
    expect(getValidatedFundAmount("00120.000")).toEqual({
      ok: true,
      normalized: "120"
    });
    expect(getValidatedFundAmount("100.50")).toEqual({
      ok: true,
      normalized: "100.5"
    });
  });
});
