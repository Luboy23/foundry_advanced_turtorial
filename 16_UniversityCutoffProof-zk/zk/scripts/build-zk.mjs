import fs from "fs";
import path from "path";
import * as snarkjs from "snarkjs";
import {
  CIRCUIT_BUILD_DIR,
  CIRCUIT_FILE,
  CONTRACTS_DIR,
  CREDENTIALS_DIR,
  GENERATED_DATA_DIR,
  GENERATED_FIXTURE_FILE,
  GENERATED_VERIFIER_FILE,
  INPUT_FILE,
  MERKLE_DEPTH,
  PTAU_0000,
  PTAU_0001,
  PTAU_DIR,
  PTAU_FINAL,
  R1CS_FILE,
  SAMPLE_CREDENTIAL_FILE,
  SAMPLE_PROOF_FILE,
  SAMPLE_PROVING_INPUT_FILE,
  SAMPLE_PUBLIC_SIGNALS_FILE,
  SAMPLE_SCORE_SOURCE_FILE,
  SAMPLE_SCHOOLS_FILE,
  SAMPLE_SOLIDITY_CALLDATA_FILE,
  VERIFICATION_KEY_FILE,
  WASM_FILE,
  ZKEY_0000,
  ZKEY_FINAL,
  asciiToBytes32Hex,
  addressToField,
  assert,
  buildPoseidonHelpers,
  bytes32HexToField,
  circomBin,
  ensureDir,
  escapeSolidityString,
  formatSolidityUintArray,
  formatSolidityUintNestedArray,
  parseSolidityCalldata,
  readJson,
  run,
  snarkjsBin,
  toBigIntString,
  toBytes32Hex,
  writeJson,
} from "./common.mjs";

// 该脚本负责完整生成 16 项目的 ZK 构建产物：
// 1. 成绩树与学生凭证；
// 2. ptau / r1cs / wasm / zkey；
// 3. verifier 合约；
// 4. 测试夹具与样例 proof。
const DEV_BEACON_HASH =
  "16b1d3ae5f66fbe4f6dc8ac31e5aef9f1c3fef8f7df8f8c9f9983d8f6d89e2ab";
const DEV_BEACON_ROUNDS_EXP = "10";

const GENERATED_OUTPUTS = [
  PTAU_FINAL,
  R1CS_FILE,
  WASM_FILE,
  ZKEY_FINAL,
  VERIFICATION_KEY_FILE,
  GENERATED_VERIFIER_FILE,
  GENERATED_FIXTURE_FILE,
  SAMPLE_SCORE_SOURCE_FILE,
  SAMPLE_SCHOOLS_FILE,
  SAMPLE_CREDENTIAL_FILE,
  SAMPLE_PROVING_INPUT_FILE,
  SAMPLE_PROOF_FILE,
  SAMPLE_PUBLIC_SIGNALS_FILE,
  SAMPLE_SOLIDITY_CALLDATA_FILE,
];

// 只要输入和电路没有变化，就尽量复用现有产物，避免每次都重复跑可信设置和 fullProve。
const shouldReuseArtifacts = () => {
  if (process.env.FORCE_ZK_REBUILD === "1") {
    return false;
  }

  if (!GENERATED_OUTPUTS.every((filePath) => fs.existsSync(filePath))) {
    return false;
  }

  const newestInputTime = Math.max(
    fs.statSync(CIRCUIT_FILE).mtimeMs,
    fs.statSync(INPUT_FILE).mtimeMs
  );
  const oldestOutputTime = Math.min(
    ...GENERATED_OUTPUTS.map((filePath) => fs.statSync(filePath).mtimeMs)
  );

  return oldestOutputTime >= newestInputTime;
};

