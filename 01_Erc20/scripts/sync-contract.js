const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const contractsDir = path.join(rootDir, "contracts");
const frontendDir = path.join(rootDir, "frontend");

const outFile = path.join(contractsDir, "out", "LuLuCoin.sol", "LuLuCoin.json");
const abiTarget = path.join(frontendDir, "LuLuCoin.json");
const runtimeConfigTarget = path.join(frontendDir, "public", "contract-config.json");
const envTarget = path.join(frontendDir, ".env.local");
const contractsEnvTarget = path.join(contractsDir, ".env");
const broadcastDir = path.join(contractsDir, "broadcast");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const DEFAULT_RPC_URL = "http://127.0.0.1:8545";
const DEFAULT_CHAIN_ID = 31337;

const ensureDir = (filePath) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
};

const isAddress = (value) =>
  typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);

const normalizeAddress = (value, fallback) => (isAddress(value) ? value : fallback);

const normalizeRpcUrl = (value, fallback) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;

const normalizeChainId = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const parsed = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (!next) continue;

    if (arg === "--lulucoin-address" || arg === "--address") {
      parsed.luluCoinAddress = next;
      index += 1;
      continue;
    }

    if (arg === "--rpc-url") {
      parsed.rpcUrl = next;
      index += 1;
      continue;
    }

    if (arg === "--chain-id") {
      parsed.chainId = next;
      index += 1;
    }
  }

  return parsed;
};

const parseKeyValueFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const output = {};
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    output[key] = value;
  }

  return output;
};

const parseRuntimeConfig = () => {
  if (!fs.existsSync(runtimeConfigTarget)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(runtimeConfigTarget, "utf8"));
  } catch (error) {
    console.warn(
      `Failed to parse ${path.relative(rootDir, runtimeConfigTarget)}:`,
      error?.message || error
    );
    return {};
  }
};

const mergeEnvWithKnownKeys = (filePath, entries) => {
  const raw = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const lines = raw.length > 0 ? raw.split(/\r?\n/) : [];
  const seen = new Set();

  const merged = lines.map((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (!match) return line;

    const key = match[1];
    if (!(key in entries)) return line;

    seen.add(key);
    return `${key}=${entries[key]}`;
  });

  for (const [key, value] of Object.entries(entries)) {
    if (!seen.has(key)) {
      merged.push(`${key}=${value}`);
    }
  }

  const normalized = merged.join("\n").replace(/\n+$/, "");
  ensureDir(filePath);
  fs.writeFileSync(filePath, `${normalized}\n`);
};

const listRunLatestFiles = (dir, collector = []) => {
  if (!fs.existsSync(dir)) {
    return collector;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listRunLatestFiles(fullPath, collector);
      continue;
    }
    if (entry.isFile() && entry.name === "run-latest.json") {
      collector.push(fullPath);
    }
  }

  return collector;
};

const readBroadcastAddress = () => {
  const files = listRunLatestFiles(broadcastDir);
  if (!files.length) {
    return {};
  }

  files.sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);
  for (const file of files) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      for (const transaction of parsed.transactions || []) {
        const contractName = transaction.contractName || transaction.contract_name;
        const contractAddress =
          transaction.contractAddress || transaction.contract_address;
        if (contractName === "LuLuCoin" && isAddress(contractAddress)) {
          console.log(`Address inferred from ${path.relative(rootDir, file)}`);
          return { luluCoinAddress: contractAddress };
        }
      }
    } catch (error) {
      console.warn(`Failed to parse ${file}:`, error?.message || error);
    }
  }

  return {};
};

const loadAbi = () => {
  if (!fs.existsSync(outFile)) {
    throw new Error(`Missing foundry output: ${path.relative(rootDir, outFile)}`);
  }

  const parsed = JSON.parse(fs.readFileSync(outFile, "utf8"));
  if (!Array.isArray(parsed?.abi)) {
    throw new Error("Invalid ABI payload.");
  }
  return parsed;
};

const main = () => {
  const args = parseArgs();
  const frontendEnv = parseKeyValueFile(envTarget);
  const contractsEnv = parseKeyValueFile(contractsEnvTarget);
  const runtimeConfig = parseRuntimeConfig();
  const broadcast = readBroadcastAddress();

  const luluCoinAddress = normalizeAddress(
    args.luluCoinAddress ||
      broadcast.luluCoinAddress ||
      runtimeConfig.luluCoinAddress ||
      frontendEnv.NEXT_PUBLIC_LULUCOIN_ADDRESS ||
      contractsEnv.CONTRACT_ADDRESS,
    ZERO_ADDRESS
  );
  const rpcUrl = normalizeRpcUrl(
    args.rpcUrl || runtimeConfig.rpcUrl || frontendEnv.NEXT_PUBLIC_RPC_URL,
    DEFAULT_RPC_URL
  );
  const chainId = normalizeChainId(
    args.chainId || runtimeConfig.chainId || frontendEnv.NEXT_PUBLIC_CHAIN_ID,
    DEFAULT_CHAIN_ID
  );

  const abi = loadAbi();
  ensureDir(abiTarget);
  fs.writeFileSync(abiTarget, `${JSON.stringify(abi, null, 2)}\n`);
  console.log(`ABI synced -> ${path.relative(rootDir, abiTarget)}`);

  ensureDir(runtimeConfigTarget);
  fs.writeFileSync(
    runtimeConfigTarget,
    `${JSON.stringify({ luluCoinAddress, rpcUrl, chainId }, null, 2)}\n`
  );
  console.log(`Runtime config synced -> ${path.relative(rootDir, runtimeConfigTarget)}`);

  mergeEnvWithKnownKeys(envTarget, {
    NEXT_PUBLIC_CHAIN_ID: String(chainId),
    NEXT_PUBLIC_RPC_URL: rpcUrl,
    NEXT_PUBLIC_LULUCOIN_ADDRESS: luluCoinAddress,
  });
  console.log(`Frontend env synced -> ${path.relative(rootDir, envTarget)}`);

  mergeEnvWithKnownKeys(contractsEnvTarget, {
    CONTRACT_ADDRESS: luluCoinAddress,
  });
  console.log(`Contracts env synced -> ${path.relative(rootDir, contractsEnvTarget)}`);
};

main();
