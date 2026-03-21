import { describe, expect, it } from "vitest";
import { buildSearchHref, parseSearchTarget } from "./search";

describe("search parser", () => {
  it("detects block number", () => {
    // 前置条件：输入纯数字。
    const target = parseSearchTarget("123");
    // 断言目标：应识别为区块并生成区块详情链接。
    expect(target).toEqual({ type: "block", value: "123" });
    expect(target ? buildSearchHref(target) : "").toBe("/block/123");
  });

  it("detects tx hash", () => {
    // 前置条件：输入标准 32 字节交易哈希。
    const hash = `0x${"ab".repeat(32)}`;
    const target = parseSearchTarget(hash);
    // 断言目标：应识别为交易类型。
    expect(target).toEqual({ type: "tx", value: hash });
  });

  it("returns null for unsupported input", () => {
    // 断言目标：无法识别的文本必须返回 null。
    expect(parseSearchTarget("hello-world")).toBeNull();
  });
});