// 从考试院样例成绩出发，在 Node 侧构建完整 Merkle 树并回填每个学生的路径。
const buildMerkleTree = async (scoreSourceIdField, rawRecords) => {
  const { hash2, hash5 } = await buildPoseidonHelpers();

  const records = rawRecords.map((record, index) => ({
    ...record,
    index,
    candidateIdHash: BigInt(record.candidateIdHash),
    score: BigInt(record.score),
    secretSalt: BigInt(record.secretSalt),
    boundStudentAddress: record.boundStudentAddress,
    boundStudentField: addressToField(record.boundStudentAddress),
  }));

  const zeroLeaf = hash5([0n, 0n, 0n, 0n, 0n]);
  const zeroHashes = [zeroLeaf];
  for (let depth = 0; depth < MERKLE_DEPTH; depth += 1) {
    zeroHashes.push(hash2(zeroHashes[depth], zeroHashes[depth]));
  }

  const enrichedRecords = records.map((record) => ({
    ...record,
    leaf: hash5([
      scoreSourceIdField,
      record.candidateIdHash,
      record.score,
      record.secretSalt,
      record.boundStudentField,
    ]),
  }));

  let levelMap = new Map();
  for (const record of enrichedRecords) {
    levelMap.set(BigInt(record.index), record.leaf);
  }

  const levelMaps = [new Map(levelMap)];
  for (let depth = 0; depth < MERKLE_DEPTH; depth += 1) {
    const parentMap = new Map();
    const parentIndexSet = new Set([...levelMap.keys()].map((index) => (index / 2n).toString()));

    if (parentIndexSet.size === 0) {
      parentMap.set(0n, zeroHashes[depth + 1]);
    } else {
      const parentIndexes = [...parentIndexSet]
        .map((value) => BigInt(value))
        .sort((a, b) => (a < b ? -1 : 1));
      for (const parentIndex of parentIndexes) {
        const leftIndex = parentIndex * 2n;
        const rightIndex = leftIndex + 1n;
        const leftNode = levelMap.get(leftIndex) ?? zeroHashes[depth];
        const rightNode = levelMap.get(rightIndex) ?? zeroHashes[depth];
        parentMap.set(parentIndex, hash2(leftNode, rightNode));
      }
    }

    levelMap = parentMap;
    levelMaps.push(new Map(levelMap));
  }

  const merkleRoot = levelMap.get(0n) ?? zeroHashes[MERKLE_DEPTH];

  const credentials = enrichedRecords.map((record) => {
    let currentIndex = BigInt(record.index);
    const pathElements = [];
    const pathIndices = [];

    for (let depth = 0; depth < MERKLE_DEPTH; depth += 1) {
      const siblingIndex = currentIndex ^ 1n;
      const siblingValue = levelMaps[depth].get(siblingIndex) ?? zeroHashes[depth];
      pathElements.push(toBigIntString(siblingValue));
      pathIndices.push(Number(currentIndex & 1n));
      currentIndex >>= 1n;
    }

    return {
      candidateLabel: record.candidateLabel,
      candidateIdHash: toBigIntString(record.candidateIdHash),
      score: Number(record.score),
      secretSalt: toBigIntString(record.secretSalt),
      boundStudentAddress: record.boundStudentAddress,
      boundStudentField: toBigIntString(record.boundStudentField),
      leaf: toBigIntString(record.leaf),
      pathElements,
      pathIndices,
    };
  });

  return { credentials, merkleRoot };
};

// 准备 powers of tau 产物。
const preparePtau = () => {
  console.log("Step 1/5: preparing ptau...");
  if (fs.existsSync(PTAU_FINAL)) {
    console.log(`Reusing ${path.relative(CONTRACTS_DIR, PTAU_FINAL)}`);
    return;
  }

  ensureDir(PTAU_DIR, true);
  run(snarkjsBin(), ["powersoftau", "new", "bn128", "14", PTAU_0000]);
  run(snarkjsBin(), ["powersoftau", "beacon", PTAU_0000, PTAU_0001, DEV_BEACON_HASH, DEV_BEACON_ROUNDS_EXP]);
  run(snarkjsBin(), ["powersoftau", "prepare", "phase2", PTAU_0001, PTAU_FINAL]);
};

// 编译 circom 电路，生成 r1cs / wasm / sym。
const compileCircuit = () => {
  console.log("Step 2/5: compiling circuit...");
  ensureDir(CIRCUIT_BUILD_DIR, true);
  run(circomBin(), [CIRCUIT_FILE, "--r1cs", "--wasm", "--sym", "-o", CIRCUIT_BUILD_DIR], {
    cwd: path.dirname(CIRCUIT_FILE),
  });
};

