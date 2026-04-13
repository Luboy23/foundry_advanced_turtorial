import { getRuntimeConfig, hasConfiguredContracts } from "@/lib/runtime-config";

const runtime = getRuntimeConfig();

export const RPC_URL = runtime.rpcUrl ?? "http://127.0.0.1:8545";
export const CHAIN_ID = runtime.chainId;
export const ADMISSION_ROLE_REGISTRY_ADDRESS = runtime.admissionRoleRegistryAddress;
export const SCORE_ROOT_REGISTRY_ADDRESS = runtime.scoreRootRegistryAddress;
export const UNIVERSITY_ADMISSION_VERIFIER_ADDRESS = runtime.universityAdmissionVerifierAddress;
export const IS_CONTRACT_CONFIGURED = hasConfiguredContracts(runtime);
