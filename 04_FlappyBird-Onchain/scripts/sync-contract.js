// 同步 foundry 产物中的 ABI/地址到前端 Web3 配置。
const fs = require("fs");
const path = require("path");

// 仓库根目录：用于定位 contracts/out 与前端目标文件
const rootDir = path.resolve(__dirname, "..");
// foundry 编译产物（包含 ABI）
const outFile = path.join(
  rootDir,
  "contracts",
  "out",
  "FlappyScoreboard.sol",
  "FlappyScoreboard.json"
);

// 前端 ABI 目标文件（供 viem/前端读取）
const abiTarget = path.join(
  rootDir,
  "frontend",
  "components",
  "Web3",
  "flappyScore.abi.json"
);

// 前端地址目标文件（供前端读取合约地址）
const addressTarget = path.join(
  rootDir,
  "frontend",
  "components",
  "Web3",
  "flappyScore.address.json"
);

// 前端环境变量文件（可写入 VITE_FLAPPY_SCORE_ADDRESS）
const envFile = path.join(rootDir, "frontend", ".env.local");

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

// 从前端 .env.local 读取合约地址
const loadAddressFromEnv = () => {
  if (!fs.existsSync(envFile)) return "";
  const content = fs.readFileSync(envFile, "utf8");
  // 仅匹配 VITE_FLAPPY_SCORE_ADDRESS 行
  const match = content.match(/^VITE_FLAPPY_SCORE_ADDRESS=(.*)$/m);
  return match ? match[1].trim() : "";
};

// 确保目标文件目录存在
const ensureDir = (filePath) => {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
};

// 脚本主入口：同步 ABI 与地址文件
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

  // 写入 ABI 到前端目录
  ensureDir(abiTarget);
  fs.writeFileSync(abiTarget, JSON.stringify(abi, null, 2));
  console.log(`ABI synced → ${path.relative(rootDir, abiTarget)}`);

  // 地址优先级：命令行 --address > .env.local 中的地址
  const args = parseArgs();
  const address = args.address || loadAddressFromEnv();
  if (address) {
    // 写入地址 JSON 文件，供前端直接读取
    ensureDir(addressTarget);
    fs.writeFileSync(addressTarget, JSON.stringify({ address }, null, 2));
    console.log(`Address synced → ${path.relative(rootDir, addressTarget)}`);
  } else {
    // 没有地址时只同步 ABI，不生成地址文件
    console.warn("Address not found; skipped writing address file.");
  }
};

// 直接执行脚本
main();