// 基于 R1CS 和 PTAU 建立最终 zkey，并导出 verification key。
const setupZkey = () => {
  console.log("Step 3/5: setting up zkey...");
  run(snarkjsBin(), ["groth16", "setup", R1CS_FILE, PTAU_FINAL, ZKEY_0000]);
  run(snarkjsBin(), ["zkey", "beacon", ZKEY_0000, ZKEY_FINAL, DEV_BEACON_HASH, DEV_BEACON_ROUNDS_EXP]);
  run(snarkjsBin(), ["zkey", "export", "verificationkey", ZKEY_FINAL, VERIFICATION_KEY_FILE]);
};

// 从 zkey 导出 Solidity verifier，并把默认合约名替换成项目内使用的命名。
const exportVerifier = () => {
  console.log("Step 4/5: exporting verifier...");
  const tempFile = `${GENERATED_VERIFIER_FILE}.tmp`;
  run(snarkjsBin(), ["zkey", "export", "solidityverifier", ZKEY_FINAL, tempFile]);

  let source = fs.readFileSync(tempFile, "utf8");
  if (!source.startsWith("// SPDX-License-Identifier:")) {
    source = `// SPDX-License-Identifier: MIT\n${source}`;
  }
  source = source.replace(/pragma solidity >=0\.7\.0 <0\.9\.0;/, "pragma solidity 0.8.20;");
  source = source.replace(/pragma solidity \^0\.8\.0;/, "pragma solidity 0.8.20;");
  source = source.replace(
    /contract Groth16Verifier/g,
    "contract UniversityCutoffProofVerifier"
  );

  ensureDir(GENERATED_VERIFIER_FILE);
  fs.writeFileSync(GENERATED_VERIFIER_FILE, source);
  fs.rmSync(tempFile, { force: true });
};

// 生成 Foundry 测试夹具，让合约测试可以直接复用这批离线样例。
const generateFixture = ({
  scoreSourceIdBytes32,
  sourceTitle,
  merkleRoot,
  maxScore,
  sampleRecipientAddress,
  sampleScore,
  schools,
  successSchool,
  nullifierHash,
  proofA,
  proofB,
  proofC,
  publicSignals,
}) => {
  assert(schools.length === 2, "fixture generation expects exactly two schools");
  const [firstSchool, secondSchool] = schools;

  const fixtureSource = `// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

library SampleAdmissionFixture {
    function scoreSourceId() internal pure returns (bytes32) {
        return ${scoreSourceIdBytes32};
    }

    function scoreSourceTitle() internal pure returns (string memory) {
        return unicode"${escapeSolidityString(sourceTitle)}";
    }

    function merkleRoot() internal pure returns (uint256) {
        return uint256(${toBigIntString(merkleRoot)});
    }

    function maxScore() internal pure returns (uint32) {
        return ${maxScore};
    }

    function sampleRecipient() internal pure returns (address) {
        return ${sampleRecipientAddress};
    }

    function sampleScore() internal pure returns (uint32) {
        return ${sampleScore};
    }

    function pkuSchoolId() internal pure returns (bytes32) {
        return ${firstSchool.schoolIdBytes32};
    }

    function pkuSchoolName() internal pure returns (string memory) {
        return unicode"${escapeSolidityString(firstSchool.schoolName)}";
    }

    function pkuCutoff() internal pure returns (uint32) {
        return ${firstSchool.cutoffScore};
    }

    function jiatingdunSchoolId() internal pure returns (bytes32) {
        return ${secondSchool.schoolIdBytes32};
    }

    function jiatingdunSchoolName() internal pure returns (string memory) {
        return unicode"${escapeSolidityString(secondSchool.schoolName)}";
    }

    function jiatingdunCutoff() internal pure returns (uint32) {
        return ${secondSchool.cutoffScore};
    }

    function sampleSuccessSchoolId() internal pure returns (bytes32) {
        return ${successSchool.schoolIdBytes32};
    }

    function sampleSuccessCutoff() internal pure returns (uint32) {
        return ${successSchool.cutoffScore};
    }

    function sampleNullifierHash() internal pure returns (uint256) {
        return uint256(${toBigIntString(nullifierHash)});
    }

    function proofA() internal pure returns (uint256[2] memory value) {
        value = ${formatSolidityUintArray(proofA)};
    }

    function proofB() internal pure returns (uint256[2][2] memory value) {
        value = ${formatSolidityUintNestedArray(proofB)};
    }

    function proofC() internal pure returns (uint256[2] memory value) {
        value = ${formatSolidityUintArray(proofC)};
    }

    function publicSignals() internal pure returns (uint256[6] memory value) {
        value = ${formatSolidityUintArray(publicSignals)};
    }
}
`;

  ensureDir(GENERATED_FIXTURE_FILE);
  fs.writeFileSync(GENERATED_FIXTURE_FILE, fixtureSource);
};

