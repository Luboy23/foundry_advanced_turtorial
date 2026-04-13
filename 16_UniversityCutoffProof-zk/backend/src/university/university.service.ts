import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { IndexerService } from "../indexer/indexer.service";

// 大学侧 workbench 服务。
// 它把规则历史、审批列表、当前成绩源和页面级禁用原因统一收口，让前端不再自己拼链上状态。
@Injectable()
export class UniversityService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(IndexerService)
    private readonly indexerService: IndexerService
  ) {}

  // 成绩源在大学页只作为“当前可用批次”展示，因此这里统一转换成前端稳定的可序列化结构。
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

  // 规则列表和审批列表都直接读投影表，不再由前端自行扫链解释历史。
  async getRuleVersions(familyKey: string) {
    const rules = await this.prisma.schoolRuleVersion.findMany({
      where: { familyKey },
      orderBy: { versionNumber: "desc" }
    });
    return rules.map((rule) => ({
      ...rule,
      updatedAt: rule.updatedAt.toISOString(),
      createdAt: rule.createdAt.toISOString()
    }));
  }

  async getApplications(familyKey: string) {
    const applications = await this.prisma.studentApplication.findMany({
      where: { familyKey },
      orderBy: [{ decidedAt: "desc" }, { submittedAt: "desc" }]
    });
    return applications.map((application) => ({
      ...application,
      submittedAt: application.submittedAt.toISOString(),
      decidedAt: application.decidedAt?.toISOString() ?? null,
      createdAt: application.createdAt.toISOString(),
      updatedAt: application.updatedAt.toISOString()
    }));
  }

  // 摘要卡只暴露大学页最关心的几个数字，避免页面自己重复 count。
  async getSummary(familyKey: string) {
    const [ruleCount, pendingApplicationCount, approvedApplicationCount, rejectedApplicationCount, latestActiveSource] =
      await Promise.all([
        this.prisma.schoolRuleVersion.count({ where: { familyKey } }),
        this.prisma.studentApplication.count({
          where: { familyKey, status: "PENDING" }
        }),
        this.prisma.studentApplication.count({
          where: { familyKey, status: "APPROVED" }
        }),
        this.prisma.studentApplication.count({
          where: { familyKey, status: "REJECTED" }
        }),
        this.prisma.scoreSourcePublication.findFirst({
          where: { active: true },
          orderBy: [{ issuedAt: "desc" }, { blockNumber: "desc" }]
        })
      ]);

    return {
      familyKey,
      ruleCount,
      pendingApplicationCount,
      approvedApplicationCount,
      rejectedApplicationCount,
      latestScoreSourceIdLabel: latestActiveSource?.scoreSourceIdLabel ?? null
    };
  }

  // 大学 workbench 的设计重点是“单次同步、单次组装”。
  // 当前成绩源是否已创建规则、是否还能新建草稿，都统一以后端判断为准。
  async getWorkbench(familyKey: string) {
    const syncStatus = await this.indexerService.syncAll();
    const [rules, applications, summary, latestActiveSource] = await Promise.all([
      this.getRuleVersions(familyKey),
      this.getApplications(familyKey),
      this.getSummary(familyKey),
      this.prisma.scoreSourcePublication.findFirst({
        where: { active: true },
        orderBy: [{ issuedAt: "desc" }, { blockNumber: "desc" }]
      })
    ]);

    const currentSourceRule = latestActiveSource
      ? rules.find(
          (rule) =>
            rule.scoreSourceId.toLowerCase() === latestActiveSource.scoreSourceId.toLowerCase()
        ) ?? null
      : null;
    const canCreateDraft = Boolean(latestActiveSource && !currentSourceRule);
    const createDraftGuardReason = !latestActiveSource
      ? "考试院尚未发布本届成绩，暂时不能设置录取线。"
      : currentSourceRule
        ? "当前成绩源已经提交过规则，请等待考试院发布下一版成绩。"
        : null;

    return {
      familyKey,
      latestActiveSource: this.normalizeScoreSource(latestActiveSource),
      summary,
      currentSourceRule,
      canCreateDraft,
      createDraftGuardReason,
      rules,
      applications,
      syncStatus
    };
  }
}
