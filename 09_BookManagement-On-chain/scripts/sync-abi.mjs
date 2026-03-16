import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const sourcePath = path.join(
  rootDir,
  "contracts",
  "out",
  "BookManagement.sol",
  "BookManagement.json"
);
const targetPath = path.join(
  rootDir,
  "frontend",
  "src",
  "lib",
  "generated",
  "book-management-abi.json"
);

if (!fs.existsSync(sourcePath)) {
  console.error(`Missing artifact: ${sourcePath}`);
  console.error("Run `forge build` in contracts first.");
  process.exit(1);
}

const artifact = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
if (!Array.isArray(artifact.abi)) {
  console.error("Artifact does not contain a valid ABI.");
  process.exit(1);
}

fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.writeFileSync(targetPath, `${JSON.stringify(artifact.abi, null, 2)}\n`);
console.log(`Synced ABI to ${targetPath}`);
