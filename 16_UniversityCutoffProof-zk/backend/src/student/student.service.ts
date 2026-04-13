import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { IndexerService } from "../indexer/indexer.service";
import type { CreateStudentAuxiliaryRecordDto } from "./student.dto";

// 学生侧 workbench 服务。
// 这一层负责把“链上申请记录、当前申请、可申请规则、辅助记录”统一组装成学生页面快照。
@Injectable()
export class StudentService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(IndexerService)
    private readonly indexerService: IndexerService
  ) {}

  // 成绩源统一在这里转成字符串时间戳和可序列化字段，避免每个控制器重复做 DTO 适配。
  private normalizeScoreSource(
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
  ) {
    if (!source) {
      return null;
    }

    return {
      ...source,
      issuedAt: source.issuedAt.toISOString(),
      blockNumber: source.blockNumber === null ? null : String(source.blockNumber),
      createdAt: source.createdAt.toISOString(),
      updatedAt: source.updatedAt.toISOString()
    };
  }

  // 链上申请历史的主真相来自 studentApplication 投影表。
  async getApplications(walletAddress: string) {
    return this.prisma.studentApplication.findMany({
      where: { applicant: walletAddress.toLowerCase() },
      orderBy: [{ submittedAt: "desc" }]
    });
  }

  // 当前版本采用“首次提交即锁定”的状态机，因此当前申请就是按 submittedAt 倒序的最新一条。
  async getCurrentApplication(walletAddress: string) {
    const application = await this.prisma.studentApplication.findFirst({
      where: { applicant: walletAddress.toLowerCase() },
      orderBy: [{ submittedAt: "desc" }]
    });
    return {
      application
    };
  }

  // 学生资格列表只认“已经开放且录取线冻结”的规则。
  // 这也是为什么大学刚创建草稿但还没开放申请时，学生页面仍然会显示“大学尚未开放申请”。
  async getEligibility(walletAddress: string) {
    const [latestActiveSource, rules] = await Promise.all([
      this.prisma.scoreSourcePublication.findFirst({
        where: { active: true },
        orderBy: [{ issuedAt: "desc" }, { blockNumber: "desc" }]
      }),
      this.prisma.schoolRuleVersion.findMany({
        where: { active: true, cutoffFrozen: true },
        orderBy: [{ familyKey: "asc" }, { versionNumber: "desc" }]
      })
    ]);

    return {
      walletAddress: walletAddress.toLowerCase(),
      hasActiveScoreSource: Boolean(latestActiveSource),
      hasOpenRules: Boolean(rules.length),
      rules: rules.map((rule) => ({
        ...rule,
        updatedAt: rule.updatedAt.toISOString(),
        createdAt: rule.createdAt.toISOString()
      })),
      note: latestActiveSource
        ? rules.length
          ? "当前系统已有可申请规则。"
          : "考试院已发布成绩，但大学尚未开放申请。"
        : "考试院尚未发布本届成绩。"
    };
  }

  // 未达线等辅助记录已经迁到后端托管，但它们只是教学辅助，不参与任何链上资格和锁定判断。
  async createAuxiliaryRecord(walletAddress: string, dto: CreateStudentAuxiliaryRecordDto) {
    const normalizedWallet = walletAddress.toLowerCase();
    const dedupeKey = [
      normalizedWallet,
      dto.schoolId.toLowerCase(),
      dto.status,
      dto.versionId ?? "unknown",
      dto.message
    ].join(":");

    return this.prisma.studentAuxiliaryRecord.upsert({
      where: { dedupeKey },
      create: {
        walletAddress: normalizedWallet,
        schoolId: dto.schoolId.toLowerCase(),
        schoolName: dto.schoolName,
        status: dto.status,
        message: dto.message,
        versionId: dto.versionId,
        dedupeKey
      },
      update: {}
    });
  }

  // 学生 workbench 会先触发投影同步，再返回页面真正需要的“当前快照”。
  // 页面后续所有按钮禁用、状态卡和学校列表都应只基于这份数据解释业务状态。
  async getWorkbench(walletAddress: string) {
    const syncStatus = await this.indexerService.syncAll();
    const normalizedWallet = walletAddress.toLowerCase();
    const [applications, currentApplication, eligibility, auxiliaryRecords, latestActiveSource] =
      await Promise.all([
        this.getApplications(normalizedWallet),
        this.getCurrentApplication(normalizedWallet),
        this.getEligibility(normalizedWallet),
        this.prisma.studentAuxiliaryRecord.findMany({
          where: { walletAddress: normalizedWallet },
          orderBy: { createdAt: "desc" }
        }),
        this.prisma.scoreSourcePublication.findFirst({
          where: { active: true },
          orderBy: [{ issuedAt: "desc" }, { blockNumber: "desc" }]
        })
      ]);

    return {
      walletAddress: normalizedWallet,
      latestActiveSource: this.normalizeScoreSource(latestActiveSource),
      applications: applications.map((application) => ({
        ...application,
        submittedAt: application.submittedAt.toISOString(),
        decidedAt: application.decidedAt?.toISOString() ?? null,
        createdAt: application.createdAt.toISOString(),
        updatedAt: application.updatedAt.toISOString()
      })),
      currentApplication: currentApplication.application
        ? {
            ...currentApplication.application,
            submittedAt: currentApplication.application.submittedAt.toISOString(),
            decidedAt: currentApplication.application.decidedAt?.toISOString() ?? null,
            createdAt: currentApplication.application.createdAt.toISOString(),
            updatedAt: currentApplication.application.updatedAt.toISOString()
          }
        : null,
      rules: eligibility.rules,
      auxiliaryRecords: auxiliaryRecords.map((record) => ({
        ...record,
        createdAt: record.createdAt.toISOString()
      })),
      note: eligibility.note,
      syncStatus
    };
  }
}
