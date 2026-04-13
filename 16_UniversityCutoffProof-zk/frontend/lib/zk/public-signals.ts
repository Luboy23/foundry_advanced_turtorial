import type { ContractGroth16Proof } from "@/types/proof";

// snarkjs 导出的 solidity calldata 是一段逗号拼接字符串，这里先把它重新包回 JSON 结构。
function parseSolidityCalldata(raw: string) {
  return JSON.parse(`[${raw.trim()}]`) as [
    [string, string],
    [[string, string], [string, string]],
    [string, string],
    [string, string, string, string, string, string]
  ];
}

const toBigIntTuple2 = (value: [string, string]) => [BigInt(value[0]), BigInt(value[1])] as const;

// 把 snarkjs 的 calldata 字符串还原成合约提交时真正需要的 bigint 元组。
export function parseGroth16SolidityCalldata(raw: string): ContractGroth16Proof {
  const [a, b, c, publicSignals] = parseSolidityCalldata(raw);

  return {
    a: toBigIntTuple2(a),
    b: [toBigIntTuple2(b[0]), toBigIntTuple2(b[1])] as const,
    c: toBigIntTuple2(c),
    publicSignals: [
      BigInt(publicSignals[0]),
      BigInt(publicSignals[1]),
      BigInt(publicSignals[2]),
      BigInt(publicSignals[3]),
      BigInt(publicSignals[4]),
      BigInt(publicSignals[5])
    ] as const
  };
}
