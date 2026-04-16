import { keccak256, toHex } from "viem";

const SNARK_SCALAR_FIELD = BigInt(
  "21888242871839275222246405745257275088548364400416034343698204186575808495617"
);

export function addressToField(value: `0x${string}`) {
  return BigInt(value.toLowerCase()) % SNARK_SCALAR_FIELD;
}

export function parseGroth16SolidityCalldata(raw: string) {
  const [a, b, c, publicSignals] = JSON.parse(`[${raw.trim()}]`) as [
    [string, string],
    [[string, string], [string, string]],
    [string, string],
    string[]
  ];

  return {
    a: [BigInt(a[0]), BigInt(a[1])] as [bigint, bigint],
    b: [
      [BigInt(b[0][0]), BigInt(b[0][1])],
      [BigInt(b[1][0]), BigInt(b[1][1])]
    ] as [[bigint, bigint], [bigint, bigint]],
    c: [BigInt(c[0]), BigInt(c[1])] as [bigint, bigint],
    publicSignals: publicSignals.map((value) => BigInt(value))
  };
}

export function buildFailureHash(input: string) {
  return keccak256(toHex(input));
}
