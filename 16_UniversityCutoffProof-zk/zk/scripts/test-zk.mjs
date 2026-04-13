import * as snarkjs from "snarkjs";
import {
  SAMPLE_CREDENTIAL_FILE,
  SAMPLE_PROOF_FILE,
  SAMPLE_PROVING_INPUT_FILE,
  SAMPLE_PUBLIC_SIGNALS_FILE,
  SAMPLE_SCHOOLS_FILE,
  VERIFICATION_KEY_FILE,
  WASM_FILE,
  ZKEY_FINAL,
  assert,
  buildPoseidonHelpers,
  readJson,
  toBigIntString,
} from "./common.mjs";

// 约定某些场景必须失败，用来验证电路确实在保护关键不变量。
const expectFailure = async (label, action) => {
  try {
    await action();
  } catch (_error) {
    console.log(`Expected failure confirmed: ${label}`);
    return;
  }
  throw new Error(`${label} unexpectedly succeeded`);
};

// 对生成好的样例产物做端到端自检：
// 1. 样例 proof 能通过；
// 2. 录取线、Merkle 路径、钱包绑定被篡改后会失败；
// 3. 学校和 nullifier 绑定关系有效。
const main = async () => {
  const verificationKey = readJson(VERIFICATION_KEY_FILE);
  const proof = readJson(SAMPLE_PROOF_FILE);
  const publicSignals = readJson(SAMPLE_PUBLIC_SIGNALS_FILE);
  const provingInput = readJson(SAMPLE_PROVING_INPUT_FILE);
  const credential = readJson(SAMPLE_CREDENTIAL_FILE);
  const schools = readJson(SAMPLE_SCHOOLS_FILE);

  const valid = await snarkjs.groth16.verify(verificationKey, publicSignals, proof);
  assert(valid, "valid sample proof should verify");

  assert(
    schools.some((school) => school.schoolIdField === provingInput.schoolIdField),
    "sample proving input should point to a valid school"
  );

  const invalidCutoff = BigInt(credential.score) + 1n;

  // 分数低于录取线时，fullProve 应直接失败。
  await expectFailure("score below cutoff", async () => {
    await snarkjs.groth16.fullProve(
      {
        ...provingInput,
        cutoffScore: invalidCutoff.toString(),
      },
      WASM_FILE,
      ZKEY_FINAL
    );
  });

  // 只要 Merkle 路径被破坏，就不能再恢复到官方成绩根。
  await expectFailure("wrong merkle path", async () => {
    const brokenPath = [...provingInput.pathElements];
    brokenPath[0] = (BigInt(brokenPath[0]) + 1n).toString();
    await snarkjs.groth16.fullProve(
      {
        ...provingInput,
        pathElements: brokenPath,
      },
      WASM_FILE,
      ZKEY_FINAL
    );
  });

  // 成绩凭证绑定了学生钱包地址，换钱包字段后必须失败。
  await expectFailure("credential bound to another wallet", async () => {
    await snarkjs.groth16.fullProve(
      {
        ...provingInput,
        recipientField: (BigInt(provingInput.recipientField) + 1n).toString(),
      },
      WASM_FILE,
      ZKEY_FINAL
    );
  });

  const wrongRecipientSignals = [...publicSignals];
  wrongRecipientSignals[4] = (BigInt(wrongRecipientSignals[4]) + 1n).toString();
  const invalidRecipient = await snarkjs.groth16.verify(verificationKey, wrongRecipientSignals, proof);
  assert(!invalidRecipient, "tampered recipient field should not verify");

  // nullifier 绑定学校；一旦把 school 字段替换成另一所学校，对应公共信号必须不再成立。
  const { hash4 } = await buildPoseidonHelpers();
  const alternativeSchool = schools.find((school) => school.schoolIdField !== provingInput.schoolIdField);
  assert(alternativeSchool, "sample schools should include a second school");
  const wrongSchoolNullifier = hash4([
    BigInt(alternativeSchool.schoolIdField),
    BigInt(provingInput.candidateIdHash),
    BigInt(provingInput.recipientField),
    BigInt(provingInput.scoreSourceIdField),
  ]);

  const wrongSchoolSignals = [...publicSignals];
  wrongSchoolSignals[2] = alternativeSchool.schoolIdField;
  wrongSchoolSignals[5] = toBigIntString(wrongSchoolNullifier);
  const invalidSchool = await snarkjs.groth16.verify(verificationKey, wrongSchoolSignals, proof);
  assert(!invalidSchool, "tampered school field should not verify");

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
