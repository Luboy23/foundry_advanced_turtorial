declare module "circomlibjs" {
  export function buildPoseidon(): Promise<{
    F: {
      toString(value: unknown): string;
    };
    (inputs: bigint[]): unknown;
  }>;
}
