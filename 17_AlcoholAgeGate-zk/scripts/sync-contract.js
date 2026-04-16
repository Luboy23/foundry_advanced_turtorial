const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const contractsDir = path.join(rootDir, "contracts");
const frontendDir = path.join(rootDir, "frontend");
const outDir = path.join(contractsDir, "out");
const broadcastDir = path.join(contractsDir, "broadcast");
const zkDir = path.join(rootDir, "zk");

const abiSources = [
  {
    contractName: "AlcoholRoleRegistry",
    source: path.join(outDir, "AlcoholRoleRegistry.sol", "AlcoholRoleRegistry.json"),
    target: path.join(frontendDir, "abi", "AlcoholRoleRegistry.json")
  },
  {
    contractName: "AgeCredentialRootRegistry",
    source: path.join(outDir, "AgeCredentialRootRegistry.sol", "AgeCredentialRootRegistry.json"),
    target: path.join(frontendDir, "abi", "AgeCredentialRootRegistry.json")
  },
  {
    contractName: "AlcoholAgeEligibilityVerifier",
    source: path.join(outDir, "AlcoholAgeEligibilityVerifier.sol", "AlcoholAgeEligibilityVerifier.json"),
    target: path.join(frontendDir, "abi", "AlcoholAgeEligibilityVerifier.json")
  },
  {
    contractName: "AlcoholMarketplace",
    source: path.join(outDir, "AlcoholMarketplace.sol", "AlcoholMarketplace.json"),
    target: path.join(frontendDir, "abi", "AlcoholMarketplace.json")
  }
];

const zkArtifacts = [
  {
    label: "alcohol_age_proof.wasm",
    source: path.join(zkDir, "build", "circuit", "alcohol_age_proof_js", "alcohol_age_proof.wasm"),
    target: path.join(frontendDir, "public", "zk", "alcohol_age_proof.wasm")
  },
  {
    label: "alcohol_age_proof_final.zkey",
    source: path.join(zkDir, "build", "alcohol_age_proof_final.zkey"),
    target: path.join(frontendDir, "public", "zk", "alcohol_age_proof_final.zkey")
  }
];

const generatedExamplesDir = path.join(zkDir, "data", "generated", "alcohol-age");
const frontendExamplesDir = path.join(frontendDir, "public", "examples");
const generatedPrivateCredentialsDir = path.join(generatedExamplesDir, "credentials");
const issuerBootstrapCredentialsDir = path.join(frontendDir, "server-data", "issuer", "bootstrap", "credentials");
const runtimeConfigFile = path.join(frontendDir, "public", "contract-config.json");
const envLocalFile = path.join(frontendDir, ".env.local");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const DEFAULT_CHAIN_ID = 31337;
const DEFAULT_RPC_URL = "http://127.0.0.1:8545";
const DEFAULT_DEMO_ADDRESSES = {
  issuer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  buyer: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  seller: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
};

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function isAddress(value) {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function normalizeAddress(value, fallback = ZERO_ADDRESS) {
  return isAddress(value) ? value : fallback;
}

function normalizeChainId(value, fallback = DEFAULT_CHAIN_ID) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeRpcUrl(value, fallback = DEFAULT_RPC_URL) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (!next) continue;

    if (arg === "--role-registry-address") {
      parsed.roleRegistryAddress = next;
      index += 1;
    } else if (arg === "--root-registry-address") {
      parsed.rootRegistryAddress = next;
      index += 1;
    } else if (arg === "--eligibility-verifier-address") {
      parsed.eligibilityVerifierAddress = next;
      index += 1;
    } else if (arg === "--marketplace-address") {
      parsed.marketplaceAddress = next;
      index += 1;
    } else if (arg === "--verifier-address") {
      parsed.verifierAddress = next;
      index += 1;
    } else if (arg === "--chain-id") {
      parsed.chainId = next;
      index += 1;
    } else if (arg === "--rpc-url") {
      parsed.rpcUrl = next;
      index += 1;
    }
  }

  return parsed;
}

function listRunLatestFiles(dir, collector = []) {
  if (!fs.existsSync(dir)) return collector;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listRunLatestFiles(fullPath, collector);
    } else if (entry.isFile() && entry.name === "run-latest.json") {
      collector.push(fullPath);
    }
  }

  return collector;
}

