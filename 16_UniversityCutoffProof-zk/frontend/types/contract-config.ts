// 项目里所有链上地址统一用 0x 前缀模板字符串约束。
export type Address = `0x${string}`;

// 前端运行时最小配置集合。
export type ContractConfig = {
  scoreRootRegistryAddress: Address;
  universityAdmissionVerifierAddress: Address;
  admissionRoleRegistryAddress: Address;
  chainId: number;
  rpcUrl?: string;
  deploymentBlockNumber?: number;
  deploymentBlockHash?: `0x${string}`;
};

// 浏览器注入式运行时配置声明。
declare global {
  interface Window {
    __APP_RUNTIME_CONFIG__?: Partial<ContractConfig>;
  }
}

export {};
