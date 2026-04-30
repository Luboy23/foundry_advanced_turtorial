export type Address = `0x${string}`;
export type BatchLabelMap = Record<`0x${string}`, string>;

export type DemoAddresses = {
  platform: Address;
  creator: Address;
  collaboratorA: Address;
  collaboratorB: Address;
};

export type RuntimeConfig = {
  batchRegistryAddress: Address;
  distributorAddress: Address;
  chainId: number;
  rpcUrl: string;
  deploymentId: string;
  demoAddresses: DemoAddresses;
  activeBatchId: `0x${string}`;
  activeBatchLabel: string;
  activeBillId: string;
  activeBatchRoot?: `0x${string}`;
  activeMetadataHash?: `0x${string}`;
  startBlock: number;
  indexerBaseUrl: string;
  batchLabelMap: BatchLabelMap;
};

declare global {
  interface Window {
    __APP_RUNTIME_CONFIG__?: Partial<RuntimeConfig>;
  }
}

export {};