function readAddressesFromBroadcast() {
  const files = listRunLatestFiles(broadcastDir);
  if (!files.length) return {};

  files.sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);
  for (const file of files) {
    try {
      const payload = JSON.parse(fs.readFileSync(file, "utf8"));
      const output = {};

      for (const tx of payload.transactions || []) {
        const contractName = tx.contractName || tx.contract_name;
        const contractAddress = tx.contractAddress || tx.contract_address;
        if (!isAddress(contractAddress)) {
          continue;
        }

        if (contractName === "AlcoholRoleRegistry" && !output.roleRegistryAddress) {
          output.roleRegistryAddress = contractAddress;
        }
        if (contractName === "AgeCredentialRootRegistry" && !output.rootRegistryAddress) {
          output.rootRegistryAddress = contractAddress;
        }
        if (contractName === "AlcoholAgeProofVerifier" && !output.verifierAddress) {
          output.verifierAddress = contractAddress;
        }
        if (contractName === "AlcoholAgeEligibilityVerifier" && !output.eligibilityVerifierAddress) {
          output.eligibilityVerifierAddress = contractAddress;
        }
        if (contractName === "AlcoholMarketplace" && !output.marketplaceAddress) {
          output.marketplaceAddress = contractAddress;
        }
      }

      if (
        output.roleRegistryAddress ||
        output.rootRegistryAddress ||
        output.eligibilityVerifierAddress ||
        output.marketplaceAddress
      ) {
        console.log(`Address inferred from ${path.relative(rootDir, file)}`);
        return output;
      }
    } catch (error) {
      console.warn(`Failed to parse ${file}:`, error?.message || error);
    }
  }

  return {};
}

