import fs from "fs";
import path from "path";
import * as snarkjs from "snarkjs";
import {
  BUILD_DIR,
  CIRCUIT_BUILD_DIR,
  CIRCUIT_FILE,
  CONTRACTS_DIR,
  CREDENTIALS_DIR,
  CURRENT_V1_SET_FILE,
  CURRENT_V2_SET_FILE,
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
  SAMPLE_PROGRAM_FILE,
  SAMPLE_PROOF_FILE,
  SAMPLE_PUBLIC_SIGNALS_FILE,
  SAMPLE_SOLIDITY_CALLDATA_FILE,
  VERIFICATION_KEY_FILE,
  WASM_FILE,
  ZKEY_0000,
  ZKEY_FINAL,
  addressToField,
  asciiToBytes32Hex,
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
  writeJson
} from "./common.mjs";

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
  CURRENT_V1_SET_FILE,
  CURRENT_V2_SET_FILE,
  SAMPLE_PROGRAM_FILE,
  SAMPLE_PROOF_FILE,
  SAMPLE_PUBLIC_SIGNALS_FILE,
  SAMPLE_SOLIDITY_CALLDATA_FILE
];

const shouldReuseArtifacts = () => {
  if (process.env.FORCE_ZK_REBUILD === "1") {
    return false;
  }

  if (!GENERATED_OUTPUTS.every((filePath) => fs.existsSync(filePath))) {
    return false;
  }

  const newestInputTime = Math.max(fs.statSync(CIRCUIT_FILE).mtimeMs, fs.statSync(INPUT_FILE).mtimeMs);
  const oldestOutputTime = Math.min(...GENERATED_OUTPUTS.map((filePath) => fs.statSync(filePath).mtimeMs));

  return oldestOutputTime >= newestInputTime;
};

const buildMerkleTree = async (rawRecords) => {
  const { hash2, hash3 } = await buildPoseidonHelpers();

  const records = rawRecords.map((record, index) => ({
    ...record,
    index,
    identityHash: BigInt(record.identityHash),
    secretSalt: BigInt(record.secretSalt),
    boundApplicantAddress: record.boundApplicantAddress,
    walletBinding: addressToField(record.boundApplicantAddress)
  }));

  const zeroLeaf = hash3([0n, 0n, 0n]);
  const zeroHashes = [zeroLeaf];
  for (let depth = 0; depth < MERKLE_DEPTH; depth += 1) {
    zeroHashes.push(hash2(zeroHashes[depth], zeroHashes[depth]));
  }

  const enrichedRecords = records.map((record) => ({
    ...record,
    leaf: hash3([record.identityHash, record.secretSalt, record.walletBinding])
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
      applicantLabel: record.applicantLabel,
      identityHash: toBigIntString(record.identityHash),
      secretSalt: toBigIntString(record.secretSalt),
      boundApplicantAddress: record.boundApplicantAddress,
      walletBinding: toBigIntString(record.walletBinding),
      leaf: toBigIntString(record.leaf),
      pathElements,
      pathIndices
    };
  });

  return { credentials, merkleRoot };
};

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

const compileCircuit = () => {
  console.log("Step 2/5: compiling circuit...");
  ensureDir(CIRCUIT_BUILD_DIR, true);
  run(circomBin(), [CIRCUIT_FILE, "--r1cs", "--wasm", "--sym", "-o", CIRCUIT_BUILD_DIR], {
    cwd: path.dirname(CIRCUIT_FILE)
  });
};

const setupZkey = () => {
  console.log("Step 3/5: setting up zkey...");
  run(snarkjsBin(), ["groth16", "setup", R1CS_FILE, PTAU_FINAL, ZKEY_0000]);
  run(snarkjsBin(), ["zkey", "beacon", ZKEY_0000, ZKEY_FINAL, DEV_BEACON_HASH, DEV_BEACON_ROUNDS_EXP]);
  run(snarkjsBin(), ["zkey", "export", "verificationkey", ZKEY_FINAL, VERIFICATION_KEY_FILE]);
};

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
  source = source.replace(/contract Groth16Verifier/g, "contract UnemploymentBenefitProofVerifier");

  ensureDir(GENERATED_VERIFIER_FILE);
  fs.writeFileSync(GENERATED_VERIFIER_FILE, source);
  fs.rmSync(tempFile, { force: true });
};

const buildCredentialSetPayload = ({
  setIdLabel,
  setIdBytes32,
  sourceTitle,
  version,
  referenceDate,
  merkleRoot,
  credentials
}) => ({
  setIdLabel,
  setIdBytes32,
  sourceTitle,
  version,
  referenceDate,
  merkleDepth: MERKLE_DEPTH,
  merkleRoot: toBigIntString(merkleRoot),
  merkleRootHex: toBytes32Hex(merkleRoot),
  eligibleCount: credentials.length
});

