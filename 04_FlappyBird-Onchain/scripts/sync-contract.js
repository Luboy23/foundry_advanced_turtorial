const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const outFile = path.join(
  rootDir,
  "contracts",
  "out",
  "FlappyScoreboard.sol",
  "FlappyScoreboard.json"
);
const abiTarget = path.join(rootDir, "frontend", "src", "lib", "flappy.abi.json");
const legacyAbiTarget = path.join(
  rootDir,
  "frontend",
  "components",
  "Web3",
  "flappyScore.abi.json"
);
const legacyAddressTarget = path.join(
  rootDir,
  "frontend",
  "components",
  "Web3",
  "flappyScore.address.json"
);
const runtimeConfigTarget = path.join(
  rootDir,
  "frontend",
  "public",
  "contract-config.json"
);
const envTarget = path.join(rootDir, "frontend", ".env.local");
const broadcastDir = path.join(rootDir, "contracts", "broadcast");

const DEFAULT_RPC_URL = "http://127.0.0.1:8545";
const DEFAULT_CHAIN_ID = "31337";

const ensureDir = (filePath) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const output = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--address" && args[i + 1]) {
      output.address = args[i + 1];
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
    }
  }

  return output;
};

const loadEnvValue = (key) => {
  if (!fs.existsSync(envTarget)) return "";
  const content = fs.readFileSync(envTarget, "utf8");
  const match = content.match(new RegExp(`^${key}=(.*)$`, "m"));
  return match ? match[1].trim() : "";
};

const listRunLatestFiles = (dir, collector = []) => {
  if (!fs.existsSync(dir)) return collector;
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

const readAddressFromBroadcast = () => {
  const files = listRunLatestFiles(broadcastDir);
  if (!files.length) return "";

  files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  for (const filePath of files) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      for (const tx of data.transactions || []) {
        const contractName = tx?.contractName || tx?.contract_name;
        const contractAddress = tx?.contractAddress || tx?.contract_address;
        if (contractName === "FlappyScoreboard" && contractAddress) {
          console.log(`Address inferred from ${path.relative(rootDir, filePath)}`);
          return contractAddress;
        }
      }
    } catch (error) {
      console.warn(`Failed to parse ${filePath}:`, error?.message || error);
    }
  }

  return "";
};

const mergeEnvWithKnownKeys = (filePath, knownEntries) => {
  const nextKeys = Object.keys(knownEntries);
  const raw = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const lines = raw.length > 0 ? raw.split(/\r?\n/) : [];
  const seen = new Set();

  const merged = lines.map((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (!match) return line;
    const key = match[1];
    if (!(key in knownEntries)) return line;
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

const main = () => {
  if (!fs.existsSync(outFile)) {
    console.error(`Missing foundry output: ${outFile}. Run forge build/deploy first.`);
    process.exit(1);
  }

  const parsed = JSON.parse(fs.readFileSync(outFile, "utf8"));
  const abi = parsed.abi;
  if (!abi || !Array.isArray(abi)) {
    console.error("Invalid ABI in foundry output.");
    process.exit(1);
  }

  ensureDir(abiTarget);
  fs.writeFileSync(abiTarget, JSON.stringify(abi, null, 2));
  console.log(`ABI synced -> ${path.relative(rootDir, abiTarget)}`);

  ensureDir(legacyAbiTarget);
  fs.writeFileSync(legacyAbiTarget, JSON.stringify(abi, null, 2));
  console.log(`Legacy ABI synced -> ${path.relative(rootDir, legacyAbiTarget)}`);

  const args = parseArgs();
  const address =
    args.address ||
    readAddressFromBroadcast() ||
    loadEnvValue("VITE_FLAPPY_SCORE_ADDRESS");
  const rpcUrl =
    args.rpcUrl ||
    loadEnvValue("VITE_RPC_URL") ||
    loadEnvValue("VITE_ANVIL_RPC_URL") ||
    DEFAULT_RPC_URL;
  const chainId = args.chainId || loadEnvValue("VITE_CHAIN_ID") || DEFAULT_CHAIN_ID;

  if (!address) {
    console.warn("Address not found; skipped runtime/env sync.");
    return;
  }

  ensureDir(runtimeConfigTarget);
  fs.writeFileSync(
    runtimeConfigTarget,
    JSON.stringify(
      {
        flappyScoreAddress: address,
        rpcUrl,
        chainId: Number(chainId),
      },
      null,
      2
    )
  );
  console.log(`Runtime config synced -> ${path.relative(rootDir, runtimeConfigTarget)}`);

  ensureDir(legacyAddressTarget);
  fs.writeFileSync(legacyAddressTarget, JSON.stringify({ address }, null, 2));
  console.log(`Legacy address synced -> ${path.relative(rootDir, legacyAddressTarget)}`);

  ensureDir(envTarget);
  mergeEnvWithKnownKeys(envTarget, {
    VITE_CHAIN_ID: chainId,
    VITE_RPC_URL: rpcUrl,
    VITE_ANVIL_RPC_URL: rpcUrl,
    VITE_FLAPPY_SCORE_ADDRESS: address,
  });
  console.log(`Env synced -> ${path.relative(rootDir, envTarget)}`);
};

main();
