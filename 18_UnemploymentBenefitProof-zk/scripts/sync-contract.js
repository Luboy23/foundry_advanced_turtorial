const fs = require("fs");
const path = require("path");

/**
 * 把合约编译产物、zk 资源、样例数据和运行时配置同步到正式前端。
 *
 * 这个脚本是 contracts / zk / frontend 三层之间的桥梁：
 * - 读取 Foundry 输出目录与 broadcast 记录；
 * - 拷贝 ABI、wasm、zkey、公开样例和私有凭证样例；
 * - 推导 contract-config.json 与 .env.local，确保前端运行时配置保持一致。
 */
const rootDir = path.resolve(__dirname, "..");
const contractsDir = path.join(rootDir, "contracts");
const frontendDir = path.join(rootDir, "frontend");
const outDir = path.join(contractsDir, "out");
const broadcastDir = path.join(contractsDir, "broadcast");
const zkDir = path.join(rootDir, "zk");

const abiSources = [
  {
    contractName: "BenefitRoleRegistry",
    source: path.join(outDir, "BenefitRoleRegistry.sol", "BenefitRoleRegistry.json"),
    target: path.join(frontendDir, "abi", "BenefitRoleRegistry.json")
  },
  {
    contractName: "UnemploymentCredentialRootRegistry",
    source: path.join(outDir, "UnemploymentCredentialRootRegistry.sol", "UnemploymentCredentialRootRegistry.json"),
    target: path.join(frontendDir, "abi", "UnemploymentCredentialRootRegistry.json")
  },
  {
    contractName: "UnemploymentBenefitDistributor",
    source: path.join(outDir, "UnemploymentBenefitDistributor.sol", "UnemploymentBenefitDistributor.json"),
    target: path.join(frontendDir, "abi", "UnemploymentBenefitDistributor.json")
  }
];

const zkArtifacts = [
  {
    label: "unemployment_benefit_proof.wasm",
    source: path.join(
      zkDir,
      "build",
      "circuit",
      "unemployment_benefit_proof_js",
      "unemployment_benefit_proof.wasm"
    ),
    target: path.join(frontendDir, "public", "zk", "unemployment_benefit_proof.wasm")
  },
  {
    label: "unemployment_benefit_proof_final.zkey",
    source: path.join(zkDir, "build", "unemployment_benefit_proof_final.zkey"),
    target: path.join(frontendDir, "public", "zk", "unemployment_benefit_proof_final.zkey")
  }
];

const generatedExamplesDir = path.join(zkDir, "data", "generated", "unemployment-benefit");
const frontendExamplesDir = path.join(frontendDir, "public", "examples");
const generatedPrivateCredentialsDir = path.join(generatedExamplesDir, "credentials");
const frontendPrivateCredentialsDir = path.join(frontendDir, "server-data", "credentials");
const runtimeConfigFile = path.join(frontendDir, "public", "contract-config.json");
const envLocalFile = path.join(frontendDir, ".env.local");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const DEFAULT_CHAIN_ID = 31337;
const DEFAULT_RPC_URL = "http://127.0.0.1:8545";
const DEFAULT_DEMO_ADDRESSES = {
  government: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  applicant: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  agency: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  ineligibleApplicant: "0x90F79bf6EB2c4f870365E785982E1f101E93b906"
};

const exampleFiles = [
  "current-credential-set-v1.json",
  "current-credential-set-v2.json",
  "sample-program.json"
];

/** 确保目标文件所在目录存在，避免写文件前因为目录缺失报错。 */
function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