const generateFixture = ({
  setIdBytes32,
  sourceTitle,
  programIdBytes32,
  programIdField,
  benefitAmountWei,
  v1,
  v2,
  sampleRecipientAddress,
  nullifierHash,
  proofA,
  proofB,
  proofC,
  publicSignals
}) => {
  const fixtureSource = `// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

library SampleUnemploymentBenefitFixture {
    function credentialSetId() internal pure returns (bytes32) {
        return ${setIdBytes32};
    }

    function sourceTitle() internal pure returns (string memory) {
        return unicode"${escapeSolidityString(sourceTitle)}";
    }

    function programId() internal pure returns (bytes32) {
        return ${programIdBytes32};
    }

    function programIdField() internal pure returns (uint256) {
        return uint256(${programIdField});
    }

    function benefitAmountWei() internal pure returns (uint256) {
        return uint256(${benefitAmountWei});
    }

    function v1MerkleRoot() internal pure returns (uint256) {
        return uint256(${toBigIntString(v1.merkleRoot)});
    }

    function v1Version() internal pure returns (uint32) {
        return ${v1.version};
    }

    function v1ReferenceDate() internal pure returns (uint64) {
        return ${v1.referenceDate};
    }

    function v1EligibleCount() internal pure returns (uint32) {
        return ${v1.eligibleCount};
    }

    function v2MerkleRoot() internal pure returns (uint256) {
        return uint256(${toBigIntString(v2.merkleRoot)});
    }

    function v2Version() internal pure returns (uint32) {
        return ${v2.version};
    }

    function v2ReferenceDate() internal pure returns (uint64) {
        return ${v2.referenceDate};
    }

    function v2EligibleCount() internal pure returns (uint32) {
        return ${v2.eligibleCount};
    }

    function sampleRecipient() internal pure returns (address) {
        return ${sampleRecipientAddress};
    }

    function nullifierHash() internal pure returns (uint256) {
        return uint256(${toBigIntString(nullifierHash)});
    }

    function nullifierHashBytes32() internal pure returns (bytes32) {
        return bytes32(uint256(${toBigIntString(nullifierHash)}));
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

    function publicSignals() internal pure returns (uint256[4] memory value) {
        value = ${formatSolidityUintArray(publicSignals)};
    }
}
`;

  ensureDir(GENERATED_FIXTURE_FILE);
  fs.writeFileSync(GENERATED_FIXTURE_FILE, fixtureSource);
};

