import { describe, expect, it } from "vitest";
import { parseGroth16SolidityCalldata } from "@/lib/zk/public-signals";
import sampleSolidityCalldata from "../../zk/data/generated/sample-admission/sample-solidity-calldata.json";

describe("parseGroth16SolidityCalldata", () => {
  // 保护目标：snarkjs 导出的 solidity calldata 必须能被前端稳定还原成 bigint 元组。
  it("maps the sample calldata shape into bigint tuples", () => {
    const raw = `${JSON.stringify(sampleSolidityCalldata.a)},${JSON.stringify(sampleSolidityCalldata.b)},${JSON.stringify(sampleSolidityCalldata.c)},${JSON.stringify(sampleSolidityCalldata.publicSignals)}`;
    const parsed = parseGroth16SolidityCalldata(raw);

    expect(parsed.a[0]).toBe(BigInt(sampleSolidityCalldata.a[0]));
    expect(parsed.b[1][1]).toBe(BigInt(sampleSolidityCalldata.b[1][1]));
    expect(parsed.publicSignals[2]).toBe(BigInt(sampleSolidityCalldata.publicSignals[2]));
  });
});