function readAbi(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing foundry output: ${path.relative(rootDir, filePath)}`);
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!Array.isArray(parsed?.abi)) {
    throw new Error(`Invalid ABI payload in ${path.relative(rootDir, filePath)}`);
  }

  return parsed.abi;
}

function syncAbis() {
  const abiDir = path.join(frontendDir, "abi");
  fs.mkdirSync(abiDir, { recursive: true });

  const allowedTargets = new Set(abiSources.map((source) => path.resolve(source.target)));
  for (const entry of fs.readdirSync(abiDir, { withFileTypes: true })) {
    if (!entry.isFile() || path.extname(entry.name) !== ".json") {
      continue;
    }
    const filePath = path.resolve(path.join(abiDir, entry.name));
    if (!allowedTargets.has(filePath)) {
      fs.rmSync(filePath);
      console.log(`Removed obsolete ABI -> ${path.relative(rootDir, filePath)}`);
    }
  }

  for (const source of abiSources) {
    const abi = readAbi(source.source);
    ensureDir(source.target);
    fs.writeFileSync(source.target, `${JSON.stringify(abi, null, 2)}\n`);
    console.log(`ABI synced (${source.contractName}) -> ${path.relative(rootDir, source.target)}`);
  }
}

function copyFile(source, target, label) {
  if (!fs.existsSync(source)) {
    throw new Error(`Missing generated asset: ${path.relative(rootDir, source)}`);
  }

  ensureDir(target);
  fs.copyFileSync(source, target);
  console.log(`${label} synced -> ${path.relative(rootDir, target)}`);
}

function syncZkArtifacts() {
  const zkTargetDir = path.join(frontendDir, "public", "zk");
  fs.mkdirSync(zkTargetDir, { recursive: true });

  const allowedTargets = new Set(zkArtifacts.map((asset) => path.resolve(asset.target)));
  for (const entry of fs.readdirSync(zkTargetDir, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }
    const filePath = path.resolve(path.join(zkTargetDir, entry.name));
    if (!allowedTargets.has(filePath)) {
      fs.rmSync(filePath);
      console.log(`Removed obsolete zk asset -> ${path.relative(rootDir, filePath)}`);
    }
  }

  for (const artifact of zkArtifacts) {
    copyFile(artifact.source, artifact.target, artifact.label);
  }
}

function syncExampleJson() {
  if (!fs.existsSync(generatedExamplesDir)) {
    throw new Error(`Missing example source directory: ${path.relative(rootDir, generatedExamplesDir)}`);
  }

  fs.mkdirSync(frontendExamplesDir, { recursive: true });
  const allowedTargets = new Set();
  const allowedExampleFiles = new Set(["sample-products.json", "sample-credential-set.json"]);

  for (const entry of fs.readdirSync(generatedExamplesDir, { withFileTypes: true })) {
    if (!entry.isFile() || path.extname(entry.name) !== ".json" || !allowedExampleFiles.has(entry.name)) {
      continue;
    }
    const source = path.join(generatedExamplesDir, entry.name);
    const target = path.join(frontendExamplesDir, entry.name);
    allowedTargets.add(path.resolve(target));
    copyFile(source, target, entry.name);
  }

  for (const entry of fs.readdirSync(frontendExamplesDir, { withFileTypes: true })) {
    if (!entry.isFile() || path.extname(entry.name) !== ".json") {
      continue;
    }
    const filePath = path.resolve(path.join(frontendExamplesDir, entry.name));
    if (!allowedTargets.has(filePath)) {
      fs.rmSync(filePath);
      console.log(`Removed obsolete example -> ${path.relative(rootDir, filePath)}`);
    }
  }
}

function syncPrivateCredentials() {
  fs.mkdirSync(issuerBootstrapCredentialsDir, { recursive: true });
  const allowedTargets = new Set();

  if (fs.existsSync(generatedPrivateCredentialsDir)) {
    for (const entry of fs.readdirSync(generatedPrivateCredentialsDir, { withFileTypes: true })) {
      if (!entry.isFile() || path.extname(entry.name) !== ".json") {
        continue;
      }

      const source = path.join(generatedPrivateCredentialsDir, entry.name);
      const target = path.join(issuerBootstrapCredentialsDir, entry.name);
      allowedTargets.add(path.resolve(target));
      copyFile(source, target, `bootstrap credential ${entry.name}`);
    }
  }

  for (const entry of fs.readdirSync(issuerBootstrapCredentialsDir, { withFileTypes: true })) {
    if (entry.name === ".gitkeep") {
      continue;
    }
    const filePath = path.resolve(path.join(issuerBootstrapCredentialsDir, entry.name));
    if (!allowedTargets.has(filePath)) {
      fs.rmSync(filePath, { recursive: true, force: true });
      console.log(`Removed obsolete bootstrap credential -> ${path.relative(rootDir, filePath)}`);
    }
  }
}

function writeRuntimeConfig(runtimeConfig) {
  ensureDir(runtimeConfigFile);
  fs.writeFileSync(runtimeConfigFile, `${JSON.stringify(runtimeConfig, null, 2)}\n`);
  console.log(`Runtime config synced -> ${path.relative(rootDir, runtimeConfigFile)}`);
}

function writeEnvLocal(runtimeConfig) {
  const envContent = [
    `NEXT_PUBLIC_CHAIN_ID=${runtimeConfig.chainId}`,
    `NEXT_PUBLIC_RPC_URL=${runtimeConfig.rpcUrl}`,
    `NEXT_PUBLIC_DEPLOYMENT_ID=${runtimeConfig.deploymentId}`,
    `NEXT_PUBLIC_ROLE_REGISTRY_ADDRESS=${runtimeConfig.roleRegistryAddress}`,
    `NEXT_PUBLIC_ROOT_REGISTRY_ADDRESS=${runtimeConfig.rootRegistryAddress}`,
    `NEXT_PUBLIC_ELIGIBILITY_VERIFIER_ADDRESS=${runtimeConfig.eligibilityVerifierAddress}`,
    `NEXT_PUBLIC_MARKETPLACE_ADDRESS=${runtimeConfig.marketplaceAddress}`,
    `NEXT_PUBLIC_VERIFIER_ADDRESS=${runtimeConfig.verifierAddress}`
  ].join("\n");

  fs.writeFileSync(envLocalFile, `${envContent}\n`);
  console.log(`Frontend env synced -> ${path.relative(rootDir, envLocalFile)}`);
}

function main() {
  const args = parseArgs();
  const broadcast = readAddressesFromBroadcast();
  const deploymentId = new Date().toISOString();

  const runtimeConfig = {
    roleRegistryAddress: normalizeAddress(args.roleRegistryAddress || broadcast.roleRegistryAddress),
    rootRegistryAddress: normalizeAddress(args.rootRegistryAddress || broadcast.rootRegistryAddress),
    eligibilityVerifierAddress: normalizeAddress(
      args.eligibilityVerifierAddress || broadcast.eligibilityVerifierAddress
    ),
    marketplaceAddress: normalizeAddress(args.marketplaceAddress || broadcast.marketplaceAddress),
    verifierAddress: normalizeAddress(args.verifierAddress || broadcast.verifierAddress),
    chainId: normalizeChainId(args.chainId),
    rpcUrl: normalizeRpcUrl(args.rpcUrl),
    deploymentId,
    demoAddresses: DEFAULT_DEMO_ADDRESSES,
    zkArtifactPaths: {
      wasm: "/zk/alcohol_age_proof.wasm",
      zkey: "/zk/alcohol_age_proof_final.zkey"
    }
  };

  syncAbis();
  syncZkArtifacts();
  syncExampleJson();
  syncPrivateCredentials();
  writeRuntimeConfig(runtimeConfig);
  writeEnvLocal(runtimeConfig);
}

main();
