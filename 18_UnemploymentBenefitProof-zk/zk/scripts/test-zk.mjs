import fs from "fs";
import path from "path";
import * as snarkjs from "snarkjs";
import {
  CREDENTIALS_DIR,
  CURRENT_V1_SET_FILE,
  CURRENT_V2_SET_FILE,
  SAMPLE_PROGRAM_FILE,
  SAMPLE_PROOF_FILE,
  SAMPLE_PUBLIC_SIGNALS_FILE,
  VERIFICATION_KEY_FILE,
  WASM_FILE,
  ZKEY_FINAL,
  addressToField,
  assert,
  buildPoseidonHelpers,
  readJson
} from "./common.mjs";

const expectFailure = async (label, action) => {
  try {
    await action();
  } catch (_error) {
    console.log(`Expected failure confirmed: ${label}`);
    return;
  }
  throw new Error(`${label} unexpectedly succeeded`);
};

const main = async () => {
  const verificationKey = readJson(VERIFICATION_KEY_FILE);
  const proof = readJson(SAMPLE_PROOF_FILE);
  const publicSignals = readJson(SAMPLE_PUBLIC_SIGNALS_FILE);
  const v1Set = readJson(CURRENT_V1_SET_FILE);
  const v2Set = readJson(CURRENT_V2_SET_FILE);
  const program = readJson(SAMPLE_PROGRAM_FILE);
  const credentials = fs
    .readdirSync(CREDENTIALS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && path.extname(entry.name) === ".json")
    .map((entry) => readJson(path.join(CREDENTIALS_DIR, entry.name)));

  const valid = await snarkjs.groth16.verify(verificationKey, publicSignals, proof);
  assert(valid, "valid sample proof should verify");

  const v1Credential = credentials.find((credential) => credential.versionNumber === v1Set.version);
  const v2Credential = credentials.find((credential) => credential.versionNumber === v2Set.version);

  assert(v1Credential, "generated credentials should include a v1 credential");
  assert(v2Credential, "generated credentials should include a v2 credential");

  const { hash3 } = await buildPoseidonHelpers();
  const baseInput = {
    merkleRoot: v1Credential.merkleRoot,
    programIdField: program.programIdField,
    recipientField: addressToField(v1Credential.boundApplicantAddress).toString(),
    nullifierHash: hash3([v1Credential.identityHash, program.programIdField, v1Credential.walletBinding]).toString(),
    identityHash: v1Credential.identityHash,
    secretSalt: v1Credential.secretSalt,
    walletBinding: v1Credential.walletBinding,
    pathElements: v1Credential.pathElements,
    pathIndices: v1Credential.pathIndices
  };

  await expectFailure("wrong merkle path", async () => {
    const brokenPath = [...baseInput.pathElements];
    brokenPath[0] = (BigInt(brokenPath[0]) + 1n).toString();
    await snarkjs.groth16.fullProve(
      {
        ...baseInput,
        pathElements: brokenPath
      },
      WASM_FILE,
      ZKEY_FINAL
    );
  });

  await expectFailure("credential bound to another wallet", async () => {
    await snarkjs.groth16.fullProve(
      {
        ...baseInput,
        recipientField: (BigInt(baseInput.recipientField) + 1n).toString()
      },
      WASM_FILE,
      ZKEY_FINAL
    );
  });

  await expectFailure("v1 credential cannot satisfy v2 root", async () => {
    await snarkjs.groth16.fullProve(
      {
        ...baseInput,
        merkleRoot: v2Set.merkleRoot
      },
      WASM_FILE,
      ZKEY_FINAL
    );
  });

  const v2Input = {
    merkleRoot: v2Credential.merkleRoot,
    programIdField: program.programIdField,
    recipientField: addressToField(v2Credential.boundApplicantAddress).toString(),
    nullifierHash: hash3([v2Credential.identityHash, program.programIdField, v2Credential.walletBinding]).toString(),
    identityHash: v2Credential.identityHash,
    secretSalt: v2Credential.secretSalt,
    walletBinding: v2Credential.walletBinding,
    pathElements: v2Credential.pathElements,
    pathIndices: v2Credential.pathIndices
  };

  const nextProof = await snarkjs.groth16.fullProve(v2Input, WASM_FILE, ZKEY_FINAL);
  const v2Valid = await snarkjs.groth16.verify(verificationKey, nextProof.publicSignals, nextProof.proof);
  assert(v2Valid, "v2 credential should also verify");

  console.log("ZK tests passed.");
};

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
