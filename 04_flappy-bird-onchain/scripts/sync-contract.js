const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const outFile = path.join(
  rootDir,
  "contracts",
  "out",
  "FlappyScoreboard.sol",
  "FlappyScoreboard.json"
);

const abiTarget = path.join(
  rootDir,
  "game-frontend",
  "components",
  "Web3",
  "flappyScore.abi.json"
);

const addressTarget = path.join(
  rootDir,
  "game-frontend",
  "components",
  "Web3",
  "flappyScore.address.json"
);

const envFile = path.join(rootDir, "game-frontend", ".env.local");

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

const loadAddressFromEnv = () => {
  if (!fs.existsSync(envFile)) return "";
  const content = fs.readFileSync(envFile, "utf8");
  const match = content.match(/^VITE_FLAPPY_SCORE_ADDRESS=(.*)$/m);
  return match ? match[1].trim() : "";
};

const ensureDir = (filePath) => {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
};

const main = () => {
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

  ensureDir(abiTarget);
  fs.writeFileSync(abiTarget, JSON.stringify(abi, null, 2));
  console.log(`ABI synced → ${path.relative(rootDir, abiTarget)}`);

  const args = parseArgs();
  const address = args.address || loadAddressFromEnv();
  if (address) {
    ensureDir(addressTarget);
    fs.writeFileSync(addressTarget, JSON.stringify({ address }, null, 2));
    console.log(`Address synced → ${path.relative(rootDir, addressTarget)}`);
  } else {
    console.warn("Address not found; skipped writing address file.");
  }
};

main();
