import fs from "fs";
import path from "path";
import * as snarkjs from "snarkjs";
import {
  BUILD_DIR,
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
  SAMPLE_CREDENTIAL_SET_FILE,
  SAMPLE_PRODUCTS_FILE,
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
  eligibleFromBirthTimestamp,
  ensureDir,
  escapeSolidityString,
  formatSolidityUintArray,
  formatSolidityUintNestedArray,
  parseSolidityCalldata,
  readJson,
  run,
  snarkjsBin,
  unixTimestampToUtcYmd,
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
  SAMPLE_CREDENTIAL_SET_FILE,
  SAMPLE_PRODUCTS_FILE,
  SAMPLE_PROOF_FILE,
  SAMPLE_PUBLIC_SIGNALS_FILE,
  SAMPLE_SOLIDITY_CALLDATA_FILE
];

const OBSOLETE_GENERATED_FILES = [
  path.join(GENERATED_DATA_DIR, "sample-credentials.json"),
  path.join(GENERATED_DATA_DIR, "sample-credential.json"),
  path.join(GENERATED_DATA_DIR, "sample-proving-input.json")
];

const cleanupObsoleteGeneratedFiles = () => {
  for (const filePath of OBSOLETE_GENERATED_FILES) {
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
    }
  }
};

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

const buildMerkleTree = async (versionField, rawRecords) => {
  const { hash2, hash5 } = await buildPoseidonHelpers();

  const records = rawRecords.map((record, index) => ({
    ...record,
    index,
    identityHash: BigInt(record.identityHash),
    eligibleFromYmd: BigInt(record.eligibleFromYmd),
    secretSalt: BigInt(record.secretSalt),
    boundBuyerAddress: record.boundBuyerAddress,
    walletBinding: addressToField(record.boundBuyerAddress)
  }));

  const zeroLeaf = hash5([0n, 0n, 0n, 0n, 0n]);
  const zeroHashes = [zeroLeaf];
  for (let depth = 0; depth < MERKLE_DEPTH; depth += 1) {
    zeroHashes.push(hash2(zeroHashes[depth], zeroHashes[depth]));
  }

  const enrichedRecords = records.map((record) => ({
    ...record,
    leaf: hash5([
      versionField,
      record.identityHash,
      record.eligibleFromYmd,
      record.secretSalt,
      record.walletBinding
    ])
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
      buyerLabel: record.buyerLabel,
      identityHash: toBigIntString(record.identityHash),
      eligibleFromYmd: Number(record.eligibleFromYmd),
      secretSalt: toBigIntString(record.secretSalt),
      boundBuyerAddress: record.boundBuyerAddress,
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
  source = source.replace(/contract Groth16Verifier/g, "contract AlcoholAgeProofVerifier");

  ensureDir(GENERATED_VERIFIER_FILE);
  fs.writeFileSync(GENERATED_VERIFIER_FILE, source);
  fs.rmSync(tempFile, { force: true });
};

const generateFixture = ({
  setIdBytes32,
  sourceTitle,
  merkleRoot,
  version,
  referenceDate,
  sampleVerificationDateYmd,
  sampleRecipientAddress,
  products,
  proofA,
  proofB,
  proofC,
  publicSignals
}) => {
  assert(products.length === 2, "fixture generation expects exactly two products");
  const [firstProduct, secondProduct] = products;

  const fixtureSource = `// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

library SampleAlcoholAgeFixture {
    function credentialSetId() internal pure returns (bytes32) {
        return ${setIdBytes32};
    }

    function sourceTitle() internal pure returns (string memory) {
        return unicode"${escapeSolidityString(sourceTitle)}";
    }

    function merkleRoot() internal pure returns (uint256) {
        return uint256(${toBigIntString(merkleRoot)});
    }

    function version() internal pure returns (uint32) {
        return ${version};
    }

    function referenceDate() internal pure returns (uint64) {
        return ${referenceDate};
    }

    function sampleVerificationDateYmd() internal pure returns (uint32) {
        return ${sampleVerificationDateYmd};
    }

    function sampleRecipient() internal pure returns (address) {
        return ${sampleRecipientAddress};
    }

    function firstProductId() internal pure returns (bytes32) {
        return ${firstProduct.productIdBytes32};
    }

    function firstProductPriceWei() internal pure returns (uint256) {
        return uint256(${firstProduct.priceWei});
    }

    function firstProductStock() internal pure returns (uint32) {
        return ${firstProduct.stock};
    }

    function secondProductId() internal pure returns (bytes32) {
        return ${secondProduct.productIdBytes32};
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
  cleanupObsoleteGeneratedFiles();

  if (shouldReuseArtifacts()) {
    console.log("Reusing existing ZK artifacts. Set FORCE_ZK_REBUILD=1 to rebuild.");
    return;
  }

  const input = readJson(INPUT_FILE);
  const { credentialSet, products: rawProducts, records } = input;
  assert(Array.isArray(rawProducts) && rawProducts.length === 2, "sample input must define exactly two products");

  const setIdBytes32 = asciiToBytes32Hex(credentialSet.setIdLabel);
  const setIdField = bytes32HexToField(setIdBytes32);
  const versionField = BigInt(credentialSet.version);
  const sampleVerificationDateYmd = unixTimestampToUtcYmd(credentialSet.referenceDate);

  ensureDir(GENERATED_DATA_DIR, true);
  ensureDir(CREDENTIALS_DIR, true);
  for (const entry of fs.readdirSync(CREDENTIALS_DIR, { withFileTypes: true })) {
    if (entry.isFile() && path.extname(entry.name) === ".json") {
      fs.rmSync(path.join(CREDENTIALS_DIR, entry.name), { force: true });
    }
  }

  const merkleRecords = records.map((record) => ({
    ...record,
    eligibleFromYmd: eligibleFromBirthTimestamp(record.birthDate)
  }));

  const { credentials, merkleRoot } = await buildMerkleTree(versionField, merkleRecords);
  const sampleCredential = credentials[0];
  const sampleRecipientAddress = sampleCredential.boundBuyerAddress;
  const recipientField = addressToField(sampleRecipientAddress);

  const products = rawProducts.map((product) => {
    const productIdBytes32 = asciiToBytes32Hex(product.productIdLabel);
      return {
        productIdLabel: product.productIdLabel,
        productIdBytes32,
        name: product.name,
        category: product.category,
        description: product.description,
        imageSrc: product.imageSrc,
        metadataURI: product.metadataURI,
        priceWei: String(product.priceWei),
        stock: Number(product.stock),
        active: true
      };
  });

  const credentialsPayload = credentials.map((credential, index) => {
    const issuedAt = credentialSet.referenceDate + index;
    return {
      version: 1,
      setId: credentialSet.setIdLabel,
      setIdBytes32,
      sourceTitle: credentialSet.sourceTitle,
      versionNumber: credentialSet.version,
      buyerLabel: credential.buyerLabel,
      boundBuyerAddress: credential.boundBuyerAddress,
      walletBinding: credential.walletBinding,
      identityHash: credential.identityHash,
      eligibleFromYmd: credential.eligibleFromYmd,
      birthDateMasked: new Date(Number(records[index].birthDate) * 1000).toISOString().slice(0, 7),
      secretSalt: credential.secretSalt,
      leaf: credential.leaf,
      merkleRoot: toBigIntString(merkleRoot),
      pathElements: credential.pathElements,
      pathIndices: credential.pathIndices,
      issuedAt
    };
  });

  const sampleCredentialPayload = credentialsPayload[0];

  const sampleProvingInput = {
    merkleRoot: toBigIntString(merkleRoot),
    version: String(credentialSet.version),
    verificationDateYmd: String(sampleVerificationDateYmd),
    recipientField: toBigIntString(recipientField),
    identityHash: sampleCredentialPayload.identityHash,
    eligibleFromYmd: String(sampleCredentialPayload.eligibleFromYmd),
    secretSalt: sampleCredentialPayload.secretSalt,
    walletBinding: sampleCredentialPayload.walletBinding,
    pathElements: sampleCredentialPayload.pathElements,
    pathIndices: sampleCredentialPayload.pathIndices
  };

  writeJson(SAMPLE_CREDENTIAL_SET_FILE, {
    setIdLabel: credentialSet.setIdLabel,
    setIdBytes32,
    setIdField: toBigIntString(setIdField),
    versionField: toBigIntString(versionField),
    sourceTitle: credentialSet.sourceTitle,
    version: credentialSet.version,
    referenceDate: credentialSet.referenceDate,
    sampleVerificationDateYmd,
    merkleDepth: MERKLE_DEPTH,
    merkleRoot: toBigIntString(merkleRoot),
    merkleRootHex: toBytes32Hex(merkleRoot),
    buyerAddresses: credentialsPayload.map((payload) => payload.boundBuyerAddress)
  });
  writeJson(SAMPLE_PRODUCTS_FILE, products);

  credentialsPayload.forEach((payload, index) => {
    writeJson(path.join(CREDENTIALS_DIR, `buyer-${index + 1}.json`), payload);
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
    merkleRoot,
    version: credentialSet.version,
    referenceDate: credentialSet.referenceDate,
    sampleVerificationDateYmd,
    sampleRecipientAddress,
    products,
    proofA,
    proofB,
    proofC,
    publicSignals: solidityPublicSignals
  });

  console.log("Built ZK artifacts:");
  console.log(`- ${path.relative(CONTRACTS_DIR, SAMPLE_CREDENTIAL_SET_FILE)}`);
  console.log(`- ${path.relative(CONTRACTS_DIR, SAMPLE_PRODUCTS_FILE)}`);
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