const main = async () => {
  if (shouldReuseArtifacts()) {
    console.log("Reusing existing ZK artifacts. Set FORCE_ZK_REBUILD=1 to rebuild.");
    return;
  }

  const input = readJson(INPUT_FILE);
  const { credentialSet } = input;
  const { v1, v2 } = credentialSet;

  assert(Array.isArray(v1.records) && v1.records.length > 0, "v1 must contain at least one eligible applicant");
  assert(Array.isArray(v2.records) && v2.records.length > 0, "v2 must contain at least one eligible applicant");

  const setIdBytes32 = asciiToBytes32Hex(credentialSet.setIdLabel);
  const programIdBytes32 = asciiToBytes32Hex(credentialSet.programIdLabel);
  const programIdField = bytes32HexToField(programIdBytes32);

  ensureDir(GENERATED_DATA_DIR, true);
  ensureDir(CREDENTIALS_DIR, true);
  for (const entry of fs.readdirSync(CREDENTIALS_DIR, { withFileTypes: true })) {
    if (entry.isFile() && path.extname(entry.name) === ".json") {
      fs.rmSync(path.join(CREDENTIALS_DIR, entry.name), { force: true });
    }
  }

  const v1Tree = await buildMerkleTree(v1.records);
  const v2Tree = await buildMerkleTree(v2.records);
  const { hash3 } = await buildPoseidonHelpers();

  const v1Credentials = v1Tree.credentials.map((credential, index) => ({
    version: 1,
    setId: credentialSet.setIdLabel,
    setIdBytes32,
    sourceTitle: credentialSet.sourceTitle,
    versionNumber: v1.version,
    referenceDate: v1.referenceDate,
    boundApplicantAddress: credential.boundApplicantAddress,
    walletBinding: credential.walletBinding,
    identityHash: credential.identityHash,
    secretSalt: credential.secretSalt,
    leaf: credential.leaf,
    merkleRoot: toBigIntString(v1Tree.merkleRoot),
    pathElements: credential.pathElements,
    pathIndices: credential.pathIndices,
    issuedAt: v1.referenceDate + index,
    applicantLabel: credential.applicantLabel
  }));

  const v2Credentials = v2Tree.credentials.map((credential, index) => ({
    version: 1,
    setId: credentialSet.setIdLabel,
    setIdBytes32,
    sourceTitle: credentialSet.sourceTitle,
    versionNumber: v2.version,
    referenceDate: v2.referenceDate,
    boundApplicantAddress: credential.boundApplicantAddress,
    walletBinding: credential.walletBinding,
    identityHash: credential.identityHash,
    secretSalt: credential.secretSalt,
    leaf: credential.leaf,
    merkleRoot: toBigIntString(v2Tree.merkleRoot),
    pathElements: credential.pathElements,
    pathIndices: credential.pathIndices,
    issuedAt: v2.referenceDate + index,
    applicantLabel: credential.applicantLabel
  }));

  const sampleCredential = v1Credentials[0];
  const sampleRecipientAddress = sampleCredential.boundApplicantAddress;
  const recipientField = addressToField(sampleRecipientAddress);
  const nullifierHash = hash3([sampleCredential.identityHash, programIdField, sampleCredential.walletBinding]);

  const sampleProvingInput = {
    merkleRoot: toBigIntString(v1Tree.merkleRoot),
    programIdField: toBigIntString(programIdField),
    recipientField: toBigIntString(recipientField),
    nullifierHash: toBigIntString(nullifierHash),
    identityHash: sampleCredential.identityHash,
    secretSalt: sampleCredential.secretSalt,
    walletBinding: sampleCredential.walletBinding,
    pathElements: sampleCredential.pathElements,
    pathIndices: sampleCredential.pathIndices
  };

  const v1SetPayload = buildCredentialSetPayload({
    setIdLabel: credentialSet.setIdLabel,
    setIdBytes32,
    sourceTitle: credentialSet.sourceTitle,
    version: v1.version,
    referenceDate: v1.referenceDate,
    merkleRoot: v1Tree.merkleRoot,
    credentials: v1Credentials
  });

  const v2SetPayload = buildCredentialSetPayload({
    setIdLabel: credentialSet.setIdLabel,
    setIdBytes32,
    sourceTitle: credentialSet.sourceTitle,
    version: v2.version,
    referenceDate: v2.referenceDate,
    merkleRoot: v2Tree.merkleRoot,
    credentials: v2Credentials
  });

  writeJson(CURRENT_V1_SET_FILE, v1SetPayload);
  writeJson(CURRENT_V2_SET_FILE, v2SetPayload);
  writeJson(SAMPLE_PROGRAM_FILE, {
    programIdLabel: credentialSet.programIdLabel,
    programIdBytes32,
    programIdField: toBigIntString(programIdField),
    programTitle: credentialSet.programTitle,
    benefitAmountWei: credentialSet.benefitAmountWei,
    benefitAmountEth: "100",
    demoNote: "该金额为教学演示值，不代表真实政策金额。"
  });

  v1Credentials.forEach((payload, index) => {
    writeJson(path.join(CREDENTIALS_DIR, `applicant-v1-${index + 1}.json`), payload);
  });
  v2Credentials.forEach((payload, index) => {
    writeJson(path.join(CREDENTIALS_DIR, `applicant-v2-${index + 1}.json`), payload);
  });

  preparePtau();
  compileCircuit();
  setupZkey();
  exportVerifier();

  console.log("Step 5/5: generating sample proof...");
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(sampleProvingInput, WASM_FILE, ZKEY_FINAL);

  writeJson(SAMPLE_PROOF_FILE, proof);
  writeJson(SAMPLE_PUBLIC_SIGNALS_FILE, publicSignals);

  const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
  const [proofA, proofB, proofC, solidityPublicSignals] = parseSolidityCalldata(calldata);

  writeJson(SAMPLE_SOLIDITY_CALLDATA_FILE, {
    a: proofA,
    b: proofB,
    c: proofC,
    publicSignals: solidityPublicSignals
  });

  generateFixture({
    setIdBytes32,
    sourceTitle: credentialSet.sourceTitle,
    programIdBytes32,
    programIdField: toBigIntString(programIdField),
    benefitAmountWei: credentialSet.benefitAmountWei,
    v1: {
      ...v1SetPayload,
      merkleRoot: v1Tree.merkleRoot
    },
    v2: {
      ...v2SetPayload,
      merkleRoot: v2Tree.merkleRoot
    },
    sampleRecipientAddress,
    nullifierHash,
    proofA,
    proofB,
    proofC,
    publicSignals: solidityPublicSignals
  });

  console.log("Built ZK artifacts:");
  console.log(`- ${path.relative(CONTRACTS_DIR, CURRENT_V1_SET_FILE)}`);
  console.log(`- ${path.relative(CONTRACTS_DIR, CURRENT_V2_SET_FILE)}`);
  console.log(`- ${path.relative(CONTRACTS_DIR, SAMPLE_PROGRAM_FILE)}`);
  console.log(`- ${path.relative(CONTRACTS_DIR, CREDENTIALS_DIR)}`);
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
