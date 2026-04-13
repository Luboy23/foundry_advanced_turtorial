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
    contractName: "AdmissionRoleRegistry",
    source: path.join(outDir, "AdmissionRoleRegistry.sol", "AdmissionRoleRegistry.json"),
    target: path.join(frontendDir, "abi", "AdmissionRoleRegistry.json"),
  },
  {
    contractName: "ScoreRootRegistry",
    source: path.join(outDir, "ScoreRootRegistry.sol", "ScoreRootRegistry.json"),
    target: path.join(frontendDir, "abi", "ScoreRootRegistry.json"),
  },
  {
    contractName: "UniversityAdmissionVerifier",
    source: path.join(outDir, "UniversityAdmissionVerifier.sol", "UniversityAdmissionVerifier.json"),
    target: path.join(frontendDir, "abi", "UniversityAdmissionVerifier.json"),
  },
  {
    contractName: "UniversityCutoffProofVerifier",
    source: path.join(
      outDir,
      "UniversityCutoffProofVerifier.sol",
      "UniversityCutoffProofVerifier.json"
    ),
    target: path.join(frontendDir, "abi", "UniversityCutoffProofVerifier.json"),
  },
];

const runtimeConfigFile = path.join(frontendDir, "public", "contract-config.json");
const zkArtifacts = [
  {
    label: "university_cutoff_proof.wasm",
    source: path.join(
      zkDir,
      "build",
      "circuit",
      "university_cutoff_proof_js",
      "university_cutoff_proof.wasm"
    ),
    target: path.join(frontendDir, "public", "zk", "university_cutoff_proof.wasm"),
  },
  {
    label: "university_cutoff_proof_final.zkey",
    source: path.join(zkDir, "build", "university_cutoff_proof_final.zkey"),
    target: path.join(frontendDir, "public", "zk", "university_cutoff_proof_final.zkey"),
  },
  {
    label: "sample-credential.json",
    source: path.join(zkDir, "data", "generated", "sample-admission", "sample-credential.json"),
    target: path.join(frontendDir, "public", "examples", "sample-credential.json"),
  },
  {
    label: "sample-schools.json",
    source: path.join(zkDir, "data", "generated", "sample-admission", "sample-schools.json"),
    target: path.join(frontendDir, "public", "examples", "sample-schools.json"),
  },
  {
    label: "sample-score-source.json",
    source: path.join(zkDir, "data", "generated", "sample-admission", "sample-score-source.json"),
    target: path.join(frontendDir, "public", "examples", "sample-score-source.json"),
  },
  {
    label: "sample-results.json",
    source: path.join(zkDir, "data", "input", "sample-results.json"),
    target: path.join(frontendDir, "public", "examples", "sample-results.json"),
  },
];
const authorityTemplateSource = path.join(zkDir, "data", "input", "sample-results.json");
const authorityTemplateTarget = path.join(frontendDir, "public", "templates", "score-import-template.json");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const DEFAULT_CHAIN_ID = 31337;
const DEFAULT_RPC_URL = "http://127.0.0.1:8545";

// 统一确保目标目录存在。
// 这个脚本会同时写 ABI、运行时配置、zk 产物和前端模板，因此所有落盘入口都先经过这里。
const ensureDir = (filePath) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
};

// 最小地址格式校验。
// 这里故意只做“是不是 20 字节十六进制地址”的判断，不承担链上可用性验证。
const isAddress = (value) =>
  typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);

// 归一化地址配置；如果 CLI 参数和广播记录都不可用，则回退零地址。
const normalizeAddress = (value, fallback) => (isAddress(value) ? value : fallback);

// 归一化 chainId，兼容字符串形式的命令行输入。
const normalizeChainId = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

// 归一化 RPC 地址，保证运行时配置里始终有一条可回退的本地链地址。
const normalizeRpcUrl = (value, fallback) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;

// 用最小 JSON-RPC 客户端读取本地链状态。
// 之所以不用额外依赖，是为了让同步脚本在 Node 环境下保持最轻量。
const jsonRpc = async (rpcUrl, method, params = []) => {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method,
      params
    })
  });

  if (!response.ok) {
    throw new Error(`RPC request failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  if (payload.error) {
    throw new Error(payload.error.message || `RPC error calling ${method}`);
  }

  return payload.result;
};

// 解析命令行参数。
// 这些参数只覆盖“本次同步该写什么”，真正的合约地址优先级还要结合 broadcast 目录推断。
const parseArgs = () => {
  const args = process.argv.slice(2);
  const parsed = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (!next) continue;

    if (arg === "--registry-address") {
      parsed.scoreRootRegistryAddress = next;
      index += 1;
    } else if (arg === "--verifier-address") {
      parsed.universityAdmissionVerifierAddress = next;
      index += 1;
    } else if (arg === "--role-registry-address") {
      parsed.admissionRoleRegistryAddress = next;
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
};

// 递归查找 Foundry 广播目录中的 run-latest.json。
// 这样无论 Deploy 脚本放在哪个子目录，都能被当前同步脚本自动发现。
const listRunLatestFiles = (dir, collector = []) => {
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
};

// 从最近一次广播记录里推断部署地址。
// 这是教学链路里最关键的兼容逻辑：即使用户没有手动传地址，前端仍能拿到最新部署结果。
const readAddressesFromBroadcast = () => {
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
        if (!isAddress(contractAddress)) continue;

        if (contractName === "AdmissionRoleRegistry" && !output.admissionRoleRegistryAddress) {
          output.admissionRoleRegistryAddress = contractAddress;
        }
        if (contractName === "ScoreRootRegistry" && !output.scoreRootRegistryAddress) {
          output.scoreRootRegistryAddress = contractAddress;
        }
        if (contractName === "UniversityAdmissionVerifier" && !output.universityAdmissionVerifierAddress) {
          output.universityAdmissionVerifierAddress = contractAddress;
        }
      }

      if (
        output.admissionRoleRegistryAddress ||
        output.scoreRootRegistryAddress ||
        output.universityAdmissionVerifierAddress
      ) {
        console.log(`Address inferred from ${path.relative(rootDir, file)}`);
        return output;
      }
    } catch (error) {
      console.warn(`Failed to parse ${file}:`, error?.message || error);
    }
  }

  return {};
};

// 从 Foundry 编译产物里读取 ABI。
// 这里显式校验 abi 数组存在，是为了尽早发现构建失败或产物格式异常。
const readAbi = (filePath) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing foundry output: ${path.relative(rootDir, filePath)}`);
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!Array.isArray(parsed?.abi)) {
    throw new Error(`Invalid ABI payload in ${path.relative(rootDir, filePath)}`);
  }

  return parsed.abi;
};

