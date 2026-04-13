import type {
  AuthorityImportPayload,
  ScoreRecordInput,
  ScoreSourceDraft
} from "@/types/admission";

type LegacyDraftPayload = ScoreSourceDraft;

type BackendDraftPayload = AuthorityImportPayload;

function normalizeRecord(record: ScoreRecordInput): ScoreRecordInput {
  return {
    candidateLabel: String(record.candidateLabel ?? "").trim(),
    candidateIdHash: String(record.candidateIdHash ?? "").trim(),
    score: Number(record.score),
    secretSalt: String(record.secretSalt ?? "").trim(),
    boundStudentAddress: String(record.boundStudentAddress ?? "").trim() as ScoreRecordInput["boundStudentAddress"]
  };
}

// 后端当前保存的是 AuthorityImportPayload（scoreSource + records），
// 但考试院前端后续生成成绩树和凭证时使用的是扁平的 ScoreSourceDraft。
// 这里统一把两种历史形状都归一化成前端可直接消费的草稿结构。
export function normalizeAuthorityDraftPayload(payload: unknown): ScoreSourceDraft | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Partial<LegacyDraftPayload & BackendDraftPayload>;

  if (
    typeof candidate.scoreSourceIdLabel === "string" &&
    typeof candidate.sourceTitle === "string" &&
    typeof candidate.maxScore === "number" &&
    typeof candidate.merkleDepth === "number" &&
    Array.isArray(candidate.records)
  ) {
    return {
      scoreSourceIdLabel: candidate.scoreSourceIdLabel,
      sourceTitle: candidate.sourceTitle,
      maxScore: candidate.maxScore,
      merkleDepth: candidate.merkleDepth,
      records: candidate.records.map((record) => normalizeRecord(record as ScoreRecordInput))
    };
  }

  if (
    candidate.scoreSource &&
    typeof candidate.scoreSource === "object" &&
    Array.isArray(candidate.records)
  ) {
    const scoreSource = candidate.scoreSource as AuthorityImportPayload["scoreSource"];
    return {
      scoreSourceIdLabel: String(scoreSource.scoreSourceIdLabel ?? "").trim(),
      sourceTitle: String(scoreSource.sourceTitle ?? "").trim(),
      maxScore: Number(scoreSource.maxScore),
      merkleDepth: Number(scoreSource.merkleDepth ?? 20),
      records: candidate.records.map((record) => normalizeRecord(record as ScoreRecordInput))
    };
  }

  return null;
}
