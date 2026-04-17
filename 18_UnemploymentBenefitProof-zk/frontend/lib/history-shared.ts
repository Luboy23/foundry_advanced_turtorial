import type { BenefitClaimRecord, CredentialSetPublishRecord } from "@/types/domain";

/**
 * 事件历史的轻量序列化工具。
 *
 * 事件记录里包含 bigint，不能直接穿过 JSON API；这一层负责把服务端响应和客户端消费之间的
 * 序列化/反序列化逻辑收敛到一处，避免各个 route 和 query hook 重复处理。
 */
export type SerializedBenefitClaimRecord = Omit<BenefitClaimRecord, "amountWei"> & {
  amountWei: string;
};

export type SerializedCredentialSetPublishRecord = Omit<CredentialSetPublishRecord, "merkleRoot"> & {
  merkleRoot: string;
};

/** 把领取历史记录转换成可通过 JSON 传输的结构。 */
export function serializeClaimHistory(records: BenefitClaimRecord[]): SerializedBenefitClaimRecord[] {
  return records.map((record) => ({
    ...record,
    amountWei: record.amountWei.toString()
  }));
}

/** 把 API 返回的领取历史恢复成前端使用的 bigint 结构。 */
export function deserializeClaimHistory(records: SerializedBenefitClaimRecord[]): BenefitClaimRecord[] {
  return records.map((record) => ({
    ...record,
    amountWei: BigInt(record.amountWei)
  }));
}

/** 把资格名单发布记录转换成可通过 JSON 传输的结构。 */
export function serializeCredentialSetPublishHistory(
  records: CredentialSetPublishRecord[]
): SerializedCredentialSetPublishRecord[] {
  return records.map((record) => ({
    ...record,
    merkleRoot: record.merkleRoot.toString()
  }));
}

/** 把 API 返回的资格名单发布历史恢复成前端使用的 bigint 结构。 */
export function deserializeCredentialSetPublishHistory(
  records: SerializedCredentialSetPublishRecord[]
): CredentialSetPublishRecord[] {
  return records.map((record) => ({
    ...record,
    merkleRoot: BigInt(record.merkleRoot)
  }));
}