/** 判断输入是否是合法的 EVM 地址字符串。 */
function isAddress(value) {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

/** 把地址标准化为可写入前端配置的值；无效时回退到零地址。 */
function normalizeAddress(value, fallback = ZERO_ADDRESS) {
  return isAddress(value) ? value : fallback;
}

/** 解析链 ID，异常时回退到本地教学链。 */
function normalizeChainId(value, fallback = DEFAULT_CHAIN_ID) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** 解析 RPC URL，空值时回退到默认 Anvil 地址。 */
function normalizeRpcUrl(value, fallback = DEFAULT_RPC_URL) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

/** 解析脚本参数，优先接受显式传入的合约地址和链配置。 */
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
    } else if (arg === "--benefit-distributor-address") {
      parsed.benefitDistributorAddress = next;
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

/** 递归收集 Foundry broadcast 目录里的 `run-latest.json`。 */
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

/**
 * 从最近一次 broadcast 里推断合约地址。
 *
 * 这样做的目的是让 `make deploy` 后无需手工把四个地址再抄回前端，教学链和本地联调都能少
 * 一步人工同步。
 */
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

        if (contractName === "BenefitRoleRegistry" && !output.roleRegistryAddress) {
          output.roleRegistryAddress = contractAddress;
        }
        if (contractName === "UnemploymentCredentialRootRegistry" && !output.rootRegistryAddress) {
          output.rootRegistryAddress = contractAddress;
        }
        if (contractName === "UnemploymentBenefitProofVerifier" && !output.verifierAddress) {
          output.verifierAddress = contractAddress;
        }
        if (contractName === "UnemploymentBenefitDistributor" && !output.benefitDistributorAddress) {
          output.benefitDistributorAddress = contractAddress;
        }
      }

      if (
        output.roleRegistryAddress ||
        output.rootRegistryAddress ||
        output.benefitDistributorAddress ||
        output.verifierAddress
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

/** 兼容十进制和十六进制 block number 写法。 */
function parseBroadcastBlockNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed =
    typeof value === "string" && value.startsWith("0x")
      ? Number.parseInt(value, 16)
      : Number(value);

  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

/** 从部署回执里推导最早区块号，供前端事件查询缩小扫描范围。 */
function readDeploymentStartBlockFromBroadcast() {
  const files = listRunLatestFiles(broadcastDir);
  if (!files.length) return undefined;

  files.sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);
  for (const file of files) {
    try {
      const payload = JSON.parse(fs.readFileSync(file, "utf8"));
      const blockNumbers = (payload.receipts || [])
        .map((receipt) => parseBroadcastBlockNumber(receipt.blockNumber))
        .filter((value) => value !== null);

      if (blockNumbers.length) {
        console.log(`Deployment start block inferred from ${path.relative(rootDir, file)}`);
        return Math.min(...blockNumbers);
      }
    } catch (error) {
      console.warn(`Failed to parse ${file}:`, error?.message || error);
    }
  }

  return undefined;
}

/** 读取 Foundry 输出里的 ABI；格式不符合预期时直接失败，避免前端吃到半成品。 */
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

/** 清理并重新同步正式前端使用的 ABI 列表。 */
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

/** 拷贝单个生成文件到目标位置，并输出统一日志。 */
function copyFile(source, target, label) {
  if (!fs.existsSync(source)) {
    throw new Error(`Missing generated asset: ${path.relative(rootDir, source)}`);
  }

  ensureDir(target);
  fs.copyFileSync(source, target);
  console.log(`${label} synced -> ${path.relative(rootDir, target)}`);
}

/** 同步前端产证所需的 wasm / zkey。 */
function syncZkArtifacts() {
  const zkTargetDir = path.join(frontendDir, "public", "zk");
  fs.mkdirSync(zkTargetDir, { recursive: true });

  const allowedTargets = new Set(zkArtifacts.map((artifact) => path.resolve(artifact.target)));
  for (const entry of fs.readdirSync(zkTargetDir, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }
    const filePath = path.resolve(path.join(zkTargetDir, entry.name));
    if (!allowedTargets.has(filePath) && entry.name !== ".gitkeep") {
      fs.rmSync(filePath);
      console.log(`Removed obsolete zk asset -> ${path.relative(rootDir, filePath)}`);
    }
  }

  for (const artifact of zkArtifacts) {
    copyFile(artifact.source, artifact.target, artifact.label);
  }
}

/** 同步公开样例 JSON，供首页和教学展示使用。 */
function syncExampleJson() {
  if (!fs.existsSync(generatedExamplesDir)) {
    throw new Error(`Missing example source directory: ${path.relative(rootDir, generatedExamplesDir)}`);
  }

  fs.mkdirSync(frontendExamplesDir, { recursive: true });
  const allowedTargets = new Set(exampleFiles.map((name) => path.resolve(path.join(frontendExamplesDir, name))));

  for (const entry of fs.readdirSync(frontendExamplesDir, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }

    const filePath = path.resolve(path.join(frontendExamplesDir, entry.name));
    if (!allowedTargets.has(filePath) && entry.name !== ".gitkeep") {
      fs.rmSync(filePath);
      console.log(`Removed obsolete example -> ${path.relative(rootDir, filePath)}`);
    }
  }

  for (const name of exampleFiles) {
    copyFile(path.join(generatedExamplesDir, name), path.join(frontendExamplesDir, name), name);
  }
}

