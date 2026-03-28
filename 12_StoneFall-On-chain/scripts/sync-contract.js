/**
 * 模块职责：同步合约 ABI 与运行时配置到前端，并维护 .env.local 关键字段。
 * 说明：本文件注释以“业务意图 + 关键约束”为主，便于后续维护与教学阅读。
 */

const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const outFile = path.join(
  rootDir,
  "contracts",
  "out",
  "StoneFallScoreboard.sol",
  "StoneFallScoreboard.json"
);
const abiTarget = path.join(rootDir, "frontend", "src", "lib", "stonefall.abi.json");
const runtimeConfigTarget = path.join(
  rootDir,
  "frontend",
  "public",
  "contract-config.json"
);
const envTarget = path.join(rootDir, "frontend", ".env.local");

const DEFAULT_RPC_URL = "http://127.0.0.1:8545";
const DEFAULT_CHAIN_ID = "31337";

/**
 * 解析脚本参数。
 * 支持 --address / --rpc-url / --chain-id。
 */
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
      continue;
    }
  }

  return output;
};

/**
 * 确保输出目录存在，避免 writeFileSync 因目录缺失失败。
 */
const ensureDir = (filePath) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
};

/**
 * 仅覆盖约定 key，保留 .env.local 其他自定义变量。
 * 这样可以避免脚本把用户本地调试变量误删。
 */
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

/**
 * 从 Foundry 编译产物读取 ABI。
 * 若产物缺失或结构异常，直接退出并提示错误，避免写入错误 ABI。
 */
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

/**
 * 主流程：
 * 1) 同步 ABI 到前端源码目录
 * 2) 如提供地址，则同步运行时配置与前端 .env.local
 */
const main = () => {
  const args = parseArgs();
  const address = args.address;
  const rpcUrl = args.rpcUrl || process.env.RPC_URL || DEFAULT_RPC_URL;
  const chainId = args.chainId || process.env.CHAIN_ID || DEFAULT_CHAIN_ID;

  const abi = loadAbi();
  ensureDir(abiTarget);
  fs.writeFileSync(abiTarget, JSON.stringify(abi, null, 2));
  console.log(`ABI synced -> ${path.relative(rootDir, abiTarget)}`);

  if (!address) {
    // 地址缺失时仅更新 ABI，避免覆盖前端现有部署配置。
    console.warn("Address missing, skip runtime/env sync.");
    return;
  }

  ensureDir(runtimeConfigTarget);
  fs.writeFileSync(
    runtimeConfigTarget,
    JSON.stringify(
      {
        address,
        rpcUrl,
        chainId: Number(chainId),
      },
      null,
      2
    )
  );
  console.log(`Runtime config synced -> ${path.relative(rootDir, runtimeConfigTarget)}`);

  ensureDir(envTarget);
  // 仅同步约定三项，避免污染前端其他环境变量。
  mergeEnvWithKnownKeys(envTarget, {
    VITE_CHAIN_ID: chainId,
    VITE_RPC_URL: rpcUrl,
    VITE_STONEFALL_ADDRESS: address,
  });
  console.log(`Env synced -> ${path.relative(rootDir, envTarget)}`);
};

main();
