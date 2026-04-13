import { describe, expect, it } from "vitest";
import { assertSuccessfulTransactionReceipt } from "@/lib/blockchain/tx-receipt";

describe("assertSuccessfulTransactionReceipt", () => {
  it("allows successful receipts to pass through", () => {
    expect(
      assertSuccessfulTransactionReceipt(
        {
          status: "success"
        },
        "提交申请"
      )
    ).toEqual({
      status: "success"
    });
  });

  it("throws when the transaction receipt is reverted", () => {
    expect(() =>
      assertSuccessfulTransactionReceipt(
        {
          status: "reverted"
        },
        "提交申请"
      )
    ).toThrow("提交申请交易已回退");
  });
});