/** 同步服务端私有凭证样例，供申请凭证接口在本地演示环境中读取。 */
function syncPrivateCredentials() {
  if (!fs.existsSync(generatedPrivateCredentialsDir)) {
    throw new Error(
      `Missing generated private credentials directory: ${path.relative(rootDir, generatedPrivateCredentialsDir)}`
    );
  }

  fs.mkdirSync(frontendPrivateCredentialsDir, { recursive: true });
  const entries = fs
    .readdirSync(generatedPrivateCredentialsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && path.extname(entry.name) === ".json");

  const allowedTargets = new Set(entries.map((entry) => path.resolve(path.join(frontendPrivateCredentialsDir, entry.name))));

  for (const entry of fs.readdirSync(frontendPrivateCredentialsDir, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }

    const filePath = path.resolve(path.join(frontendPrivateCredentialsDir, entry.name));
    if (!allowedTargets.has(filePath) && entry.name !== ".gitkeep") {
      fs.rmSync(filePath);
      console.log(`Removed obsolete private credential -> ${path.relative(rootDir, filePath)}`);
    }
  }

  for (const entry of entries) {
    copyFile(
      path.join(generatedPrivateCredentialsDir, entry.name),
      path.join(frontendPrivateCredentialsDir, entry.name),
      `private credential ${entry.name}`
    );
  }
}

/**
 * 组装前端运行时配置。
 *
 * 地址优先级为：命令行显式传参 > 最新 broadcast 推断 > 零地址回退。
 * 这样能同时兼容自动部署脚本、本地手工指定地址和未部署时的安全空配置。
 */
function buildRuntimeConfig(args) {
  const inferred = readAddressesFromBroadcast();
  const roleRegistryAddress = normalizeAddress(args.roleRegistryAddress ?? inferred.roleRegistryAddress);
  const rootRegistryAddress = normalizeAddress(args.rootRegistryAddress ?? inferred.rootRegistryAddress);
  const benefitDistributorAddress = normalizeAddress(
    args.benefitDistributorAddress ?? inferred.benefitDistributorAddress
  );
  const verifierAddress = normalizeAddress(args.verifierAddress ?? inferred.verifierAddress);
  const chainId = normalizeChainId(args.chainId);
  const rpcUrl = normalizeRpcUrl(args.rpcUrl);
  const deploymentStartBlock = readDeploymentStartBlockFromBroadcast();

  return {
    roleRegistryAddress,
    rootRegistryAddress,
    benefitDistributorAddress,
    verifierAddress,
    chainId,
    rpcUrl,
    deploymentId: `${chainId}-${roleRegistryAddress.slice(2, 10)}`,
    deploymentStartBlock,
    demoAddresses: DEFAULT_DEMO_ADDRESSES,
    zkArtifactPaths: {
      wasm: "/zk/unemployment_benefit_proof.wasm",
      zkey: "/zk/unemployment_benefit_proof_final.zkey"
    }
  };
}

/** 把运行时配置同时写入 `public/contract-config.json` 与 `.env.local`。 */
function writeRuntimeConfig(runtimeConfig) {
  ensureDir(runtimeConfigFile);
  fs.writeFileSync(runtimeConfigFile, `${JSON.stringify(runtimeConfig, null, 2)}\n`);
  console.log(`Runtime config synced -> ${path.relative(rootDir, runtimeConfigFile)}`);

  const envLocal = [
    `NEXT_PUBLIC_ROLE_REGISTRY_ADDRESS=${runtimeConfig.roleRegistryAddress}`,
    `NEXT_PUBLIC_ROOT_REGISTRY_ADDRESS=${runtimeConfig.rootRegistryAddress}`,
    `NEXT_PUBLIC_BENEFIT_DISTRIBUTOR_ADDRESS=${runtimeConfig.benefitDistributorAddress}`,
    `NEXT_PUBLIC_VERIFIER_ADDRESS=${runtimeConfig.verifierAddress}`,
    `NEXT_PUBLIC_CHAIN_ID=${runtimeConfig.chainId}`,
    `NEXT_PUBLIC_RPC_URL=${runtimeConfig.rpcUrl}`,
    `NEXT_PUBLIC_DEPLOYMENT_ID=${runtimeConfig.deploymentId}`,
    `NEXT_PUBLIC_DEPLOYMENT_START_BLOCK=${runtimeConfig.deploymentStartBlock ?? ""}`
  ].join("\n");
  fs.writeFileSync(envLocalFile, `${envLocal}\n`);
  console.log(`Runtime env synced -> ${path.relative(rootDir, envLocalFile)}`);
}

/** 执行完整同步流程。 */
function main() {
  const args = parseArgs();
  syncAbis();
  syncZkArtifacts();
  syncExampleJson();
  syncPrivateCredentials();
  writeRuntimeConfig(buildRuntimeConfig(args));
}

try {
  main();
} catch (error) {
  console.error(error?.message || error);
  process.exit(1);
}
