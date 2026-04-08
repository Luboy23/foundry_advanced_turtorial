const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const contractsDir = path.join(rootDir, "contracts");
const contractsEnvPath = path.join(contractsDir, ".env");
const contractsEnvExamplePath = path.join(contractsDir, ".env.example");

const ensureEnvFile = () => {
  if (!fs.existsSync(contractsEnvPath) && fs.existsSync(contractsEnvExamplePath)) {
    fs.copyFileSync(contractsEnvExamplePath, contractsEnvPath);
  }
};

const parseKeyValueFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const output = {};
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    output[key] = value;
  }
  return output;
};

const mergeEnvWithKnownKeys = (filePath, entries) => {
  const raw = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const lines = raw.length > 0 ? raw.split(/\r?\n/) : [];
  const seen = new Set();

  const merged = lines.map((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (!match) return line;

    const key = match[1];
    if (!(key in entries)) return line;
    seen.add(key);
    return `${key}=${entries[key]}`;
  });

  for (const [key, value] of Object.entries(entries)) {
    if (!seen.has(key)) {
      merged.push(`${key}=${value}`);
    }
  }

  const normalized = merged.join("\n").replace(/\n+$/, "");
  fs.writeFileSync(filePath, `${normalized}\n`);
};

const parseMerkleOutput = (output) => {
  const getField = (label) => {
    const pattern = new RegExp(`^${label}:\\s*(.+)$`, "m");
    return output.match(pattern)?.[1]?.trim();
  };

  const merkleRoot = getField("Merkle Root");
  const user1Proof = getField("User1 Merkle Proof");
  const user2Proof = getField("User2 Merkle Proof");
  const user3Proof = getField("User3 Merkle Proof");

  if (!merkleRoot) {
    throw new Error("Failed to parse Merkle Root from generator output.");
  }

  return {
    MERKLE_ROOT: merkleRoot,
    USER1_PROOF: user1Proof || "[]",
    USER2_PROOF: user2Proof || "[]",
    USER3_PROOF: user3Proof || "[]",
  };
};

const main = () => {
  ensureEnvFile();

  if (!fs.existsSync(path.join(contractsDir, "node_modules"))) {
    execFileSync("npm", ["install"], { cwd: contractsDir, stdio: "inherit" });
  }

  const output = execFileSync("node", ["script/generate_anvil_merkle.js"], {
    cwd: contractsDir,
    encoding: "utf8",
  });

  const contractsEnv = parseKeyValueFile(contractsEnvPath);
  const merkleData = parseMerkleOutput(output);
  mergeEnvWithKnownKeys(contractsEnvPath, {
    OWNER_PK:
      contractsEnv.OWNER_PK ||
      "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    OWNER_SK:
      contractsEnv.OWNER_SK ||
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    TOTAL_AMOUNT:
      contractsEnv.TOTAL_AMOUNT || "200000000000000000000",
    ...merkleData,
  });

  console.log(output.trim());
  console.log(`Merkle config updated -> ${path.relative(rootDir, contractsEnvPath)}`);
};

main();
