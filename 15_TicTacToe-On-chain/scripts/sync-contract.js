const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const contractsDir = path.join(rootDir, "contracts");
const frontendDir = path.join(rootDir, "frontend");

const outDir = path.join(contractsDir, "out");
const broadcastDir = path.join(contractsDir, "broadcast");

const runtimeConfigFile = path.join(frontendDir, "public", "contract-config.json");
const envFile = path.join(frontendDir, ".env.local");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const DEFAULT_RPC_URL = "http://127.0.0.1:8545";
const DEFAULT_CHAIN_ID = 31337;

// ABI 同步清单：将 Foundry 产物裁剪为前端仅需的 abi 数组文件。
const abiSources = [
  {
    contractName: "TicTacToe",
    source: path.join(outDir, "TicTacToe.sol", "TicTacToe.json"),
    target: path.join(frontendDir, "abi", "TicTacToe.json"),
  },
  {
    contractName: "SessionAccountFactory",
    source: path.join(
      outDir,
      "SessionAccountFactory.sol",
      "SessionAccountFactory.json"
    ),
    target: path.join(frontendDir, "abi", "SessionAccountFactory.json"),
  },
  {
    contractName: "SessionAccount",
    source: path.join(outDir, "SessionAccount.sol", "SessionAccount.json"),
    target: path.join(frontendDir, "abi", "SessionAccount.json"),
  },
];

// 确保目标文件所在目录存在，避免写入时报错。
const ensureDir = (filePath) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
};

// 基础地址格式校验，防止把无效字符串写进运行配置。
const isAddress = (value) =>
  typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);

// 解析 CLI 参数，支持部署脚本传入地址/链配置覆盖自动推断结果。
const parseArgs = () => {
  const args = process.argv.slice(2);
  const parsed = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const next = args[i + 1];
    if (!next) continue;
    if (arg === "--tictactoe-address") {
      parsed.tictactoeAddress = next;
      i += 1;
    } else if (arg === "--session-factory-address") {
      parsed.sessionFactoryAddress = next;
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

// 解析前端 .env.local，作为地址与网络配置的低优先级兜底来源。
const parseEnvFile = () => {
  if (!fs.existsSync(envFile)) {
    return {};
  }

  const env = {};
  const content = fs.readFileSync(envFile, "utf8");
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    env[key] = value;
  }
  return env;
};

// 解析运行时配置文件；若 JSON 异常则降级为空对象继续流程。
const parseRuntimeConfigFile = () => {
  if (!fs.existsSync(runtimeConfigFile)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(runtimeConfigFile, "utf8"));
  } catch (error) {
    console.warn(
      `Failed to parse ${path.relative(rootDir, runtimeConfigFile)}:`,
      error?.message || error
    );
    return {};
  }
};

// 递归收集 broadcast 目录中的 run-latest.json，供地址自动推断。
const listRunLatestFiles = (dir, collector = []) => {
  if (!fs.existsSync(dir)) {
    return collector;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listRunLatestFiles(full, collector);
    } else if (entry.isFile() && entry.name === "run-latest.json") {
      collector.push(full);
    }
  }

  return collector;
};

// 从单个广播文件提取目标合约地址。
const readAddressesFromRunFile = (filePath) => {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const out = {};

    if (Array.isArray(data?.transactions)) {
      for (const tx of data.transactions) {
        const contractName = tx?.contractName || tx?.contract_name;
        const address = tx?.contractAddress || tx?.contract_address;
        if (!isAddress(address)) continue;
        if (contractName === "TicTacToe" && !out.tictactoeAddress) {
          out.tictactoeAddress = address;
        }
        if (
          contractName === "SessionAccountFactory" &&
          !out.sessionFactoryAddress
        ) {
          out.sessionFactoryAddress = address;
        }
      }
    }
    return out;
  } catch (error) {
    console.warn(`Failed to parse ${filePath}:`, error?.message || error);
    return {};
  }
};

// 按修改时间倒序读取广播记录，优先使用最近一次部署结果。
const readAddressesFromBroadcast = () => {
  const files = listRunLatestFiles(broadcastDir);
  if (!files.length) return {};

  files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  for (const file of files) {
    const parsed = readAddressesFromRunFile(file);
    if (parsed.tictactoeAddress || parsed.sessionFactoryAddress) {
      console.log(
        `Address inferred from ${path.relative(rootDir, file)}`
      );
      return parsed;
    }
  }

  return {};
};

