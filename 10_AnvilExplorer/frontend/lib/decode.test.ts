import { describe, expect, it } from "vitest";
import { encodeFunctionData } from "viem";
import { ABI_REGISTRY, FUNCTION_SELECTOR_INDEX } from "./abis";
import { decodeFunctionDataWithRegistry } from "./decode";

const TEST_ADDRESS = "0x0000000000000000000000000000000000000001";

describe("decodeFunctionDataWithRegistry", () => {
  it("decodes function input with selector index", () => {
    // 前置条件：构造一个命中内置 ABI 的 transfer 调用输入。
    const input = encodeFunctionData({
      abi: ABI_REGISTRY[0].abi,
      functionName: "transfer",
      args: [TEST_ADDRESS, 1n],
    });

    const decoded = decodeFunctionDataWithRegistry(
      input,
      ABI_REGISTRY,
      FUNCTION_SELECTOR_INDEX
    );

    // 断言目标：方法名可被正确识别，并能定位到对应 ABI 分组。
    expect(decoded?.functionName).toBe("transfer");
    expect(decoded?.abiName).toContain("Erc20");
  });

  it("returns null for unknown selector", () => {
    // 前置条件：输入未知 selector。
    const decoded = decodeFunctionDataWithRegistry(
      "0xffffffff",
      ABI_REGISTRY,
      FUNCTION_SELECTOR_INDEX
    );
    // 断言目标：未知 selector 不应误判，必须返回 null。
    expect(decoded).toBeNull();
  });
});