// 构建主入口：读取输入、生成样例数据、编译电路、导出 proof 与 verifier。
const main = async () => {
  if (shouldReuseArtifacts()) {
    console.log("Reusing existing ZK artifacts. Set FORCE_ZK_REBUILD=1 to rebuild.");
    return;
  }

  const input = readJson(INPUT_FILE);
  const { scoreSource, schools: rawSchools, records } = input;
  assert(Array.isArray(rawSchools) && rawSchools.length === 2, "sample input must define exactly two schools");

  const scoreSourceIdBytes32 = asciiToBytes32Hex(scoreSource.scoreSourceIdLabel);
  const scoreSourceIdField = bytes32HexToField(scoreSourceIdBytes32);
  ensureDir(GENERATED_DATA_DIR, true);
  ensureDir(CREDENTIALS_DIR, true);

  const { credentials, merkleRoot } = await buildMerkleTree(scoreSourceIdField, records);
  const sampleCredential = credentials[0];
  const sampleRecipientAddress = sampleCredential.boundStudentAddress;
  const recipientField = addressToField(sampleRecipientAddress);

  const schools = rawSchools.map((school) => {
    const schoolIdBytes32 = asciiToBytes32Hex(school.schoolIdLabel);
    const universityKeyBytes32 = asciiToBytes32Hex(school.schoolIdLabel);
    return {
      universityKey: school.schoolIdLabel,
      universityKeyBytes32,
      schoolIdLabel: school.schoolIdLabel,
      schoolIdBytes32,
      schoolIdField: toBigIntString(bytes32HexToField(schoolIdBytes32)),
      schoolName: school.schoolName,
      cutoffScore: Number(school.cutoffScore),
      active: true,
    };
  });

  // 默认挑出第一位能通过某所学校录取线的学生，作为教学链路中的成功样例。
  const successSchool = schools.find((school) => sampleCredential.score >= school.cutoffScore);
  assert(successSchool, "sample credential must satisfy at least one school cutoff");

  const { hash4 } = await buildPoseidonHelpers();
  const nullifierHash = hash4([
    bytes32HexToField(successSchool.schoolIdBytes32),
    BigInt(sampleCredential.candidateIdHash),
    recipientField,
    scoreSourceIdField,
  ]);

  const scoreSourcePayload = {
    scoreSourceIdLabel: scoreSource.scoreSourceIdLabel,
    scoreSourceIdBytes32,
    scoreSourceIdField: toBigIntString(scoreSourceIdField),
    sourceTitle: scoreSource.sourceTitle,
    maxScore: scoreSource.maxScore,
    merkleDepth: MERKLE_DEPTH,
    merkleRoot: toBigIntString(merkleRoot),
    merkleRootHex: toBytes32Hex(merkleRoot),
  };

  const credentialPayloads = credentials.map((credential, index) => ({
    version: 2,
    scoreSourceId: scoreSource.scoreSourceIdLabel,
    scoreSourceIdBytes32,
    scoreSourceTitle: scoreSource.sourceTitle,
    boundStudentAddress: credential.boundStudentAddress,
    boundStudentField: credential.boundStudentField,
    candidateLabel: credential.candidateLabel,
    candidateIdHash: credential.candidateIdHash,
    score: credential.score,
    maxScore: scoreSource.maxScore,
    secretSalt: credential.secretSalt,
    leaf: credential.leaf,
    merkleRoot: toBigIntString(merkleRoot),
    pathElements: credential.pathElements,
    pathIndices: credential.pathIndices,
    issuedAt: 1760000000 + index,
  }));

  const sampleCredentialPayload = credentialPayloads[0];

  // 这份证明输入会被前端测试、zk 自测和合约 fixture 共用，因此必须保持字段顺序稳定。
  const sampleProvingInput = {
    merkleRoot: toBigIntString(merkleRoot),
    scoreSourceIdField: toBigIntString(scoreSourceIdField),
    schoolIdField: successSchool.schoolIdField,
    cutoffScore: String(successSchool.cutoffScore),
    recipientField: toBigIntString(recipientField),
    nullifierHash: toBigIntString(nullifierHash),
    candidateIdHash: sampleCredentialPayload.candidateIdHash,
    score: sampleCredentialPayload.score.toString(),
    secretSalt: sampleCredentialPayload.secretSalt,
    boundStudentField: sampleCredentialPayload.boundStudentField,
    pathElements: sampleCredentialPayload.pathElements,
    pathIndices: sampleCredentialPayload.pathIndices,
  };

  writeJson(SAMPLE_SCORE_SOURCE_FILE, scoreSourcePayload);
  writeJson(SAMPLE_SCHOOLS_FILE, schools);
  writeJson(SAMPLE_CREDENTIAL_FILE, sampleCredentialPayload);
  writeJson(SAMPLE_PROVING_INPUT_FILE, sampleProvingInput);

  credentialPayloads.forEach((payload, index) => {
    writeJson(path.join(CREDENTIALS_DIR, `candidate-${index + 1}.json`), payload);
  });

  preparePtau();
  compileCircuit();
  setupZkey();
  exportVerifier();

  // 用生成好的样例输入直接跑一遍 fullProve，确保最终产物是真正可用的。
  console.log("Step 5/5: generating sample proof...");
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    sampleProvingInput,
    WASM_FILE,
    ZKEY_FINAL
  );

  writeJson(SAMPLE_PROOF_FILE, proof);
  writeJson(SAMPLE_PUBLIC_SIGNALS_FILE, publicSignals);

  const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
  const [proofA, proofB, proofC, solidityPublicSignals] = parseSolidityCalldata(calldata);

  writeJson(SAMPLE_SOLIDITY_CALLDATA_FILE, {
    a: proofA,
    b: proofB,
    c: proofC,
    publicSignals: solidityPublicSignals,
  });

  generateFixture({
    scoreSourceIdBytes32,
    sourceTitle: scoreSource.sourceTitle,
    merkleRoot,
    maxScore: scoreSource.maxScore,
    sampleRecipientAddress,
    sampleScore: sampleCredentialPayload.score,
    schools,
    successSchool,
    nullifierHash,
    proofA,
    proofB,
    proofC,
    publicSignals: solidityPublicSignals,
  });

  console.log("Built ZK artifacts:");
  console.log(`- ${path.relative(CONTRACTS_DIR, SAMPLE_SCORE_SOURCE_FILE)}`);
  console.log(`- ${path.relative(CONTRACTS_DIR, SAMPLE_SCHOOLS_FILE)}`);
  console.log(`- ${path.relative(CONTRACTS_DIR, SAMPLE_CREDENTIAL_FILE)}`);
  console.log(`- ${path.relative(CONTRACTS_DIR, SAMPLE_PROVING_INPUT_FILE)}`);
  console.log(`- ${path.relative(CONTRACTS_DIR, SAMPLE_PROOF_FILE)}`);
  console.log(`- ${path.relative(CONTRACTS_DIR, SAMPLE_PUBLIC_SIGNALS_FILE)}`);
  console.log(`- ${path.relative(CONTRACTS_DIR, GENERATED_VERIFIER_FILE)}`);
  console.log(`- ${path.relative(CONTRACTS_DIR, GENERATED_FIXTURE_FILE)}`);
};

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
