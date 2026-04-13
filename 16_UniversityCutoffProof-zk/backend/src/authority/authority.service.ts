import { BadRequestException, Inject, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { FilesService } from "../files/files.service";
import { IndexerService } from "../indexer/indexer.service";
import {
  generateCredentialsFromDraft,
  type GeneratedCredential,
  type GeneratedScoreSourceDraft
} from "./authority-generation";
import type {
  AuthorityImportPayloadDto,
  CreateAuthorityDraftDto,
  GenerateAuthorityDraftBatchDto,
  IssuanceRecordInputDto
} from "./authority.dto";

// 考试院后端服务。
// 这一层负责三件事：
// 1. 托管本届成绩草稿；
// 2. 生成成绩源摘要与学生凭证批次；
// 3. 组装考试院工作台需要的 workbench 数据。
@Injectable()
export class AuthorityService {
  private readonly logger = new Logger(AuthorityService.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(FilesService)
    private readonly filesService: FilesService,
    @Inject(IndexerService)
    private readonly indexerService: IndexerService
  ) {}

  // 把前端上传的成绩 JSON 收口成后端内部统一草稿结构。
  // 这里会做第一层业务校验，确保后续批量生成凭证时不再面对“空记录”或“成绩超过总分”的脏数据。
  private normalizeDraftPayload(payload: AuthorityImportPayloadDto): GeneratedScoreSourceDraft {
    const normalized = {
      scoreSourceIdLabel: payload.scoreSource.scoreSourceIdLabel.trim(),
      sourceTitle: payload.scoreSource.sourceTitle.trim(),
      maxScore: Number(payload.scoreSource.maxScore),
      merkleDepth: Number(payload.scoreSource.merkleDepth ?? 20),
      records: payload.records.map((record) => ({
        candidateLabel: record.candidateLabel.trim(),
        candidateIdHash: record.candidateIdHash.trim(),
        score: Number(record.score),
        secretSalt: record.secretSalt.trim(),
        boundStudentAddress: record.boundStudentAddress.toLowerCase() as `0x${string}`
      }))
    } satisfies GeneratedScoreSourceDraft;

    if (!normalized.records.length) {
      throw new BadRequestException("成绩记录不能为空。");
    }
    if (normalized.records.some((record) => record.score > normalized.maxScore)) {
      throw new BadRequestException("存在学生成绩超过总分上限。");
    }

    return normalized;
  }

  // 草稿是以 JSON 字符串形式存库的，因此每次读取都要先做一层安全解析。
  // 解析失败的草稿不会让整个工作台 500，而是被视为损坏草稿并跳过。
  private parseDraftPayload(
    payloadJson: string,
    context: { draftId?: string; fallback?: unknown } = {}
  ): AuthorityImportPayloadDto | null {
    try {
      return JSON.parse(payloadJson) as AuthorityImportPayloadDto;
    } catch {
      this.logger.warn(
        `草稿 ${context.draftId ?? "unknown"} 的 payloadJson 解析失败，已忽略该草稿。`
      );
      return (context.fallback as AuthorityImportPayloadDto | null | undefined) ?? null;
    }
  }

  // workbench 对外返回时统一把 payloadJson 恢复成结构化对象，避免前端再二次 parse。
  private serializeDraft(
    draft:
      | {
          id: string;
          scoreSourceIdLabel: string;
          sourceTitle: string;
          maxScore: number;
          payloadJson: string;
          createdBy: string;
          status: string;
          createdAt: Date;
          updatedAt: Date;
        }
      | null
      | undefined
  ) {
    if (!draft) {
      return null;
    }

    const payloadJson = this.parseDraftPayload(draft.payloadJson, { draftId: draft.id });
    if (!payloadJson) {
      return null;
    }

    return {
      ...draft,
      createdAt: draft.createdAt.toISOString(),
      updatedAt: draft.updatedAt.toISOString(),
      payloadJson
    };
  }

  // 批次记录和成绩源记录在这里统一转换成前端可直接消费的 DTO 形状。
  private serializeIssuanceBatch(
    batch:
      | ({
          issuanceRecords: Array<{
            id: string;
            batchId: string;
            candidateLabel: string;
            boundStudentAddress: string;
            score: number;
            fileName: string;
            createdAt: Date;
          }>;
        } & {
          id: string;
          draftId: string;
          scoreSourceIdLabel: string;
          filePath: string;
          credentialCount: number;
          createdBy: string;
          mode: string;
          createdAt: Date;
        })
      | null
  ) {
    if (!batch) {
      return null;
    }

    return {
      ...batch,
      createdAt: batch.createdAt.toISOString(),
      issuanceRecords: batch.issuanceRecords.map((record) => ({
        ...record,
        createdAt: record.createdAt.toISOString()
      }))
    };
  }

  private serializeScoreSource(
    source:
      | {
          id: string;
          scoreSourceId: string;
          scoreSourceIdLabel: string;
          sourceTitle: string;
          merkleRoot: string;
          maxScore: number;
          issuer: string;
          issuedAt: Date;
          txHash: string | null;
          blockNumber: number | null;
          active: boolean;
          createdAt: Date;
          updatedAt: Date;
        }
      | null
      | undefined
  ) {
    if (!source) {
      return null;
    }

    return {
      ...source,
      blockNumber: source.blockNumber === null ? null : String(source.blockNumber),
      issuedAt: source.issuedAt.toISOString(),
      createdAt: source.createdAt.toISOString(),
      updatedAt: source.updatedAt.toISOString()
    };
  }

  // 允许考试院只导出指定学生的凭证，也允许直接导出整批。
  // 过滤逻辑统一放在后端，避免前端和后端各自维护一套“挑哪些学生”的规则。
  private pickRequestedCredentials(
    allCredentials: GeneratedCredential[],
    records?: IssuanceRecordInputDto[]
  ) {
    if (!records?.length) {
      return allCredentials;
    }

    return allCredentials.filter((credential) =>
      records.some(
        (record) =>
          record.candidateLabel === credential.candidateLabel &&
          record.boundStudentAddress.toLowerCase() === credential.boundStudentAddress.toLowerCase() &&
          Number(record.score) === credential.score
      )
    );
  }

  // 导入成绩文件后创建新的草稿版本。
  // 当前模型采用“上传即覆盖为最新草稿”，前端只读取 updatedAt 最新且能成功解析的一份。
  async createDraft(dto: CreateAuthorityDraftDto) {
    const normalizedPayload = this.normalizeDraftPayload(dto.payload);
    const created = await this.prisma.authorityScoreDraft.create({
      data: {
        scoreSourceIdLabel: normalizedPayload.scoreSourceIdLabel,
        sourceTitle: normalizedPayload.sourceTitle,
        maxScore: normalizedPayload.maxScore,
        payloadJson: JSON.stringify({
          scoreSource: {
            scoreSourceIdLabel: normalizedPayload.scoreSourceIdLabel,
            sourceTitle: normalizedPayload.sourceTitle,
            maxScore: normalizedPayload.maxScore,
            merkleDepth: normalizedPayload.merkleDepth
          },
          records: normalizedPayload.records
        }),
        createdBy: dto.createdBy.toLowerCase(),
        status: "draft"
      }
    });
    return this.serializeDraft(created);
  }

  // 读取当前考试院最新可用草稿。
  // 这里会跳过损坏草稿，确保页面尽量继续可用，而不是因为一条坏记录把整个工作台打挂。
  async getCurrentDraft() {
    const drafts = await this.prisma.authorityScoreDraft.findMany({
      orderBy: { updatedAt: "desc" },
      take: 20
    });

    for (const draft of drafts) {
      const serialized = this.serializeDraft(draft);
      if (serialized) {
        return serialized;
      }
    }

    return null;
  }

  // 正式生成凭证批次的入口。
  // preview 模式只返回摘要与凭证预览，不落库；
  // single / batch 模式会写文件并记录发放历史，供考试院工作台回看。
  async generateDraftBatch(draftId: string, dto: GenerateAuthorityDraftBatchDto) {
    const draft = await this.prisma.authorityScoreDraft.findUniqueOrThrow({
      where: { id: draftId }
    });
    const payload = this.parseDraftPayload(draft.payloadJson, { draftId });
    if (!payload) {
      throw new BadRequestException("当前成绩草稿已损坏，请重新上传。");
    }

    const normalizedDraft = this.normalizeDraftPayload(payload);
    const generated = await generateCredentialsFromDraft(normalizedDraft);
    const selectedCredentials = this.pickRequestedCredentials(generated.credentials, dto.records);
    if (dto.records?.length && !selectedCredentials.length) {
      throw new BadRequestException("当前成绩草稿里找不到要导出的学生凭证。");
    }

    const mode = dto.mode ?? "preview";
    if (mode === "preview") {
      return {
        draftId,
        mode,
        scoreSource: generated.scoreSource,
        credentials: generated.credentials,
        batch: null
      };
    }

    // 批次落文件而不是直接把完整凭证 JSON 存进数据库，
    // 是为了让数据库只保存索引信息，真正的大对象仍然走文件态管理。
    const fileName =
      dto.fileName ||
      `${draft.scoreSourceIdLabel}-${mode === "single" ? "single" : "batch"}-${Date.now()}.json`;
    const relativePath = `issuance/${fileName}`;
    const payloadToWrite =
      mode === "single" && selectedCredentials.length === 1
        ? selectedCredentials[0]
        : {
            exportedAt: new Date().toISOString(),
            scoreSource: generated.scoreSource,
            totalCredentials: selectedCredentials.length,
            credentials: selectedCredentials
          };
    const filePath = await this.filesService.writeJson(relativePath, payloadToWrite);

    const batch = await this.prisma.issuanceBatch.create({
      data: {
        draftId,
        scoreSourceIdLabel: draft.scoreSourceIdLabel,
        filePath,
        credentialCount: selectedCredentials.length,
        createdBy: dto.createdBy.toLowerCase(),
        mode,
        issuanceRecords: {
          create: selectedCredentials.map((credential) => ({
            candidateLabel: credential.candidateLabel,
            boundStudentAddress: credential.boundStudentAddress.toLowerCase(),
            score: credential.score,
            fileName
          }))
        }
      },
      include: {
        issuanceRecords: true
      }
    });

    return {
      draftId,
      mode,
      scoreSource: generated.scoreSource,
      credentials: selectedCredentials,
      batch: this.serializeIssuanceBatch(batch)
    };
  }

  // 给“发布成绩源”按钮准备只读预览。
  // 这一步不要求后台签名会话，因为它只是把当前草稿解释成成绩源摘要，并不写后台记录。
  async generateDraftPreview(draftId: string) {
    const draft = await this.prisma.authorityScoreDraft.findUniqueOrThrow({
      where: { id: draftId }
    });
    const payload = this.parseDraftPayload(draft.payloadJson, { draftId });
    if (!payload) {
      throw new BadRequestException("当前成绩草稿已损坏，请重新上传。");
    }

    const normalizedDraft = this.normalizeDraftPayload(payload);
    const generated = await generateCredentialsFromDraft(normalizedDraft);

    return {
      draftId,
      mode: "preview",
      scoreSource: generated.scoreSource,
      credentials: generated.credentials,
      batch: null
    };
  }

  // 考试院页展示的“本地发放记录”来自这里。
  async getIssuanceRecords() {
    const records = await this.prisma.issuanceRecord.findMany({
      include: {
        batch: true
      },
      orderBy: { createdAt: "desc" }
    });
    return records.map((record) => ({
      id: record.id,
      batchId: record.batchId,
      scoreSourceIdLabel: record.batch.scoreSourceIdLabel,
      candidateLabel: record.candidateLabel,
      boundStudentAddress: record.boundStudentAddress,
      score: record.score,
      fileName: record.fileName,
      createdAt: record.createdAt.toISOString()
    }));
  }

  // 链上发布历史只认成绩源投影表，不混入任何本地 publish 缓存。
  async getPublishHistory() {
    const records = await this.prisma.scoreSourcePublication.findMany({
      orderBy: [{ issuedAt: "desc" }, { blockNumber: "desc" }]
    });
    return records.map((record) => this.serializeScoreSource(record));
  }

  // 考试院 workbench 是页面的唯一主数据源。
  // 它会先触发一次增量投影同步，再把“草稿 / 发放记录 / 链上发布状态”组装成一份稳定快照。
  async getWorkbench() {
    const syncStatus = await this.indexerService.syncAll();
    const [currentDraft, publishHistory, issuanceRecords, latestActiveSource, latestSource] =
      await Promise.all([
        this.getCurrentDraft(),
        this.getPublishHistory(),
        this.getIssuanceRecords(),
        this.prisma.scoreSourcePublication.findFirst({
          where: { active: true },
          orderBy: [{ issuedAt: "desc" }, { blockNumber: "desc" }]
        }),
        this.prisma.scoreSourcePublication.findFirst({
          orderBy: [{ issuedAt: "desc" }, { blockNumber: "desc" }]
        })
      ]);

    return {
      currentDraft,
      publishHistory,
      issuanceRecords,
      latestActiveSource: this.serializeScoreSource(latestActiveSource),
      latestSource: this.serializeScoreSource(latestSource),
      syncStatus
    };
  }
}
