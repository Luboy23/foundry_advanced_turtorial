import { describe, expect, it } from "vitest";
import { formatTxError } from "./tx-errors";

describe("formatTxError", () => {
  it("handles user rejection", () => {
    expect(formatTxError({ name: "UserRejectedRequestError" })).toBe(
      "你已取消签名，未发送交易。"
    );
    expect(formatTxError({ message: "User denied transaction" })).toBe(
      "你已取消签名，未发送交易。"
    );
  });

  it("handles insufficient funds", () => {
    expect(
      formatTxError({ message: "insufficient funds for gas * price + value" })
    ).toBe("余额不足，无法支付 gas。");
  });

  it("handles network mismatch", () => {
    expect(formatTxError({ name: "ChainMismatchError" })).toBe(
      "网络不匹配，请切换到本地 Anvil 网络（Chain ID 31337）。"
    );
  });

  it("handles RPC connectivity issues", () => {
    expect(formatTxError({ message: "Failed to fetch" })).toBe(
      "无法连接本地 RPC，请确认 Anvil 正在运行。"
    );
  });

  it("handles score=0 revert", () => {
    expect(formatTxError({ message: "score=0" })).toBe("分数为 0，无法提交。");
  });

  it("falls back to message", () => {
    expect(formatTxError({ message: "Something went wrong" })).toBe(
      "Something went wrong"
    );
  });

  it("falls back to default", () => {
    expect(formatTxError(null)).toBe(
      "交易失败，请稍后重试或检查钱包提示。"
    );
  });
});
