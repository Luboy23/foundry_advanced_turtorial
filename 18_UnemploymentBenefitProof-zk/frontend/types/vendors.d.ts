declare module "snarkjs" {
  export const groth16: {
    fullProve: (
      input: Record<string, unknown>,
      wasmPath: string,
      zkeyPath: string
    ) => Promise<{
      proof: unknown;
      publicSignals: string[];
    }>;
    exportSolidityCallData: (proof: unknown, publicSignals: unknown) => Promise<string>;
  };
}

declare module "circomlibjs" {
  type PoseidonInstance = {
    (inputs: bigint[]): unknown;
    F: {
      toString: (value: unknown) => string;
    };
  };

  export function buildPoseidon(): Promise<PoseidonInstance>;
}