// 从 Foundry 编译产物读取 abi 字段，并做基础结构校验。
const readAbi = (sourcePath) => {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(
      `Missing foundry output: ${path.relative(rootDir, sourcePath)}`
    );
  }

  const parsed = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  if (!Array.isArray(parsed?.abi)) {
    throw new Error(
      `Invalid ABI in ${path.relative(rootDir, sourcePath)}`
    );
  }
  return parsed.abi;
};

// 批量同步 ABI 到前端目录，保持前端读写与链上接口一致。
const syncAbis = () => {
  for (const item of abiSources) {
    const abi = readAbi(item.source);
    ensureDir(item.target);
    fs.writeFileSync(item.target, `${JSON.stringify(abi, null, 2)}\n`);
    console.log(`ABI synced (${item.contractName}) -> ${path.relative(rootDir, item.target)}`);
  }
};

// 规范化地址输入：优先保留合法值，否则使用默认回退。
const normalizeAddress = (value, fallback) => (isAddress(value) ? value : fallback);

// 规范化 chainId，避免非法值写入 NEXT_PUBLIC_CHAIN_ID。
const normalizeChainId = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

// 规范化 RPC URL，确保最终配置始终可用。
const normalizeRpcUrl = (value, fallback) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;

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

// 写入前端运行时配置文件，供浏览器端优先读取。
const writeRuntimeConfig = ({
  tictactoeAddress,
  sessionFactoryAddress,
  rpcUrl,
  chainId,
}) => {
  const runtimeConfig = {
    tictactoeAddress,
    sessionFactoryAddress,
    rpcUrl,
    chainId,
  };
  ensureDir(runtimeConfigFile);
  fs.writeFileSync(runtimeConfigFile, `${JSON.stringify(runtimeConfig, null, 2)}\n`);
  console.log(`Runtime config -> ${path.relative(rootDir, runtimeConfigFile)}`);
};

// 写入前端 .env.local，供构建时和本地开发时使用。
const writeEnv = ({
  tictactoeAddress,
  sessionFactoryAddress,
  rpcUrl,
  chainId,
  walletConnectProjectId,
}) => {
  mergeEnvFile({
    NEXT_PUBLIC_CHAIN_ID: String(chainId),
    NEXT_PUBLIC_RPC_URL: rpcUrl,
    NEXT_PUBLIC_TICTACTOE_ADDRESS: tictactoeAddress,
    NEXT_PUBLIC_SESSION_FACTORY_ADDRESS: sessionFactoryAddress,
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: walletConnectProjectId,
  });
};

// 主流程：同步 ABI -> 聚合地址来源 -> 输出 runtime config 与 .env.local。
const main = () => {
  syncAbis();

  const cli = parseArgs();
  const env = parseEnvFile();
  const runtime = parseRuntimeConfigFile();
  const broadcast = readAddressesFromBroadcast();

  const tictactoeAddress = normalizeAddress(
    cli.tictactoeAddress ||
      broadcast.tictactoeAddress ||
      runtime.tictactoeAddress ||
      env.NEXT_PUBLIC_TICTACTOE_ADDRESS,
    ZERO_ADDRESS
  );
  const sessionFactoryAddress = normalizeAddress(
    cli.sessionFactoryAddress ||
      broadcast.sessionFactoryAddress ||
      runtime.sessionFactoryAddress ||
      env.NEXT_PUBLIC_SESSION_FACTORY_ADDRESS,
    ZERO_ADDRESS
  );
  const rpcUrl = normalizeRpcUrl(
    cli.rpcUrl || runtime.rpcUrl || env.NEXT_PUBLIC_RPC_URL,
    DEFAULT_RPC_URL
  );
  const chainId = normalizeChainId(
    cli.chainId || runtime.chainId || env.NEXT_PUBLIC_CHAIN_ID,
    DEFAULT_CHAIN_ID
  );
  const walletConnectProjectId =
    env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "YOUR_PROJECT_ID";

  writeRuntimeConfig({
    tictactoeAddress,
    sessionFactoryAddress,
    rpcUrl,
    chainId,
  });
  writeEnv({
    tictactoeAddress,
    sessionFactoryAddress,
    rpcUrl,
    chainId,
    walletConnectProjectId,
  });
};

main();
