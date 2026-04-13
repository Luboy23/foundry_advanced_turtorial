import type {
  ContractGroth16Proof,
  ProofPackage,
  SerializedContractGroth16Proof,
  SerializedProofPackage
} from "@/types/proof";

const toBigIntTuple2 = (value: readonly [string, string]) => [BigInt(value[0]), BigInt(value[1])] as const;
const toStringTuple2 = (value: readonly [bigint, bigint]) => [value[0].toString(), value[1].toString()] as const;
const toStringTuple6 = (value: readonly [bigint, bigint, bigint, bigint, bigint, bigint]) =>
  [
    value[0].toString(),
    value[1].toString(),
    value[2].toString(),
    value[3].toString(),
    value[4].toString(),
    value[5].toString()
  ] as const;
const toBigIntTuple6 = (value: readonly [string, string, string, string, string, string]) =>
  [
    BigInt(value[0]),
    BigInt(value[1]),
    BigInt(value[2]),
    BigInt(value[3]),
    BigInt(value[4]),
    BigInt(value[5])
  ] as const;

export function serializeGroth16Proof(proof: ContractGroth16Proof): SerializedContractGroth16Proof {
  return {
    a: toStringTuple2(proof.a),
    b: [toStringTuple2(proof.b[0]), toStringTuple2(proof.b[1])] as const,
    c: toStringTuple2(proof.c),
    publicSignals: toStringTuple6(proof.publicSignals)
  };
}

export function deserializeGroth16Proof(proof: SerializedContractGroth16Proof): ContractGroth16Proof {
  return {
    a: toBigIntTuple2(proof.a),
    b: [toBigIntTuple2(proof.b[0]), toBigIntTuple2(proof.b[1])] as const,
    c: toBigIntTuple2(proof.c),
    publicSignals: toBigIntTuple6(proof.publicSignals)
  };
}

export function serializeProofPackage(proofPackage: ProofPackage): SerializedProofPackage {
  return {
    ...proofPackage,
    calldata: serializeGroth16Proof(proofPackage.calldata),
    nullifierHash: proofPackage.nullifierHash.toString(),
    merkleRoot: proofPackage.merkleRoot.toString()
  };
}

export function deserializeProofPackage(proofPackage: SerializedProofPackage): ProofPackage {
  return {
    ...proofPackage,
    calldata: deserializeGroth16Proof(proofPackage.calldata),
    nullifierHash: BigInt(proofPackage.nullifierHash),
    merkleRoot: BigInt(proofPackage.merkleRoot)
  };
}
