import { groth16 } from "snarkjs";
import { addressToField, parseGroth16SolidityCalldata } from "@/lib/zk/calldata";
import type { AgeCredentialSet, LocalAgeCredential } from "@/types/domain";
import type { Address } from "@/types/contract-config";

let artifactsReady = false;
let loadedArtifactKey: string | null = null;
let loadedArtifactUrls = {
  wasmUrl: "/zk/alcohol_age_proof.wasm",
  zkeyUrl: "/zk/alcohol_age_proof_final.zkey"
};

const DEFAULT_WASM_URL = "/zk/alcohol_age_proof.wasm";
const DEFAULT_ZKEY_URL = "/zk/alcohol_age_proof_final.zkey";

type ProofArtifactConfig = {
  wasmUrl?: string;
  zkeyUrl?: string;
  artifactVersion?: string;
};

function postProgress(progress: number, label: string) {
  self.postMessage({
    type: "PROVE_PROGRESS",
    payload: { progress, label }
  });
}

function normalizeArtifactConfig(config?: ProofArtifactConfig) {
  return {
    wasmUrl: config?.wasmUrl?.trim() || DEFAULT_WASM_URL,
    zkeyUrl: config?.zkeyUrl?.trim() || DEFAULT_ZKEY_URL,
    artifactVersion: config?.artifactVersion?.trim() || "static"
  };
}

function buildArtifactUrl(path: string, artifactVersion: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}v=${encodeURIComponent(artifactVersion)}`;
}

async function ensureArtifacts(config?: ProofArtifactConfig) {
  const normalized = normalizeArtifactConfig(config);
  const nextArtifactKey = `${normalized.wasmUrl}|${normalized.zkeyUrl}|${normalized.artifactVersion}`;
  if (artifactsReady && loadedArtifactKey === nextArtifactKey) {
    return loadedArtifactUrls;
  }

  loadedArtifactUrls = {
    wasmUrl: buildArtifactUrl(normalized.wasmUrl, normalized.artifactVersion),
    zkeyUrl: buildArtifactUrl(normalized.zkeyUrl, normalized.artifactVersion)
  };

  postProgress(5, "检查验证资料");

  const [wasmResponse, zkeyResponse] = await Promise.all([
    fetch(loadedArtifactUrls.wasmUrl, { cache: "force-cache" }),
    fetch(loadedArtifactUrls.zkeyUrl, { cache: "force-cache" })
  ]);
  if (!wasmResponse.ok || !zkeyResponse.ok) {
    throw new Error("验证资料暂未就绪，请稍后再试。");
  }

  artifactsReady = true;
  loadedArtifactKey = nextArtifactKey;
  postProgress(18, "验证资料已准备");
  return loadedArtifactUrls;
}

function buildFullProveInput(
  credential: LocalAgeCredential,
  credentialSet: AgeCredentialSet,
  recipientAddress: Address,
  verificationDateYmd: number
) {
  const recipientField = addressToField(recipientAddress).toString();
  if (recipientAddress.toLowerCase() !== credential.boundBuyerAddress.toLowerCase()) {
    throw new Error("当前账户与凭证归属不一致，请切换到对应买家账户。");
  }

  if (recipientField !== credential.walletBinding) {
    throw new Error("凭证钱包绑定字段与当前账户不匹配。");
  }

  return {
    merkleRoot: credential.merkleRoot,
    version: String(credentialSet.version),
    verificationDateYmd: String(verificationDateYmd),
    recipientField,
    identityHash: credential.identityHash,
    eligibleFromYmd: String(credential.eligibleFromYmd),
    secretSalt: credential.secretSalt,
    walletBinding: credential.walletBinding,
    pathElements: credential.pathElements,
    pathIndices: credential.pathIndices
  };
}

self.onmessage = async (
  event: MessageEvent<
    | { type: "LOAD_ARTIFACTS"; payload?: ProofArtifactConfig }
    | {
        type: "START_PROVE";
        payload: {
          credential: LocalAgeCredential;
          credentialSet: AgeCredentialSet;
          recipientAddress: Address;
          verificationDateYmd: number;
          artifacts?: ProofArtifactConfig;
        };
      }
  >
) => {
  const message = event.data;

  try {
    if (message.type === "LOAD_ARTIFACTS") {
      await ensureArtifacts(message.payload);
      self.postMessage({
        type: "ARTIFACTS_READY"
      });
      return;
    }

    if (message.type !== "START_PROVE") {
      return;
    }

    const { credential, credentialSet, recipientAddress, verificationDateYmd, artifacts } = message.payload;

    const artifactUrls = await ensureArtifacts(artifacts);
    postProgress(30, "整理验证信息");
    const fullProveInput = buildFullProveInput(credential, credentialSet, recipientAddress, verificationDateYmd);

    postProgress(55, "正在完成资格验证");
    const { proof, publicSignals } = await groth16.fullProve(
      fullProveInput,
      artifactUrls.wasmUrl,
      artifactUrls.zkeyUrl
    );

    postProgress(85, "整理提交信息");
    const rawCalldata = await groth16.exportSolidityCallData(proof, publicSignals);
    const calldata = parseGroth16SolidityCalldata(rawCalldata);

    self.postMessage({
      type: "PROVE_SUCCESS",
      payload: {
        proofPackage: {
          setId: credentialSet.setId,
          credential,
          credentialSet,
          recipientAddress,
          verificationDateYmd,
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
