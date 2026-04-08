import type { Abi } from "viem";
import nftAbiJson from "@/lib/generated/nft-abi.json";
import marketAbiJson from "@/lib/generated/market-abi.json";
import { getRuntimeConfig } from "@/lib/runtime-config";

const runtime = getRuntimeConfig();

export const NFT_ADDRESS = runtime.nftAddress;
export const MARKET_ADDRESS = runtime.marketAddress;

export const RPC_URL = runtime.rpcUrl;

export const NFT_CONTRACT_READY =
  NFT_ADDRESS.length > 0;
export const MARKET_CONTRACT_READY =
  MARKET_ADDRESS.length > 0;
export const CONTRACTS_READY = NFT_CONTRACT_READY;
export const MARKET_FEATURE_READY =
  NFT_CONTRACT_READY && MARKET_CONTRACT_READY;

export const MAX_BATCH = 20;

export const nftAbi = nftAbiJson as Abi;
export const marketAbi = marketAbiJson as Abi;
