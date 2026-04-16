export type Address = `0x${string}`;

export type DemoAddresses = {
  issuer: Address;
  buyer: Address;
  seller: Address;
};

export type RuntimeConfig = {
  roleRegistryAddress: Address;
  rootRegistryAddress: Address;
  eligibilityVerifierAddress: Address;
  marketplaceAddress: Address;
  verifierAddress: Address;
  chainId: number;
  rpcUrl: string;
  deploymentId: string;
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
