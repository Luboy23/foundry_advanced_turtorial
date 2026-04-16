import fs from "fs";
import path from "path";
import * as snarkjs from "snarkjs";
import {
  CREDENTIALS_DIR,
  SAMPLE_CREDENTIAL_SET_FILE,
  SAMPLE_PROOF_FILE,
  SAMPLE_PUBLIC_SIGNALS_FILE,
  VERIFICATION_KEY_FILE,
  WASM_FILE,
  ZKEY_FINAL,
  addressToField,
  assert,
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
  const credentialSet = readJson(SAMPLE_CREDENTIAL_SET_FILE);
  const credentials = fs
    .readdirSync(CREDENTIALS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && path.extname(entry.name) === ".json")
    .map((entry) => readJson(path.join(CREDENTIALS_DIR, entry.name)));

  const valid = await snarkjs.groth16.verify(verificationKey, publicSignals, proof);
  assert(valid, "valid sample proof should verify");

  const adultCredential = credentials.find(
    (credential) => Number(credential.eligibleFromYmd) <= credentialSet.sampleVerificationDateYmd
  );
  assert(adultCredential, "generated credentials should include an adult sample");

  const minorCredential = credentials.find(
    (credential) => Number(credential.eligibleFromYmd) > credentialSet.sampleVerificationDateYmd
  );
  assert(minorCredential, "generated credentials should include a minor sample");

  const provingInput = {
    merkleRoot: credentialSet.merkleRoot,
    version: String(credentialSet.version),
    verificationDateYmd: String(credentialSet.sampleVerificationDateYmd),
    recipientField: addressToField(adultCredential.boundBuyerAddress).toString(),
    identityHash: adultCredential.identityHash,
    eligibleFromYmd: String(adultCredential.eligibleFromYmd),
    secretSalt: adultCredential.secretSalt,
    walletBinding: adultCredential.walletBinding,
    pathElements: adultCredential.pathElements,
    pathIndices: adultCredential.pathIndices
  };

  await expectFailure("minor credential cannot prove adulthood", async () => {
    await snarkjs.groth16.fullProve(
      {
        ...provingInput,
        identityHash: minorCredential.identityHash,
        eligibleFromYmd: String(minorCredential.eligibleFromYmd),
        secretSalt: minorCredential.secretSalt,
        walletBinding: minorCredential.walletBinding,
        pathElements: minorCredential.pathElements,
        pathIndices: minorCredential.pathIndices
      },
      WASM_FILE,
      ZKEY_FINAL
    );
  });

  await expectFailure("wrong merkle path", async () => {
    const brokenPath = [...provingInput.pathElements];
    brokenPath[0] = (BigInt(brokenPath[0]) + 1n).toString();
    await snarkjs.groth16.fullProve(
      {
        ...provingInput,
        pathElements: brokenPath
      },
      WASM_FILE,
      ZKEY_FINAL
    );
  });

  await expectFailure("credential bound to another wallet", async () => {
    await snarkjs.groth16.fullProve(
      {
        ...provingInput,
        recipientField: (BigInt(provingInput.recipientField) + 1n).toString()
      },
      WASM_FILE,
      ZKEY_FINAL
    );
  });

  const wrongVersionSignals = [...publicSignals];
  wrongVersionSignals[1] = (BigInt(wrongVersionSignals[1]) + 1n).toString();
  const invalidVersion = await snarkjs.groth16.verify(verificationKey, wrongVersionSignals, proof);
  assert(!invalidVersion, "tampered version field should not verify");

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
