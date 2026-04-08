const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const contractsDir = path.join(rootDir, "contracts");
const outFile = path.join(
  contractsDir,
  "out",
  "DownManScoreboard.sol",
  "DownManScoreboard.json"
);
const broadcastDir = path.join(contractsDir, "broadcast");
const abiTarget = path.join(rootDir, "frontend", "src", "lib", "downman.abi.json");
const runtimeConfigTarget = path.join(
  rootDir,
  "frontend",
  "public",
  "contract-config.json"
);
const envTarget = path.join(rootDir, "frontend", ".env.local");

const DEFAULT_RPC_URL = "http://127.0.0.1:8545";
const DEFAULT_CHAIN_ID = "31337";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const parseArgs = () => {
  const args = process.argv.slice(2);
  const output = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if ((arg === "--scoreboard-address" || arg === "--address") && args[i + 1]) {
      output.scoreboardAddress = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--rpc-url" && args[i + 1]) {
      output.rpcUrl = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--chain-id" && args[i + 1]) {
      output.chainId = args[i + 1];
      i += 1;
      continue;
    }
  }

  return output;
};

const ensureDir = (filePath) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
};

const isAddress = (value) =>
  typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);

const mergeEnvWithKnownKeys = (filePath, knownEntries) => {
  const nextKeys = Object.keys(knownEntries);
  const raw = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, "utf8")
    : "";
  const lines = raw.length > 0 ? raw.split(/\r?\n/) : [];
  const seen = new Set();

  const merged = lines.map((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (!match) {
      return line;
    }

    const key = match[1];
    if (!(key in knownEntries)) {
      return line;
    }

    seen.add(key);
    return `${key}=${knownEntries[key]}`;
  });

  for (const key of nextKeys) {
    if (!seen.has(key)) {
      merged.push(`${key}=${knownEntries[key]}`);
    }
  }

  const normalized = merged.join("\n").replace(/\n+$/, "");
  fs.writeFileSync(filePath, `${normalized}\n`);
};

const loadAbi = () => {
  if (!fs.existsSync(outFile)) {
    console.error(`Missing foundry output: ${outFile}`);
    process.exit(1);
  }

  const parsed = JSON.parse(fs.readFileSync(outFile, "utf8"));
  if (!Array.isArray(parsed.abi)) {
    console.error("Invalid ABI in foundry output.");
    process.exit(1);
  }

  return parsed.abi;
};

const listRunLatestFiles = (dir, files = []) => {
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listRunLatestFiles(fullPath, files);
    } else if (entry.isFile() && entry.name === "run-latest.json") {
      files.push(fullPath);
    }
  }

  return files;
};

const readAddressFromBroadcast = () => {
  const files = listRunLatestFiles(broadcastDir);
  files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

  for (const filePath of files) {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      for (const tx of parsed.transactions ?? []) {
        const contractName = tx.contractName || tx.contract_name;
        const contractAddress = tx.contractAddress || tx.contract_address;
        if (contractName === "DownManScoreboard" && isAddress(contractAddress)) {
          console.log(
            `Scoreboard address inferred from ${path.relative(rootDir, filePath)}`
          );
          return contractAddress;
        }
      }
    } catch (error) {
      console.warn(`Failed to parse ${filePath}: ${error.message}`);
    }
  }

  return undefined;
};

const parseEnvFile = () => {
  if (!fs.existsSync(envTarget)) return {};

  const result = {};
  const content = fs.readFileSync(envTarget, "utf8");
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index <= 0) continue;
    result[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return result;
};

const parseRuntimeConfig = () => {
  if (!fs.existsSync(runtimeConfigTarget)) return {};
  try {
    return JSON.parse(fs.readFileSync(runtimeConfigTarget, "utf8"));
  } catch (error) {
    console.warn(`Failed to parse runtime config: ${error.message}`);
    return {};
  }
};

const main = () => {
  const args = parseArgs();
  const env = parseEnvFile();
  const runtime = parseRuntimeConfig();
  const abi = loadAbi();

  ensureDir(abiTarget);
  fs.writeFileSync(abiTarget, JSON.stringify(abi, null, 2));
  console.log(`ABI synced -> ${path.relative(rootDir, abiTarget)}`);

  const address =
    args.scoreboardAddress ||
    readAddressFromBroadcast() ||
    runtime.downManScoreboardAddress ||
    runtime.address ||
    env.VITE_DOWNMAN_ADDRESS ||
    ZERO_ADDRESS;
  const rpcUrl = args.rpcUrl || process.env.RPC_URL || DEFAULT_RPC_URL;
  const chainId = args.chainId || process.env.CHAIN_ID || DEFAULT_CHAIN_ID;
  const resolvedAddress = isAddress(address) ? address : ZERO_ADDRESS;

  ensureDir(runtimeConfigTarget);
  fs.writeFileSync(
    runtimeConfigTarget,
    JSON.stringify(
      {
        downManScoreboardAddress: resolvedAddress,
        address: resolvedAddress,
        rpcUrl,
        chainId: Number(chainId),
      },
      null,
      2
    )
  );
  console.log(`Runtime config synced -> ${path.relative(rootDir, runtimeConfigTarget)}`);

  ensureDir(envTarget);
  mergeEnvWithKnownKeys(envTarget, {
    VITE_CHAIN_ID: chainId,
    VITE_RPC_URL: rpcUrl,
    VITE_DOWNMAN_ADDRESS: resolvedAddress,
  });
  console.log(`Env synced -> ${path.relative(rootDir, envTarget)}`);
};

main();
