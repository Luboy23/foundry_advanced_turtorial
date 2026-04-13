import { describe, expect, it } from "vitest";
import { deserializeProofPackage, serializeProofPackage } from "@/lib/zk/proof-package";
import { parseGroth16SolidityCalldata } from "@/lib/zk/public-signals";
import type { ProofPackage } from "@/types/proof";
import sampleSolidityCalldata from "../../zk/data/generated/sample-admission/sample-solidity-calldata.json";

describe("proofPackage serialization", () => {
  it("round-trips bigint fields through a JSON-safe payload", () => {
    const raw = `${JSON.stringify(sampleSolidityCalldata.a)},${JSON.stringify(sampleSolidityCalldata.b)},${JSON.stringify(sampleSolidityCalldata.c)},${JSON.stringify(sampleSolidityCalldata.publicSignals)}`;
    const proofPackage: ProofPackage = {
      calldata: parseGroth16SolidityCalldata(raw),
      nullifierHash: 12345678901234567890n,
      recipient: "0x1111111111111111111111111111111111111111",
      cutoffScore: 680,
      scoreSourceIdBytes32: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      schoolIdBytes32: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      schoolName: "测试大学",
      merkleRoot: 998877665544332211n,
      generatedAt: 1710000000000
    };

    const serialized = serializeProofPackage(proofPackage);

    expect(() => JSON.stringify(serialized)).not.toThrow();
    expect(deserializeProofPackage(serialized)).toEqual(proofPackage);
  });
});
