const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const contractsDir = path.join(rootDir, "contracts");
const frontendDir = path.join(rootDir, "frontend");
const outDir = path.join(contractsDir, "out");
const broadcastDir = path.join(contractsDir, "broadcast");

const artifacts = [
  {
    contractName: "MyNFT",
    source: path.join(outDir, "MyNFT.sol", "MyNFT.json"),
    target: path.join(frontendDir, "src", "lib", "generated", "nft-abi.json"),
  },
  {
    contractName: "FixedPriceMarket",
    source: path.join(
      outDir,
      "FixedPriceMarket.sol",
      "FixedPriceMarket.json"
    ),
    target: path.join(frontendDir, "src", "lib", "generated", "market-abi.json"),
  },
];

const runtimeConfigFile = path.join(frontendDir, "public", "contract-config.json");
const envFile = path.join(frontendDir, ".env.local");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const DEFAULT_RPC_URL = "http://127.0.0.1:8545";
const DEFAULT_CHAIN_ID = 31337;

const ensureDir = (filePath) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
};

const isAddress = (value) =>
  typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);

const parseArgs = () => {
  const args = process.argv.slice(2);
  const parsed = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const next = args[i + 1];
    if (!next) continue;

    if (arg === "--nft-address") {
      parsed.nftAddress = next;
      i += 1;
    } else if (arg === "--market-address") {
      parsed.marketAddress = next;
      i += 1;
    } else if (arg === "--rpc-url") {
      parsed.rpcUrl = next;
      i += 1;
    } else if (arg === "--chain-id") {
      parsed.chainId = next;
      i += 1;
    }
  }

  return parsed;
};

const parseKeyValueFile = (filePath) => {
  if (!fs.existsSync(filePath)) return {};

  const result = {};
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index <= 0) continue;
    result[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return result;
};

const parseRuntimeConfig = () => {
  if (!fs.existsSync(runtimeConfigFile)) return {};
  try {
    return JSON.parse(fs.readFileSync(runtimeConfigFile, "utf8"));
  } catch (error) {
    console.warn(`Failed to parse runtime config: ${error.message}`);
    return {};
  }
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

const readAddressesFromBroadcast = () => {
  const files = listRunLatestFiles(broadcastDir);
  files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

  for (const filePath of files) {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const addresses = {};
      for (const tx of parsed.transactions ?? []) {
        const contractName = tx.contractName || tx.contract_name;
        const contractAddress = tx.contractAddress || tx.contract_address;
        if (!isAddress(contractAddress)) continue;
        if (contractName === "MyNFT" && !addresses.nftAddress) {
          addresses.nftAddress = contractAddress;
        }
        if (contractName === "FixedPriceMarket" && !addresses.marketAddress) {
          addresses.marketAddress = contractAddress;
        }
      }
      if (addresses.nftAddress || addresses.marketAddress) {
        console.log(
          `Contract addresses inferred from ${path.relative(rootDir, filePath)}`
        );
        return addresses;
      }
    } catch (error) {
      console.warn(`Failed to parse ${filePath}: ${error.message}`);
    }
  }

  return {};
};

const syncAbis = () => {
  for (const artifact of artifacts) {
    if (!fs.existsSync(artifact.source)) {
      throw new Error(`Missing foundry artifact: ${path.relative(rootDir, artifact.source)}`);
    }
    const parsed = JSON.parse(fs.readFileSync(artifact.source, "utf8"));
    if (!Array.isArray(parsed.abi)) {
      throw new Error(`${artifact.contractName} artifact does not contain a valid ABI.`);
    }
    ensureDir(artifact.target);
    fs.writeFileSync(artifact.target, `${JSON.stringify(parsed.abi, null, 2)}\n`);
    console.log(`ABI synced -> ${path.relative(rootDir, artifact.target)}`);
  }
};

const normalizeRpcUrl = (value) =>
  typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : DEFAULT_RPC_URL;

const normalizeChainId = (value) => {
  const chainId = Number(value);
  return Number.isFinite(chainId) && chainId > 0
    ? chainId
    : DEFAULT_CHAIN_ID;
};

const mergeEnvFile = (nextValues) => {
  const existing = fs.existsSync(envFile)
    ? fs.readFileSync(envFile, "utf8").split(/\r?\n/)
    : [];
  const managedKeys = new Set(Object.keys(nextValues));
  const preserved = existing.filter((line) => {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) {
      return line.length > 0;
    }
    const key = line.slice(0, line.indexOf("=")).trim();
    return !managedKeys.has(key);
  });

  const nextLines = [
    ...preserved,
    ...Object.entries(nextValues).map(([key, value]) => `${key}=${value}`),
    "",
  ];

  ensureDir(envFile);
  fs.writeFileSync(envFile, nextLines.join("\n"));
  console.log(`Env synced -> ${path.relative(rootDir, envFile)}`);
};

const main = () => {
  const cliArgs = parseArgs();
  const envConfig = parseKeyValueFile(envFile);
  const runtimeConfig = parseRuntimeConfig();
  const broadcastAddresses = readAddressesFromBroadcast();

  const nftAddress =
    cliArgs.nftAddress ||
    broadcastAddresses.nftAddress ||
    runtimeConfig.nftAddress ||
    envConfig.NEXT_PUBLIC_NFT_ADDRESS ||
    ZERO_ADDRESS;
  const marketAddress =
    cliArgs.marketAddress ||
    broadcastAddresses.marketAddress ||
    runtimeConfig.marketAddress ||
    envConfig.NEXT_PUBLIC_MARKET_ADDRESS ||
    ZERO_ADDRESS;
  const rpcUrl = normalizeRpcUrl(
    cliArgs.rpcUrl || runtimeConfig.rpcUrl || envConfig.NEXT_PUBLIC_RPC_URL
  );
  const chainId = normalizeChainId(
    cliArgs.chainId || runtimeConfig.chainId || envConfig.NEXT_PUBLIC_CHAIN_ID
  );

  syncAbis();

  ensureDir(runtimeConfigFile);
  fs.writeFileSync(
    runtimeConfigFile,
    `${JSON.stringify(
      {
        nftAddress: isAddress(nftAddress) ? nftAddress : ZERO_ADDRESS,
        marketAddress: isAddress(marketAddress) ? marketAddress : ZERO_ADDRESS,
        rpcUrl,
        chainId,
      },
      null,
      2
    )}\n`
  );
  console.log(`Runtime config -> ${path.relative(rootDir, runtimeConfigFile)}`);

  mergeEnvFile({
    NEXT_PUBLIC_NFT_ADDRESS: isAddress(nftAddress) ? nftAddress : ZERO_ADDRESS,
    NEXT_PUBLIC_MARKET_ADDRESS: isAddress(marketAddress)
      ? marketAddress
      : ZERO_ADDRESS,
    NEXT_PUBLIC_RPC_URL: rpcUrl,
    NEXT_PUBLIC_CHAIN_ID: String(chainId),
  });
};

main();
