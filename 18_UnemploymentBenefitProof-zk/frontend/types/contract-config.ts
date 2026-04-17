export type Address = `0x${string}`;

export type DemoAddresses = {
  government: Address;
  applicant: Address;
  agency: Address;
  ineligibleApplicant: Address;
};

export type RuntimeConfig = {
  roleRegistryAddress: Address;
  rootRegistryAddress: Address;
  benefitDistributorAddress: Address;
  verifierAddress: Address;
  chainId: number;
  rpcUrl: string;
  deploymentId: string;
  deploymentStartBlock?: number;
  demoAddresses: DemoAddresses;
  zkArtifactPaths: {
    wasm: string;
    zkey: string;
  };
};

declare global {
  interface Window {
    __APP_RUNTIME_CONFIG__?: Partial<RuntimeConfig>;
  }
}

export {};
