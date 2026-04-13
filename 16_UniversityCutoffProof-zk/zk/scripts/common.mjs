import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import { buildPoseidon } from "circomlibjs";

// 这一组公共常量和工具函数服务整个 ZK 构建链路：
// 电路编译、可信设置、示例数据生成、verifier 导出与 fixture 生成都会复用这里的路径与帮助函数。
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PROJECT_DIR = path.resolve(__dirname, "../..");
export const ZK_DIR = path.join(PROJECT_DIR, "zk");
export const CONTRACTS_DIR = path.join(PROJECT_DIR, "contracts");

export const BUILD_DIR = path.join(ZK_DIR, "build");
export const CIRCUIT_BUILD_DIR = path.join(BUILD_DIR, "circuit");
export const PTAU_DIR = path.join(BUILD_DIR, "ptau");
export const GENERATED_DATA_DIR = path.join(ZK_DIR, "data", "generated", "sample-admission");

export const CIRCUIT_FILE = path.join(ZK_DIR, "circuits", "university_cutoff_proof.circom");
export const INPUT_FILE = path.join(ZK_DIR, "data", "input", "sample-results.json");
export const R1CS_FILE = path.join(CIRCUIT_BUILD_DIR, "university_cutoff_proof.r1cs");
export const WASM_FILE = path.join(
  CIRCUIT_BUILD_DIR,
  "university_cutoff_proof_js",
  "university_cutoff_proof.wasm"
);
export const PTAU_0000 = path.join(PTAU_DIR, "powersOfTau14_0000.ptau");
export const PTAU_0001 = path.join(PTAU_DIR, "powersOfTau14_0001.ptau");
export const PTAU_FINAL = path.join(PTAU_DIR, "powersOfTau14_final.ptau");
export const ZKEY_0000 = path.join(BUILD_DIR, "university_cutoff_proof_0000.zkey");
export const ZKEY_FINAL = path.join(BUILD_DIR, "university_cutoff_proof_final.zkey");
export const VERIFICATION_KEY_FILE = path.join(BUILD_DIR, "verification_key.json");

export const SAMPLE_SCORE_SOURCE_FILE = path.join(GENERATED_DATA_DIR, "sample-score-source.json");
export const SAMPLE_SCHOOLS_FILE = path.join(GENERATED_DATA_DIR, "sample-schools.json");
export const SAMPLE_CREDENTIAL_FILE = path.join(GENERATED_DATA_DIR, "sample-credential.json");
export const SAMPLE_PROVING_INPUT_FILE = path.join(GENERATED_DATA_DIR, "sample-proving-input.json");
export const SAMPLE_PROOF_FILE = path.join(GENERATED_DATA_DIR, "sample-proof.json");
export const SAMPLE_PUBLIC_SIGNALS_FILE = path.join(GENERATED_DATA_DIR, "sample-public-signals.json");
export const SAMPLE_SOLIDITY_CALLDATA_FILE = path.join(GENERATED_DATA_DIR, "sample-solidity-calldata.json");
export const CREDENTIALS_DIR = path.join(GENERATED_DATA_DIR, "credentials");

export const GENERATED_VERIFIER_FILE = path.join(
  CONTRACTS_DIR,
  "src",
  "UniversityCutoffProofVerifier.sol"
);
export const GENERATED_FIXTURE_FILE = path.join(CONTRACTS_DIR, "test", "generated", "SampleAdmissionFixture.sol");

export const MERKLE_DEPTH = 20;
export const SNARK_SCALAR_FIELD = BigInt(
  "21888242871839275222246405745257275088548364400416034343698204186575808495617"
);

const LOCAL_SNARKJS_BIN = path.join(ZK_DIR, "node_modules", ".bin", "snarkjs");

export const snarkjsBin = () => (fs.existsSync(LOCAL_SNARKJS_BIN) ? LOCAL_SNARKJS_BIN : "snarkjs");
export const circomBin = () => process.env.CIRCOM_BIN || "circom";

// 统一保证输出目录存在，避免各个脚本在写文件前重复 mkdir。
export const ensureDir = (targetPath, isDir = false) => {
  const directory = isDir ? targetPath : path.dirname(targetPath);
  fs.mkdirSync(directory, { recursive: true });
};

// 统一写 JSON 文件，保持仓库里示例产物的缩进和换行风格一致。
export const writeJson = (filePath, value) => {
  ensureDir(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

export const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

// 统一执行外部命令，兼容“直接继承 stdio”和“捕获输出”两种场景。
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
    stdio,
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

// 把教学项目里常用的可读标签编码成 bytes32，便于前端和链上共用同一组标识。
export const asciiToBytes32Hex = (value) => {
  const raw = Buffer.from(value, "utf8");
  assert(raw.length <= 32, "label must fit within bytes32");
  return `0x${Buffer.concat([raw, Buffer.alloc(32 - raw.length)]).toString("hex")}`;
};

export const bytes32HexToField = (value) => BigInt(value) % SNARK_SCALAR_FIELD;

export const addressToField = (value) => BigInt(value.toLowerCase()) % SNARK_SCALAR_FIELD;

export const escapeSolidityString = (value) =>
  value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

export const formatSolidityUintArray = (values) =>
  `[${values.map((value) => `uint256(${BigInt(value).toString()})`).join(", ")}]`;

export const formatSolidityUintNestedArray = (values) =>
  `[${values.map((inner) => formatSolidityUintArray(inner)).join(", ")}]`;

export const parseSolidityCalldata = (value) => JSON.parse(`[${value.trim()}]`);

// 同时提供 2 入、4 入和 5 入 Poseidon，分别服务 Merkle 树、nullifier 和叶子哈希。
export const buildPoseidonHelpers = async () => {
  const poseidon = await buildPoseidon();
  const F = poseidon.F;

  return {
    hash2: (left, right) => BigInt(F.toString(poseidon([BigInt(left), BigInt(right)]))),
    hash4: (inputs) => BigInt(F.toString(poseidon(inputs.map((input) => BigInt(input))))),
    hash5: (inputs) => BigInt(F.toString(poseidon(inputs.map((input) => BigInt(input))))),
  };
};
