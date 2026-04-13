import { groth16 } from "@/lib/vendor/snarkjs-browser";
import type { SchoolConfig } from "@/types/admission";
import type { Address } from "@/types/contract-config";
import type { AdmissionCredential } from "@/types/credential";
import { serializeProofPackage } from "@/lib/zk/proof-package";
import { buildProofInput } from "@/lib/zk/proof-input";
import { parseGroth16SolidityCalldata } from "@/lib/zk/public-signals";

// Worker 只负责计算型工作：
// 1. 预热 wasm / zkey；
// 2. 组装 fullProve 输入；
// 3. 生成申请凭证并回传给主线程。
let artifactsReady = false;
let artifactsPromise: Promise<void> | null = null;
let proving = false;

const WASM_URL = "/zk/university_cutoff_proof.wasm";
const ZKEY_URL = "/zk/university_cutoff_proof_final.zkey";

// 所有进度消息都收口到这个帮助函数，避免主线程收到不一致的进度结构。
function postProgress(progress: number, label: string) {
  self.postMessage({
    type: "PROVE_PROGRESS",
    payload: { progress, label }
  });
}

// 预加载电路产物。
// 只要当前标签页里已经加载过一次，后续再生成申请凭证就不必重复请求。
async function ensureArtifacts() {
  if (artifactsReady) {
    return;
  }

  if (!artifactsPromise) {
    artifactsPromise = (async () => {
      postProgress(5, "准备申请材料");

      const responses = await Promise.all([fetch(WASM_URL), fetch(ZKEY_URL)]);
      if (responses.some((response) => !response.ok)) {
        throw new Error("申请材料暂不可用，请稍后再试。");
      }

      artifactsReady = true;
    })().catch((error) => {
      artifactsPromise = null;
      throw error;
    });
  }

  await artifactsPromise;
}

self.onmessage = async (
  event: MessageEvent<
    | { type: "LOAD_ARTIFACTS" }
    | {
      type: "START_PROVE";
      payload: {
          credential: AdmissionCredential;
          school: SchoolConfig;
          recipientAddress: Address;
        };
      }
  >
) => {
  const message = event.data;
  let startedProof = false;

  try {
    if (message.type === "LOAD_ARTIFACTS") {
      await ensureArtifacts();
      self.postMessage({
        type: "ARTIFACTS_READY",
        payload: {
          progress: 15,
          label: "申请材料已就绪"
        }
      });
      return;
    }

    if (message.type !== "START_PROVE") {
      return;
    }

    if (proving) {
      throw new Error("申请凭证正在生成，请稍候后重试。");
    }

    proving = true;
    startedProof = true;
    await ensureArtifacts();
    postProgress(25, "校验申请信息");

    // 先把页面侧的业务对象转成电路真正需要的 fullProve 输入。
    const { credential, school, recipientAddress } = message.payload;
    const prepared = await buildProofInput({
      credential,
      school,
      recipientAddress
    });

    postProgress(45, "生成申请凭证");
    // fullProve 是最重的一步，因此必须留在 Worker 中执行。
    const { proof, publicSignals } = await groth16.fullProve(
      prepared.fullProveInput,
      WASM_URL,
      ZKEY_URL
    );

    postProgress(85, "整理提交数据");
    // 主线程提交合约时只需要 solidity calldata，因此在 Worker 里提前整理好。
    const rawCalldata = await groth16.exportSolidityCallData(proof, publicSignals);
    const calldata = parseGroth16SolidityCalldata(rawCalldata);

    self.postMessage({
      type: "PROVE_SUCCESS",
      payload: {
        proofPackage: serializeProofPackage({
          calldata,
          nullifierHash: prepared.nullifierHash,
          recipient: recipientAddress,
          cutoffScore: school.cutoffScore,
          scoreSourceIdBytes32: credential.scoreSourceIdBytes32,
          schoolIdBytes32: school.schoolId,
          schoolName: school.schoolName,
          merkleRoot: BigInt(credential.merkleRoot),
          generatedAt: Date.now()
        })
      }
    });
  } catch (error) {
    self.postMessage({
      type: "PROVE_ERROR",
      payload: {
        message: error instanceof Error ? error.message : "申请凭证生成失败。"
      }
    });
  } finally {
    if (startedProof) {
      proving = false;
    }
  }
};

export {};
