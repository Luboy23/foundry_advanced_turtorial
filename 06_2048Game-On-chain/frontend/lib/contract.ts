import type { Abi } from "viem";
import scoreContractAbi from "@/lib/generated/onchain2048scores-abi.json";
import { getRuntimeConfig } from "@/lib/runtime-config";

export const SCORE_CONTRACT_ADDRESS = getRuntimeConfig().scoreContractAddress;
export const SCORE_CONTRACT_ABI = scoreContractAbi as Abi;

export function isZeroAddress(address: string) {
  return /^0x0{40}$/.test(address);
}
