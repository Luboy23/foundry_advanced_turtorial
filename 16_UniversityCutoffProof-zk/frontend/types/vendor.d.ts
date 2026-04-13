declare module "snarkjs" {
  export const groth16: {
    fullProve(
      input: Record<string, unknown>,
      wasmFile: string,
      zkeyFile: string
    ): Promise<{
      proof: unknown;
      publicSignals: string[];
    }>;
    exportSolidityCallData(proof: unknown, publicSignals: string[]): Promise<string>;
  };
}

declare module "circomlibjs" {
  export function buildPoseidon(): Promise<{
    (inputs: readonly bigint[]): unknown;
    F: {
      toString(value: unknown): string;
    };
  }>;
}

declare module "../../node_modules/snarkjs/build/browser.esm.js" {
  export const groth16: {
    fullProve(
      input: Record<string, unknown>,
      wasmFile: string,
      zkeyFile: string
    ): Promise<{
      proof: unknown;
      publicSignals: string[];
    }>;
    exportSolidityCallData(proof: unknown, publicSignals: string[]): Promise<string>;
  };
}

declare module "../../node_modules/circomlibjs/src/poseidon_constants_opt.js" {
  const poseidonConstants: unknown;
  export default poseidonConstants;
}

declare module "../../node_modules/ffjavascript/build/browser.esm.js" {
  export function getCurveFromName(name: string, singleThread?: boolean): Promise<{
    Fr: {
      add(left: unknown, right: unknown): unknown;
      e(value: unknown): unknown;
      mul(left: unknown, right: unknown): unknown;
      square(value: unknown): unknown;
      toString(value: unknown): string;
      zero: unknown;
    };
  }>;
}
