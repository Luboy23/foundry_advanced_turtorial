import { groth16 } from "snarkjs";
import { buildPoseidon } from "circomlibjs";
import { addressToField, parseGroth16SolidityCalldata } from "@/lib/zk/calldata";
import type { BenefitProgram, LocalUnemploymentCredential, UnemploymentCredentialSet } from "@/types/domain";
import type { Address } from "@/types/contract-config";

/**
 * 前端本地产证 Worker。
 *
 * 主线程只关心“资源是否就绪、进度到哪、最终 calldata 是什么”，真正的 Poseidon 初始化、
 * zk artifact 预热和 Groth16 fullProve 都放到 Worker 里执行，避免阻塞页面交互。
 */
let artifactsReady = false;
let poseidonReady = false;
let poseidonHash3 = (inputs: Array<bigint | string | number>) => BigInt(0);

const WASM_URL = "/zk/unemployment_benefit_proof.wasm";
const ZKEY_URL = "/zk/unemployment_benefit_proof_final.zkey";

/** 向主线程回报当前进度，用于驱动页面上的阶段提示。 */
function postProgress(progress: number, label: string) {
  self.postMessage({
    type: "PROVE_PROGRESS",
    payload: { progress, label }
  });
}

/** 延迟初始化 Poseidon hash3，确保 Worker 首次收到请求前就能完成字段计算。 */
async function ensurePoseidon() {
  if (poseidonReady) {
    return;
  }

  const poseidon = await buildPoseidon();
  const field = poseidon.F;
  poseidonHash3 = (inputs) =>
    BigInt(field.toString(poseidon(inputs.map((input) => BigInt(input)))));
  poseidonReady = true;
}

/** 检查并预热 wasm / zkey 资源，避免正式产证时才发现资源缺失。 */
async function ensureArtifacts() {
  if (artifactsReady) {
    return;
  }

  postProgress(5, "检查验证资料");

  const [wasmResponse, zkeyResponse] = await Promise.all([
    fetch(WASM_URL, { cache: "force-cache" }),
    fetch(ZKEY_URL, { cache: "force-cache" })
  ]);
  if (!wasmResponse.ok || !zkeyResponse.ok) {
    throw new Error("验证资料暂未就绪，请稍后再试。");
  }

  artifactsReady = true;
  postProgress(18, "验证资料已准备");
}

/**
 * 组装 Groth16 fullProve 输入。
 *
 * 这里会再次校验“当前钱包地址是否就是凭证绑定地址”，即便页面层已经做过阻断，也要在
 * Worker 侧再拦一层，避免错误调用绕过前端显示逻辑。
 */
async function buildFullProveInput(
  credential: LocalUnemploymentCredential,
  credentialSet: UnemploymentCredentialSet,
  program: BenefitProgram,
  recipientAddress: Address
) {
  await ensurePoseidon();

  const recipientField = addressToField(recipientAddress).toString();
  if (recipientAddress.toLowerCase() !== credential.boundApplicantAddress.toLowerCase()) {
    throw new Error("当前账户与私有凭证归属不一致，请切换到对应申请人账户。");
  }

  if (recipientField !== credential.walletBinding) {
    throw new Error("私有凭证钱包绑定字段与当前账户不匹配。");
  }

  return {
    merkleRoot: credential.merkleRoot,
    programIdField: program.programIdField.toString(),
    recipientField,
    nullifierHash: poseidonHash3([
      credential.identityHash,
      program.programIdField.toString(),
      credential.walletBinding
    ]).toString(),
    identityHash: credential.identityHash,
    secretSalt: credential.secretSalt,
    walletBinding: credential.walletBinding,
    pathElements: credential.pathElements,
    pathIndices: credential.pathIndices
  };
}

self.onmessage = async (
  event: MessageEvent<
    | { type: "LOAD_ARTIFACTS" }
    | {
        type: "START_PROVE";
        payload: {
          credential: LocalUnemploymentCredential;
          credentialSet: UnemploymentCredentialSet;
          program: BenefitProgram;
          recipientAddress: Address;
        };
      }
  >
) => {
  const message = event.data;

  try {
    if (message.type === "LOAD_ARTIFACTS") {
      // 进入核验页前先把大资源和 Poseidon 一起预热，尽量把首次证明生成的等待挪到后台。
      await Promise.all([ensureArtifacts(), ensurePoseidon()]);
      self.postMessage({ type: "ARTIFACTS_READY" });
      return;
    }

    if (message.type !== "START_PROVE") {
      return;
    }

    const { credential, credentialSet, program, recipientAddress } = message.payload;

    await ensureArtifacts();
    // 正式 fullProve 前先把输入拼装和前置校验做完，避免进入长耗时计算后才发现参数不合法。
    postProgress(30, "整理验证信息");
    const fullProveInput = await buildFullProveInput(credential, credentialSet, program, recipientAddress);

    postProgress(55, "正在生成资格证明");
    const { proof, publicSignals } = await groth16.fullProve(fullProveInput, WASM_URL, ZKEY_URL);

    postProgress(85, "整理链上提交信息");
    const rawCalldata = await groth16.exportSolidityCallData(proof, publicSignals);
    const calldata = parseGroth16SolidityCalldata(rawCalldata);

    self.postMessage({
      type: "PROVE_SUCCESS",
      payload: {
        proofPackage: {
          credential,
          credentialSet,
          program,
          recipientAddress,
          calldata,
          generatedAt: Date.now()
        }
      }
    });
  } catch (error) {
    self.postMessage({
      type: "PROVE_ERROR",
      payload: {
        message: error instanceof Error ? error.message : "资格验证失败。"
      }
    });
  }
};

export {};
