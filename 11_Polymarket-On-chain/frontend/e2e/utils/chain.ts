import fs from "node:fs";
import path from "node:path";
import { createPublicClient, createWalletClient, defineChain, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import eventFactoryAbi from "../../src/abi/EventFactory.json";

const OWNER_PRIVATE_KEY =
  (process.env.E2E_OWNER_PRIVATE_KEY ??
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80") as `0x${string}`;

const ANVIL_CHAIN = defineChain({
  id: 31337,
  name: "Anvil Local",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: ["http://127.0.0.1:8545"]
    }
  }
});

type FrontendRuntimeConfig = {
  rpcUrl: string;
  eventFactoryAddress: Address;
};

type UserPosition = {
  yes: bigint;
  no: bigint;
};

let cachedConfig: FrontendRuntimeConfig | null = null;
let cachedPublicClient: ReturnType<typeof createPublicClient> | null = null;
let cachedWalletClient: ReturnType<typeof createWalletClient> | null = null;

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const entries: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    entries[key] = value;
  }
  return entries;
}

function loadRuntimeConfig(): FrontendRuntimeConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const localEnv = parseEnvFile(path.resolve(process.cwd(), ".env.local"));
  const rpcUrl = process.env.E2E_RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL ?? localEnv.NEXT_PUBLIC_RPC_URL;
  const eventFactoryAddress =
    process.env.NEXT_PUBLIC_EVENT_FACTORY_ADDRESS ?? localEnv.NEXT_PUBLIC_EVENT_FACTORY_ADDRESS;

  if (!rpcUrl) {
    throw new Error("Missing RPC URL for e2e tests.");
  }
  if (!eventFactoryAddress) {
    throw new Error("Missing NEXT_PUBLIC_EVENT_FACTORY_ADDRESS for e2e tests.");
  }

  cachedConfig = {
    rpcUrl,
    eventFactoryAddress: eventFactoryAddress as Address
  };
  return cachedConfig;
}

function getPublicClient() {
  if (cachedPublicClient) {
    return cachedPublicClient;
  }
  const { rpcUrl } = loadRuntimeConfig();
  cachedPublicClient = createPublicClient({
    transport: http(rpcUrl)
  });
  return cachedPublicClient;
}

function getWalletClient() {
  if (cachedWalletClient) {
    return cachedWalletClient;
  }
  const { rpcUrl } = loadRuntimeConfig();
  const account = privateKeyToAccount(OWNER_PRIVATE_KEY);
  cachedWalletClient = createWalletClient({
    account,
    chain: ANVIL_CHAIN,
    transport: http(rpcUrl)
  });
  return cachedWalletClient;
}

function getOwnerAccountAddress(): Address {
  return privateKeyToAccount(OWNER_PRIVATE_KEY).address;
}

async function rpcCall<T>(method: string, params: unknown[] = []): Promise<T> {
  const { rpcUrl } = loadRuntimeConfig();
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params
    })
  });
  if (!response.ok) {
    throw new Error(`RPC call failed: ${method} (${response.status})`);
  }

  const payload = (await response.json()) as {
    result?: T;
    error?: { message?: string };
  };
  if (payload.error) {
    throw new Error(`RPC error for ${method}: ${payload.error.message ?? "unknown"}`);
  }
  return payload.result as T;
}

export async function getLatestBlockTimestamp() {
  const block = await getPublicClient().getBlock({ blockTag: "latest" });
  return Number(block.timestamp);
}

export async function getEventCount() {
  const { eventFactoryAddress } = loadRuntimeConfig();
  return (await getPublicClient().readContract({
    address: eventFactoryAddress,
    abi: eventFactoryAbi,
    functionName: "eventCount"
  })) as bigint;
}

export async function createEvent(question: string, closeDurationSec = 3600) {
  const { eventFactoryAddress } = loadRuntimeConfig();
  const walletClient = getWalletClient();

  const hash = await walletClient.writeContract({
    account: getOwnerAddress(),
    chain: undefined,
    address: eventFactoryAddress,
    abi: eventFactoryAbi,
    functionName: "createEventWithDuration",
    args: [question, BigInt(closeDurationSec), "https://example.com/e2e-rules", "ipfs://e2e-event-metadata"]
  });
  await getPublicClient().waitForTransactionReceipt({ hash });

  return getEventCount();
}

export async function ensureEventExists() {
  const count = await getEventCount();
  if (count > 0n) {
    return count;
  }
  return createEvent(`E2E Smoke Event ${Date.now()}`);
}

export async function getEventCloseTime(eventId: bigint) {
  const { eventFactoryAddress } = loadRuntimeConfig();
  const tuple = (await getPublicClient().readContract({
    address: eventFactoryAddress,
    abi: eventFactoryAbi,
    functionName: "getEvent",
    args: [eventId]
  })) as readonly [string, bigint, number, number, bigint, bigint, bigint, bigint, bigint, string, string];

  return Number(tuple[1]);
}

export async function getUserPosition(eventId: bigint, user: Address): Promise<UserPosition> {
  const { eventFactoryAddress } = loadRuntimeConfig();
  const [yes, no] = (await getPublicClient().readContract({
    address: eventFactoryAddress,
    abi: eventFactoryAbi,
    functionName: "getUserPosition",
    args: [eventId, user]
  })) as readonly [bigint, bigint];
  return { yes, no };
}

export async function increaseTime(seconds: number) {
  await rpcCall("evm_increaseTime", [seconds]);
  await rpcCall("evm_mine");
}

export async function setNextBlockTimestamp(timestampSec: number) {
  await rpcCall("evm_setNextBlockTimestamp", [timestampSec]);
  await rpcCall("evm_mine");
}

export function extractEventIdFromUrl(url: string) {
  const matched = url.match(/\/events\/(\d+)(?:$|\/)/);
  if (!matched) {
    throw new Error(`Cannot parse event id from url: ${url}`);
  }
  return BigInt(matched[1]);
}

export function getOwnerAddress() {
  return getOwnerAccountAddress();
}
