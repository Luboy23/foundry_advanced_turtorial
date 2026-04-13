import { buildPoseidon } from "@/lib/zk/poseidon";
import type { Address } from "@/types/contract-config";
import type { AdmissionCredential } from "@/types/credential";
import type { SchoolConfig } from "@/types/admission";

// 这是一条与 circom 电路共享的有限域常量。
// 任何 bytes32、地址等外部值映射到电路字段前，都必须先对该常量取模。
export const SNARK_SCALAR_FIELD = BigInt(
  "21888242871839275222246405745257275088548364400416034343698204186575808495617"
);

// 把链上 bytes32 标识压到电路可接受的字段范围内。
export function bytes32HexToField(value: `0x${string}`) {
  return BigInt(value) % SNARK_SCALAR_FIELD;
}

// 把钱包地址压到电路字段范围内，使前端、合约和电路都能围绕同一个 recipient 做约束。
export function addressToField(value: Address) {
  return BigInt(value.toLowerCase()) % SNARK_SCALAR_FIELD;
}

// 组装 fullProve 所需的全部输入。
// 这里是学生申请链路最关键的“前端到电路”桥接层，因此除了格式转换，还要先做业务闸门校验：
// 1. 录取线必须合理；
// 2. 成绩必须达线；
// 3. 当前钱包必须与成绩凭证绑定的学生账户完全一致。
export async function buildProofInput(args: {
  credential: AdmissionCredential;
  school: SchoolConfig;
  recipientAddress: Address;
}) {
  const { credential, school, recipientAddress } = args;
  const cutoffScore = school.cutoffScore;

  if (!Number.isInteger(cutoffScore) || cutoffScore <= 0) {
    throw new Error("录取线必须是大于 0 的整数。");
  }
  if (cutoffScore > credential.maxScore) {
    throw new Error("录取线不能超过高考总分。");
  }
  if (credential.score < cutoffScore) {
    throw new Error("当前成绩未达到该校录取线，暂时不能提交申请。");
  }

  const poseidon = await buildPoseidon();
  const field = poseidon.F;
  const scoreSourceIdField = bytes32HexToField(credential.scoreSourceIdBytes32);
  const schoolIdField = bytes32HexToField(school.schoolId);
  const recipientField = addressToField(recipientAddress);
  const boundStudentField = BigInt(credential.boundStudentField);

  // 先用原始地址字符串做一次强校验，给用户返回可读错误；
  // 再用字段值做第二次校验，确保电路输入与凭证内容没有被篡改。
  if (credential.boundStudentAddress.toLowerCase() !== recipientAddress.toLowerCase()) {
    throw new Error("当前账户与成绩凭证绑定的账户不一致，请切换后重试。");
  }
  if (boundStudentField !== recipientField) {
    throw new Error("成绩凭证中的账户信息与当前账户不一致。");
  }

  // nullifier 会把学校、学生和成绩源一起编码进去。
  // 这样学生对同一所学校的同一轮申请只能成功上链一次，达到最小重放保护效果。
  const nullifierHash = BigInt(
    field.toString(
      poseidon([
        schoolIdField,
        BigInt(credential.candidateIdHash),
        recipientField,
        scoreSourceIdField
      ])
    )
  );

  // fullProveInput 的字段顺序必须与电路信号定义一一对应，不能随意调整。
  return {
    scoreSourceIdField,
    schoolIdField,
    recipientField,
    nullifierHash,
    fullProveInput: {
      merkleRoot: credential.merkleRoot,
      scoreSourceIdField: scoreSourceIdField.toString(),
      schoolIdField: schoolIdField.toString(),
      cutoffScore: String(cutoffScore),
      recipientField: recipientField.toString(),
      nullifierHash: nullifierHash.toString(),
      boundStudentField: boundStudentField.toString(),
      candidateIdHash: credential.candidateIdHash,
      score: String(credential.score),
      secretSalt: credential.secretSalt,
      pathElements: credential.pathElements,
      pathIndices: credential.pathIndices
    }
  };
}
