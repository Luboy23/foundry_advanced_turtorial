const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const contractsDir = path.join(rootDir, "contracts");
const frontendDir = path.join(rootDir, "frontend");
const outDir = path.join(contractsDir, "out");
const broadcastDir = path.join(contractsDir, "broadcast");

const artifacts = [
  {
    contractName: "EventFactory",
    source: path.join(outDir, "EventFactory.sol", "EventFactory.json"),
    target: path.join(frontendDir, "src", "abi", "EventFactory.json"),
  },
  {
    contractName: "PositionToken",
    source: path.join(outDir, "PositionToken.sol", "PositionToken.json"),
    target: path.join(frontendDir, "src", "abi", "PositionToken.json"),
  },
  {
    contractName: "ETHCollateralVault",
    source: path.join(outDir, "ETHCollateralVault.sol", "ETHCollateralVault.json"),
    target: path.join(frontendDir, "src", "abi", "ETHCollateralVault.json"),
  },
  {
    contractName: "OracleAdapterMock",
    source: path.join(outDir, "OracleAdapterMock.sol", "OracleAdapterMock.json"),
    target: path.join(frontendDir, "src", "abi", "OracleAdapterMock.json"),
  },
];

const runtimeConfigFile = path.join(frontendDir, "public", "contract-config.json");
const envFile = path.join(frontendDir, ".env.local");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const DEFAULT_RPC_URL = "http://127.0.0.1:8545";
const DEFAULT_CHAIN_ID = 31337;
const DEFAULT_PROJECT_GITHUB = "https://github.com/lllu23/foundry_advanced_turtorial";

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

    if (arg === "--event-factory-address") {
      parsed.eventFactoryAddress = next;
      i += 1;
    } else if (arg === "--position-token-address") {
      parsed.positionTokenAddress = next;
      i += 1;
    } else if (arg === "--eth-collateral-vault-address") {
      parsed.ethCollateralVaultAddress = next;
      i += 1;
    } else if (arg === "--oracle-adapter-address") {
      parsed.oracleAdapterAddress = next;
      i += 1;
    } else if (arg === "--rpc-url") {
      parsed.rpcUrl = next;
      i += 1;
    } else if (arg === "--chain-id") {
      parsed.chainId = next;
      i += 1;
    } else if (arg === "--project-github") {
      parsed.projectGithub = next;
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

        if (contractName === "EventFactory" && !addresses.eventFactoryAddress) {
          addresses.eventFactoryAddress = contractAddress;
        }
        if (contractName === "PositionToken" && !addresses.positionTokenAddress) {
          addresses.positionTokenAddress = contractAddress;
        }
        if (
          contractName === "ETHCollateralVault" &&
          !addresses.ethCollateralVaultAddress
        ) {
          addresses.ethCollateralVaultAddress = contractAddress;
        }
        if (
          contractName === "OracleAdapterMock" &&
          !addresses.oracleAdapterAddress
        ) {
          addresses.oracleAdapterAddress = contractAddress;
        }
      }

      if (
        addresses.eventFactoryAddress ||
        addresses.positionTokenAddress ||
        addresses.ethCollateralVaultAddress ||
        addresses.oracleAdapterAddress
      ) {
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

  const eventFactoryAddress =
    cliArgs.eventFactoryAddress ||
    broadcastAddresses.eventFactoryAddress ||
    runtimeConfig.eventFactoryAddress ||
    envConfig.NEXT_PUBLIC_EVENT_FACTORY_ADDRESS ||
    ZERO_ADDRESS;
  const positionTokenAddress =
    cliArgs.positionTokenAddress ||
    broadcastAddresses.positionTokenAddress ||
    runtimeConfig.positionTokenAddress ||
    envConfig.NEXT_PUBLIC_POSITION_TOKEN_ADDRESS ||
    ZERO_ADDRESS;
  const ethCollateralVaultAddress =
    cliArgs.ethCollateralVaultAddress ||
    broadcastAddresses.ethCollateralVaultAddress ||
    runtimeConfig.ethCollateralVaultAddress ||
    envConfig.NEXT_PUBLIC_ETH_COLLATERAL_VAULT_ADDRESS ||
    ZERO_ADDRESS;
  const oracleAdapterAddress =
    cliArgs.oracleAdapterAddress ||
    broadcastAddresses.oracleAdapterAddress ||
    runtimeConfig.oracleAdapterAddress ||
    envConfig.NEXT_PUBLIC_ORACLE_ADAPTER_ADDRESS ||
    ZERO_ADDRESS;
  const rpcUrl = normalizeRpcUrl(
    cliArgs.rpcUrl || runtimeConfig.rpcUrl || envConfig.NEXT_PUBLIC_RPC_URL
  );
  const chainId = normalizeChainId(
    cliArgs.chainId || runtimeConfig.chainId || envConfig.NEXT_PUBLIC_CHAIN_ID
  );
  const projectGithub =
    cliArgs.projectGithub ||
    runtimeConfig.projectGithub ||
    envConfig.NEXT_PUBLIC_PROJECT_GITHUB ||
    DEFAULT_PROJECT_GITHUB;

  syncAbis();

  ensureDir(runtimeConfigFile);
  fs.writeFileSync(
    runtimeConfigFile,
    `${JSON.stringify(
      {
        rpcUrl,
        chainId,
        projectGithub,
        eventFactoryAddress: isAddress(eventFactoryAddress)
          ? eventFactoryAddress
          : ZERO_ADDRESS,
        positionTokenAddress: isAddress(positionTokenAddress)
          ? positionTokenAddress
          : ZERO_ADDRESS,
        ethCollateralVaultAddress: isAddress(ethCollateralVaultAddress)
          ? ethCollateralVaultAddress
          : ZERO_ADDRESS,
        oracleAdapterAddress: isAddress(oracleAdapterAddress)
          ? oracleAdapterAddress
          : ZERO_ADDRESS,
      },
      null,
      2
    )}\n`
  );
  console.log(`Runtime config -> ${path.relative(rootDir, runtimeConfigFile)}`);

  mergeEnvFile({
    NEXT_PUBLIC_RPC_URL: rpcUrl,
    NEXT_PUBLIC_CHAIN_ID: String(chainId),
    NEXT_PUBLIC_PROJECT_GITHUB: projectGithub,
    NEXT_PUBLIC_EVENT_FACTORY_ADDRESS: isAddress(eventFactoryAddress)
      ? eventFactoryAddress
      : ZERO_ADDRESS,
    NEXT_PUBLIC_POSITION_TOKEN_ADDRESS: isAddress(positionTokenAddress)
      ? positionTokenAddress
      : ZERO_ADDRESS,
    NEXT_PUBLIC_ETH_COLLATERAL_VAULT_ADDRESS: isAddress(ethCollateralVaultAddress)
      ? ethCollateralVaultAddress
      : ZERO_ADDRESS,
    NEXT_PUBLIC_ORACLE_ADAPTER_ADDRESS: isAddress(oracleAdapterAddress)
      ? oracleAdapterAddress
      : ZERO_ADDRESS,
  });
};

main();
