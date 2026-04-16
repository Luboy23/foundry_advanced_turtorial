import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import { buildPoseidon } from "circomlibjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PROJECT_DIR = path.resolve(__dirname, "../..");
export const ZK_DIR = path.join(PROJECT_DIR, "zk");
export const CONTRACTS_DIR = path.join(PROJECT_DIR, "contracts");

export const BUILD_DIR = path.join(ZK_DIR, "build");
export const CIRCUIT_BUILD_DIR = path.join(BUILD_DIR, "circuit");
export const PTAU_DIR = path.join(BUILD_DIR, "ptau");
export const GENERATED_DATA_DIR = path.join(ZK_DIR, "data", "generated", "alcohol-age");
export const CREDENTIALS_DIR = path.join(GENERATED_DATA_DIR, "credentials");

export const CIRCUIT_FILE = path.join(ZK_DIR, "circuits", "alcohol_age_proof.circom");
export const INPUT_FILE = path.join(ZK_DIR, "data", "input", "sample-age-records.json");
export const R1CS_FILE = path.join(CIRCUIT_BUILD_DIR, "alcohol_age_proof.r1cs");
export const WASM_FILE = path.join(CIRCUIT_BUILD_DIR, "alcohol_age_proof_js", "alcohol_age_proof.wasm");
export const PTAU_0000 = path.join(PTAU_DIR, "powersOfTau14_0000.ptau");
export const PTAU_0001 = path.join(PTAU_DIR, "powersOfTau14_0001.ptau");
export const PTAU_FINAL = path.join(PTAU_DIR, "powersOfTau14_final.ptau");
export const ZKEY_0000 = path.join(BUILD_DIR, "alcohol_age_proof_0000.zkey");
export const ZKEY_FINAL = path.join(BUILD_DIR, "alcohol_age_proof_final.zkey");
export const VERIFICATION_KEY_FILE = path.join(BUILD_DIR, "verification_key.json");

export const SAMPLE_CREDENTIAL_SET_FILE = path.join(GENERATED_DATA_DIR, "sample-credential-set.json");
export const SAMPLE_PRODUCTS_FILE = path.join(GENERATED_DATA_DIR, "sample-products.json");
export const SAMPLE_PROOF_FILE = path.join(GENERATED_DATA_DIR, "sample-proof.json");
export const SAMPLE_PUBLIC_SIGNALS_FILE = path.join(GENERATED_DATA_DIR, "sample-public-signals.json");
export const SAMPLE_SOLIDITY_CALLDATA_FILE = path.join(GENERATED_DATA_DIR, "sample-solidity-calldata.json");

export const GENERATED_VERIFIER_FILE = path.join(CONTRACTS_DIR, "src", "AlcoholAgeProofVerifier.sol");
export const GENERATED_FIXTURE_FILE = path.join(CONTRACTS_DIR, "test", "generated", "SampleAlcoholAgeFixture.sol");

export const MERKLE_DEPTH = 20;
export const SNARK_SCALAR_FIELD = BigInt(
  "21888242871839275222246405745257275088548364400416034343698204186575808495617"
);

const LOCAL_SNARKJS_BIN = path.join(ZK_DIR, "node_modules", ".bin", "snarkjs");

export const snarkjsBin = () => (fs.existsSync(LOCAL_SNARKJS_BIN) ? LOCAL_SNARKJS_BIN : "snarkjs");
export const circomBin = () => process.env.CIRCOM_BIN || "circom";

export const ensureDir = (targetPath, isDir = false) => {
  const directory = isDir ? targetPath : path.dirname(targetPath);
  fs.mkdirSync(directory, { recursive: true });
};

export const writeJson = (filePath, value) => {
  ensureDir(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

export const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

export const run = (command, args, options = {}) => {
  const stdio = options.capture
    ? ["pipe", "pipe", "pipe"]
    : options.input !== undefined
      ? ["pipe", "inherit", "inherit"]
      : "inherit";

  const result = execFileSync(command, args, {
    cwd: options.cwd || ZK_DIR,
    encoding: "utf8",
    input: options.input,
    stdio
  });

  return options.capture ? result.trim() : "";
};

export const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

export const toBigIntString = (value) => BigInt(value).toString();

export const toBytes32Hex = (value) => `0x${BigInt(value).toString(16).padStart(64, "0")}`;

export const asciiToBytes32Hex = (value) => {
  const raw = Buffer.from(value, "utf8");
  assert(raw.length <= 32, "label must fit within bytes32");
  return `0x${Buffer.concat([raw, Buffer.alloc(32 - raw.length)]).toString("hex")}`;
};

export const bytes32HexToField = (value) => BigInt(value) % SNARK_SCALAR_FIELD;

export const addressToField = (value) => BigInt(value.toLowerCase()) % SNARK_SCALAR_FIELD;

export const escapeSolidityString = (value) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

export const formatSolidityUintArray = (values) =>
  `[${values.map((value) => `uint256(${BigInt(value).toString()})`).join(", ")}]`;

export const formatSolidityUintNestedArray = (values) =>
  `[${values.map((inner) => formatSolidityUintArray(inner)).join(", ")}]`;

export const parseSolidityCalldata = (value) => JSON.parse(`[${value.trim()}]`);

export const unixTimestampToUtcYmd = (timestamp) => {
  const date = new Date(Number(timestamp) * 1000);
  return date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
};

export const isLeapYear = (year) => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

export const eligibleFromBirthTimestamp = (timestamp) => {
  const date = new Date(Number(timestamp) * 1000);
  const year = date.getUTCFullYear() + 18;
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();

  if (month === 2 && day === 29 && !isLeapYear(year)) {
    return year * 10000 + 301;
  }

  return year * 10000 + month * 100 + day;
};

export const buildPoseidonHelpers = async () => {
  const poseidon = await buildPoseidon();
  const F = poseidon.F;

  return {
    hash2: (left, right) => BigInt(F.toString(poseidon([BigInt(left), BigInt(right)]))),
    hash5: (inputs) => BigInt(F.toString(poseidon(inputs.map((input) => BigInt(input)))))
  };
};