// 同步前端 ABI 目录，并清理已经不再需要的旧 ABI 文件。
// 这样可以避免前端误读历史合约接口，尤其是本项目频繁调整状态机时。
const syncAbis = () => {
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
};

// 复制 zk 产物或样例文件到前端 public 目录。
// 所有这类产物都保持“源文件是真相”，这里不做内容转换，只负责同步。
const copyFile = (source, target, label) => {
  if (!fs.existsSync(source)) {
    throw new Error(`Missing generated asset: ${path.relative(rootDir, source)}`);
  }

  ensureDir(target);
  fs.copyFileSync(source, target);
  console.log(`${label} synced -> ${path.relative(rootDir, target)}`);
};

// 生成考试院导入模板。
// 用户前端上传的模板只保留“本届成绩 + 学生记录”，不把大学录取线职责混进考试院流程里。
const writeAuthorityImportTemplate = () => {
  if (!fs.existsSync(authorityTemplateSource)) {
    throw new Error(`Missing authority import source: ${path.relative(rootDir, authorityTemplateSource)}`);
  }

  const payload = JSON.parse(fs.readFileSync(authorityTemplateSource, "utf8"));
  const template = {
    scoreSource: payload.scoreSource,
    records: payload.records
  };

  ensureDir(authorityTemplateTarget);
  fs.writeFileSync(authorityTemplateTarget, `${JSON.stringify(template, null, 2)}\n`);
  console.log(`score-import-template.json synced -> ${path.relative(rootDir, authorityTemplateTarget)}`);
};

// 读取当前本地链的部署指纹。
// 前端会把这个区块高度和区块哈希当作“当前 make dev 对应链实例”的稳定标识。
const readDeploymentFingerprint = async (rpcUrl) => {
  const latestBlockHex = await jsonRpc(rpcUrl, "eth_blockNumber");
  const latestBlockNumber = Number(BigInt(latestBlockHex));
  const latestBlock = await jsonRpc(rpcUrl, "eth_getBlockByNumber", [latestBlockHex, false]);

  return {
    deploymentBlockNumber: latestBlockNumber,
    deploymentBlockHash: latestBlock?.hash ?? undefined
  };
};

// 主入口把“地址推断、ABI 同步、zk 产物同步、模板生成、运行时配置写入”收成一次原子动作。
// 这样 make deploy / make dev 完成后，前端看到的总是同一批部署上下文，不会出现地址和产物来自不同轮次的情况。
const main = async () => {
  const args = parseArgs();
  const broadcast = readAddressesFromBroadcast();

  const runtimeConfig = {
    admissionRoleRegistryAddress: normalizeAddress(
      args.admissionRoleRegistryAddress || broadcast.admissionRoleRegistryAddress,
      ZERO_ADDRESS
    ),
    scoreRootRegistryAddress: normalizeAddress(
      args.scoreRootRegistryAddress || broadcast.scoreRootRegistryAddress,
      ZERO_ADDRESS
    ),
    universityAdmissionVerifierAddress: normalizeAddress(
      args.universityAdmissionVerifierAddress || broadcast.universityAdmissionVerifierAddress,
      ZERO_ADDRESS
    ),
    chainId: normalizeChainId(args.chainId, DEFAULT_CHAIN_ID),
    rpcUrl: normalizeRpcUrl(args.rpcUrl, DEFAULT_RPC_URL)
  };

  const deploymentFingerprint = await readDeploymentFingerprint(runtimeConfig.rpcUrl);

  syncAbis();
  for (const artifact of zkArtifacts) {
    copyFile(artifact.source, artifact.target, artifact.label);
  }
  writeAuthorityImportTemplate();
  ensureDir(runtimeConfigFile);
  fs.writeFileSync(
    runtimeConfigFile,
    `${JSON.stringify({ ...runtimeConfig, ...deploymentFingerprint }, null, 2)}\n`
  );
  console.log(`Runtime config synced -> ${path.relative(rootDir, runtimeConfigFile)}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
