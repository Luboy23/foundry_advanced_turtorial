// 同步 Foundry 产物中的 ABI/地址到前端配置（对齐 04 项目做法）
const fs = require("fs");
const path = require("path");

// 仓库根目录：用于定位 contracts/out 与前端目标文件
const rootDir = path.resolve(__dirname, "..");
// Foundry 编译产物（包含 ABI 与字节码信息）
const outFile = path.join(
  rootDir,
  "contracts",
  "out",
  "SnakeScoreboard.sol",
  "SnakeScoreboard.json"
);

// 前端 ABI 目标文件（供 viem 读合约）
const abiTarget = path.join(
  rootDir,
  "frontend",
  "lib",
  "scoreboard.abi.json"
);

// 前端地址目标文件（供前端读取合约地址）
const addressTarget = path.join(
  rootDir,
  "frontend",
  "lib",
  "scoreboard.address.json"
);

// 运行时配置文件（前端读取地址 + RPC）
const publicTarget = path.join(
  rootDir,
  "frontend",
  "public",
  "scoreboard.json"
);

// 前端环境变量文件（写入 NEXT_PUBLIC_*）
const envFile = path.join(rootDir, "frontend", ".env.local");
// Foundry 广播记录目录（用于读取部署地址）
const broadcastDir = path.join(
  rootDir,
  "contracts",
  "broadcast",
  "DeploySnakeScoreboard.s.sol"
);
// 默认本地 RPC
const DEFAULT_RPC_URL = "http://127.0.0.1:8545";

// 解析命令行参数（当前仅支持 --address）
const parseArgs = () => {
  const args = process.argv.slice(2);
  const output = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--address" && args[i + 1]) {
      output.address = args[i + 1];
      i += 1;
    }
  }
  return output;
};

// 从 .env.local 读取合约地址
const loadAddressFromEnv = () => {
  if (!fs.existsSync(envFile)) return "";
  const content = fs.readFileSync(envFile, "utf8");
  const match = content.match(/^NEXT_PUBLIC_SCOREBOARD_ADDRESS=(.*)$/m);
  return match ? match[1].trim() : "";
};

// 从 .env.local 读取 RPC 地址
const loadRpcUrlFromEnv = () => {
  if (!fs.existsSync(envFile)) return "";
  const content = fs.readFileSync(envFile, "utf8");
  const match = content.match(/^NEXT_PUBLIC_ANVIL_RPC_URL=(.*)$/m);
  return match ? match[1].trim() : "";
};

// 找到最新的 run-latest.json（用于推断部署地址）
const findLatestRunFile = () => {
  if (!fs.existsSync(broadcastDir)) return "";
  const chainDirs = fs
    .readdirSync(broadcastDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(broadcastDir, entry.name, "run-latest.json"))
    .filter((filePath) => fs.existsSync(filePath));

  if (!chainDirs.length) return "";
  chainDirs.sort((a, b) => {
    const aTime = fs.statSync(a).mtimeMs;
    const bTime = fs.statSync(b).mtimeMs;
    return bTime - aTime;
  });
  return chainDirs[0];
};

// 从 run-latest.json 解析合约地址（兼容不同字段名）
const readAddressFromRun = (filePath) => {
  if (!filePath || !fs.existsSync(filePath)) return "";
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);
    if (Array.isArray(data?.transactions)) {
      const named = data.transactions.find(
        (tx) =>
          tx?.contractName === "SnakeScoreboard" &&
          (tx?.contractAddress || tx?.contract_address)
      );
      if (named?.contractAddress || named?.contract_address) {
        return named.contractAddress || named.contract_address;
      }
      const anyTx = data.transactions.find(
        (tx) => tx?.contractAddress || tx?.contract_address
      );
      if (anyTx?.contractAddress || anyTx?.contract_address) {
        return anyTx.contractAddress || anyTx.contract_address;
      }
    }
    if (Array.isArray(data?.receipts)) {
      const receipt = data.receipts.find(
        (rcpt) => rcpt?.contractAddress || rcpt?.contract_address
      );
      if (receipt?.contractAddress || receipt?.contract_address) {
        return receipt.contractAddress || receipt.contract_address;
      }
    }
  } catch (error) {
    console.warn(`Failed to parse ${filePath}:`, error?.message || error);
  }
  return "";
};

// 确保目标文件目录存在
const ensureDir = (filePath) => {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
};

// 脚本主入口：同步 ABI 与地址到前端
const main = () => {
  // 必须存在编译产物，否则无法提取 ABI
  if (!fs.existsSync(outFile)) {
    console.error(
      `Missing foundry output: ${outFile}. Run forge build/deploy first.`
    );
    process.exit(1);
  }

  const raw = fs.readFileSync(outFile, "utf8");
  const parsed = JSON.parse(raw);
  const abi = parsed.abi;
  if (!abi || !Array.isArray(abi)) {
    console.error("Invalid ABI in foundry output.");
    process.exit(1);
  }

  // 写入 ABI
  ensureDir(abiTarget);
  fs.writeFileSync(abiTarget, JSON.stringify(abi, null, 2));
  console.log(`ABI synced → ${path.relative(rootDir, abiTarget)}`);

  // 地址优先级：命令行 --address > 广播记录 > .env.local
  const args = parseArgs();
  let address = args.address;
  if (!address) {
    const latestRun = findLatestRunFile();
    address = readAddressFromRun(latestRun);
    if (address) {
      console.log(
        `Address inferred from ${path.relative(rootDir, latestRun)}`
      );
    }
  }
  if (!address) {
    address = loadAddressFromEnv();
  }

  // RPC 优先级：.env.local > 默认本地 RPC
  const rpcUrl = loadRpcUrlFromEnv() || DEFAULT_RPC_URL;

  if (address) {
    // 写入地址文件（lib）
    ensureDir(addressTarget);
    fs.writeFileSync(
      addressTarget,
      JSON.stringify({ address }, null, 2)
    );
    console.log(`Address synced → ${path.relative(rootDir, addressTarget)}`);

    // 写入运行时配置（public/scoreboard.json）
    ensureDir(publicTarget);
    fs.writeFileSync(
      publicTarget,
      JSON.stringify({ address, rpcUrl }, null, 2)
    );
    console.log(`Runtime config → ${path.relative(rootDir, publicTarget)}`);

    // 写入前端环境变量（覆盖 NEXT_PUBLIC_*）
    ensureDir(envFile);
    fs.writeFileSync(
      envFile,
      `NEXT_PUBLIC_ANVIL_RPC_URL=${rpcUrl}\nNEXT_PUBLIC_SCOREBOARD_ADDRESS=${address}\n`
    );
    console.log(`Env synced → ${path.relative(rootDir, envFile)}`);
  } else {
    // 无地址时仅同步 ABI
    console.warn("Address not found; skipped writing address file.");
  }
};

// 直接执行脚本
main();
