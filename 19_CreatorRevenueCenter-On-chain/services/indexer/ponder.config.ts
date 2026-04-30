import { createRequire } from "node:module";
import { createConfig } from "ponder";
import type { Abi } from "viem";

const require = createRequire(import.meta.url);
const RevenueBatchRegistryArtifact = require("../../contracts/out/RevenueBatchRegistry.sol/RevenueBatchRegistry.json");
const CreatorRevenueDistributorArtifact = require("../../contracts/out/CreatorRevenueDistributor.sol/CreatorRevenueDistributor.json");

function normalizeNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeString(value: string | undefined, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

const chainId = normalizeNumber(process.env.PONDER_CHAIN_ID, 31337);
const rpcUrl = normalizeString(process.env.PONDER_RPC_URL, "http://127.0.0.1:8545");
const batchRegistryAddress = normalizeString(
  process.env.PONDER_BATCH_REGISTRY_ADDRESS,
  "0x0000000000000000000000000000000000000000"
);
const distributorAddress = normalizeString(
  process.env.PONDER_DISTRIBUTOR_ADDRESS,
  "0x0000000000000000000000000000000000000000"
);
const startBlock = normalizeNumber(process.env.PONDER_START_BLOCK, 0);

export default createConfig({
  database: {
    kind: "pglite"
  },
  chains: {
    anvil: {
      id: chainId,
      rpc: rpcUrl
    }
  },
  contracts: {
    RevenueBatchRegistry: {
      chain: "anvil",
      abi: RevenueBatchRegistryArtifact.abi as unknown as Abi,
      address: batchRegistryAddress as `0x${string}`,
      startBlock
    },
    CreatorRevenueDistributor: {
      chain: "anvil",
      abi: CreatorRevenueDistributorArtifact.abi as unknown as Abi,
      address: distributorAddress as `0x${string}`,
      startBlock
    }
  }
});
