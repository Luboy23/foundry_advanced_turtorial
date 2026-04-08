const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const outFile = path.join(
  rootDir,
  "contracts",
  "out",
  "SnakeScoreboard.sol",
  "SnakeScoreboard.json"
);
const abiTarget = path.join(rootDir, "frontend", "lib", "scoreboard.abi.json");
const addressTarget = path.join(
  rootDir,
  "frontend",
  "lib",
  "scoreboard.address.json"
);
const runtimeConfigTarget = path.join(
  rootDir,
  "frontend",
  "public",
  "contract-config.json"
);
const legacyRuntimeTarget = path.join(
  rootDir,
  "frontend",
  "public",
  "scoreboard.json"
);
const envFile = path.join(rootDir, "frontend", ".env.local");
const broadcastDir = path.join(
  rootDir,
  "contracts",
  "broadcast",
  "DeploySnakeScoreboard.s.sol"
);
const DEFAULT_RPC_URL = "http://127.0.0.1:8545";
const DEFAULT_CHAIN_ID = "31337";

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

const loadAddressFromEnv = () => {
  if (!fs.existsSync(envFile)) return "";
  const content = fs.readFileSync(envFile, "utf8");
  const match = content.match(/^NEXT_PUBLIC_SCOREBOARD_ADDRESS=(.*)$/m);
  return match ? match[1].trim() : "";
};

const loadRpcUrlFromEnv = () => {
  if (!fs.existsSync(envFile)) return "";
  const content = fs.readFileSync(envFile, "utf8");
  const match =
    content.match(/^NEXT_PUBLIC_RPC_URL=(.*)$/m) ||
    content.match(/^NEXT_PUBLIC_ANVIL_RPC_URL=(.*)$/m);
  return match ? match[1].trim() : "";
};

const findLatestRunFile = () => {
  if (!fs.existsSync(broadcastDir)) return "";
  const chainDirs = fs
    .readdirSync(broadcastDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(broadcastDir, entry.name, "run-latest.json"))
    .filter((filePath) => fs.existsSync(filePath));

  if (!chainDirs.length) return "";
  chainDirs.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return chainDirs[0];
};

const readAddressFromRun = (filePath) => {
  if (!filePath || !fs.existsSync(filePath)) return "";
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (Array.isArray(data?.transactions)) {
      const named = data.transactions.find(
        (tx) =>
          tx?.contractName === "SnakeScoreboard" &&
          (tx?.contractAddress || tx?.contract_address)
      );
      if (named?.contractAddress || named?.contract_address) {
        return named.contractAddress || named.contract_address;
      }
    }
  } catch (error) {
    console.warn(`Failed to parse ${filePath}:`, error?.message || error);
  }
  return "";
};

const ensureDir = (filePath) => {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
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

const main = () => {
  if (!fs.existsSync(outFile)) {
    console.error(
      `Missing foundry output: ${outFile}. Run forge build/deploy first.`
    );
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
  console.log(`ABI synced → ${path.relative(rootDir, abiTarget)}`);

  const args = parseArgs();
  let address = args.address;
  if (!address) {
    const latestRun = findLatestRunFile();
    address = readAddressFromRun(latestRun);
    if (address) {
      console.log(`Address inferred from ${path.relative(rootDir, latestRun)}`);
    }
  }
  if (!address) {
    address = loadAddressFromEnv();
  }

  const rpcUrl = args.rpcUrl || loadRpcUrlFromEnv() || DEFAULT_RPC_URL;
  const chainId = args.chainId || DEFAULT_CHAIN_ID;

  if (!address) {
    console.warn("Address not found; skipped writing address file.");
    return;
  }

  ensureDir(addressTarget);
  fs.writeFileSync(addressTarget, JSON.stringify({ address }, null, 2));
  console.log(`Address synced → ${path.relative(rootDir, addressTarget)}`);

  ensureDir(runtimeConfigTarget);
  fs.writeFileSync(
    runtimeConfigTarget,
    JSON.stringify(
      {
        scoreboardAddress: address,
        rpcUrl,
        chainId: Number(chainId),
      },
      null,
      2
    )
  );
  console.log(`Runtime config → ${path.relative(rootDir, runtimeConfigTarget)}`);

  ensureDir(legacyRuntimeTarget);
  fs.writeFileSync(
    legacyRuntimeTarget,
    JSON.stringify({ address, rpcUrl }, null, 2)
  );
  console.log(`Legacy runtime config → ${path.relative(rootDir, legacyRuntimeTarget)}`);

  ensureDir(envFile);
  mergeEnvWithKnownKeys(envFile, {
    NEXT_PUBLIC_CHAIN_ID: chainId,
    NEXT_PUBLIC_RPC_URL: rpcUrl,
    NEXT_PUBLIC_ANVIL_RPC_URL: rpcUrl,
    NEXT_PUBLIC_SCOREBOARD_ADDRESS: address,
  });
  console.log(`Env synced → ${path.relative(rootDir, envFile)}`);
};

main();
