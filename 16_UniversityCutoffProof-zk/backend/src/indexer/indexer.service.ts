import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { ChainService } from "../chain/chain.service";
import { loadAppConfig } from "../config/app-config";
import {
  buildSchoolRuleVersionId,
  decodeBytes32Label,
  deriveSchoolFamilyKey,
  parseVersionNumberFromLabel,
  toDateFromSeconds
} from "../chain/chain.utils";

// 链上投影器。
// 目标不是提供任意查询，而是把“成绩源、学校规则、学生申请”三类事件整理成 workbench 可直接消费的 SQLite 快照。
type SyncProjectionName = "score-sources" | "school-rules" | "applications" | "full-sync";

export type IndexerSyncReport = {
  latestBlock: number | null;
  stale: boolean;
  partialErrors: string[];
};

@Injectable()
export class IndexerService implements OnModuleInit {
  private readonly logger = new Logger(IndexerService.name);
  private readonly appConfig = loadAppConfig();
  private syncPromise: Promise<IndexerSyncReport> | null = null;

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(ChainService)
    private readonly chainService: ChainService
  ) {}

  // 启动时先做一次同步，保证 workbench 第一眼看到的不是完全空白的旧库。
  async onModuleInit() {
    if (!this.appConfig.indexerEnabled) {
      return;
    }
    await this.syncAll();
  }

  // 定时同步只做增量追平，不做破坏性重建。
  @Cron("*/5 * * * * *")
  async handleCron() {
    if (!this.appConfig.indexerEnabled) {
      return;
    }
    await this.syncAll();
  }

  // 外部统一通过 syncAll 触发投影更新。
  // 这里显式复用同一个 promise，避免页面并发请求时重复跑三轮链上扫描。
  async syncAll(): Promise<IndexerSyncReport> {
    if (this.syncPromise) {
      return this.syncPromise;
    }

    this.syncPromise = this.performSync();
    try {
      return await this.syncPromise;
    } finally {
      this.syncPromise = null;
    }
  }

  // 单轮同步的主入口：
  // 先拿最新区块，再按“成绩源 / 学校规则 / 学生申请”三条投影线分别增量推进。
  private async performSync(): Promise<IndexerSyncReport> {
    const partialErrors: string[] = [];
    let latestBlock: number | null = null;

    try {
      latestBlock = Number(await this.chainService.getCurrentBlockNumber());
      const syncedBlock = latestBlock;
      await this.ensureChainProjectionScope();

      await this.runProjection("score-sources", syncedBlock, partialErrors, async () => {
        await this.syncScoreSources(syncedBlock);
      });
      await this.runProjection("school-rules", syncedBlock, partialErrors, async () => {
        await this.syncSchoolRules(syncedBlock);
      });
      await this.runProjection("applications", syncedBlock, partialErrors, async () => {
        await this.syncApplications(syncedBlock);
      });

      await this.updateSyncState("full-sync", syncedBlock);
    } catch (error) {
      this.logger.error("链上投影同步失败", error instanceof Error ? error.stack : undefined);
      partialErrors.push("链上投影同步失败，请稍后重试。");
    }

    return {
      latestBlock,
      stale: partialErrors.length > 0,
      partialErrors
    };
  }

  // 某条投影失败时，不让整个 workbench 直接失败，而是带着 partialErrors 继续返回可用部分。
  private async runProjection(
    projectionName: SyncProjectionName,
    latestBlock: number,
    partialErrors: string[],
    task: () => Promise<void>
  ) {
    try {
      await task();
    } catch (error) {
      this.logger.error(
        `投影 ${projectionName} 同步失败`,
        error instanceof Error ? error.stack : undefined
      );
      partialErrors.push(this.getProjectionErrorMessage(projectionName, latestBlock));
    }
  }

  private getProjectionErrorMessage(projectionName: SyncProjectionName, latestBlock: number) {
    if (projectionName === "score-sources") {
      return `成绩源历史同步失败，当前展示的数据可能停留在区块 #${latestBlock} 之前。`;
    }
    if (projectionName === "school-rules") {
      return `大学规则历史同步失败，当前展示的数据可能停留在区块 #${latestBlock} 之前。`;
    }
    if (projectionName === "applications") {
      return `学生申请历史同步失败，当前展示的数据可能停留在区块 #${latestBlock} 之前。`;
    }
    return "链上投影同步失败，当前展示的数据可能不是最新状态。";
  }

  // 这组配置拼成“部署指纹”，用于识别当前 SQLite 投影是否仍然属于当前这轮本地链。
  private getDeploymentFingerprint() {
    const config = this.chainService.getContractConfig();
    return [
      config.chainId,
      config.scoreRootRegistryAddress.toLowerCase(),
      config.universityAdmissionVerifierAddress.toLowerCase(),
      config.deploymentBlockNumber ?? 0,
      config.deploymentBlockHash ?? "unknown"
    ].join(":");
  }

  // 一旦本地链被重置，旧投影必须整体清空，否则会出现“链上已重置但工作台仍显示旧数据”的错觉。
  private async ensureChainProjectionScope() {
    const fingerprint = this.getDeploymentFingerprint();
    const existing = await this.prisma.chainSyncState.findUnique({
      where: { projectionName: "deployment-fingerprint" }
    });

    if (existing?.lastSyncedTx === fingerprint) {
      return;
    }

    await this.prisma.$transaction([
      this.prisma.scoreSourcePublication.deleteMany(),
      this.prisma.schoolRuleVersion.deleteMany(),
      this.prisma.studentApplication.deleteMany(),
      this.prisma.chainSyncState.deleteMany({
        where: {
          projectionName: {
            in: ["score-sources", "school-rules", "applications", "full-sync"]
          }
        }
      }),
      this.prisma.chainSyncState.upsert({
        where: { projectionName: "deployment-fingerprint" },
        create: {
          projectionName: "deployment-fingerprint",
          lastSyncedBlock: this.chainService.getContractConfig().deploymentBlockNumber ?? 0,
          lastSyncedTx: fingerprint
        },
        update: {
          lastSyncedBlock: this.chainService.getContractConfig().deploymentBlockNumber ?? 0,
          lastSyncedTx: fingerprint
        }
      })
    ]);
  }

  // 每条投影都维护自己的 lastSyncedBlock。
  // 这样后端不用每次从部署块全量扫链，而是只扫描新增区块。
  private async getProjectionRange(projectionName: SyncProjectionName, latestBlock: number) {
    const config = this.chainService.getContractConfig();
    const existing = await this.prisma.chainSyncState.findUnique({
      where: { projectionName }
    });
    const fromBlock = existing
      ? existing.lastSyncedBlock + 1
      : Number(config.deploymentBlockNumber ?? 0);

    return {
      fromBlock,
      toBlock: latestBlock
    };
  }

  private async updateSyncState(projectionName: SyncProjectionName, latestBlock: number) {
    await this.prisma.chainSyncState.upsert({
      where: { projectionName },
      create: {
        projectionName,
        lastSyncedBlock: latestBlock
      },
      update: {
        lastSyncedBlock: latestBlock
      }
    });
  }

  // 成绩源投影相对简单：事件提供入口，真正展示时仍然回读合约当前状态，保证 active / merkleRoot 等字段是最新真相。
  private async syncScoreSources(latestBlock: number) {
    const client = this.chainService.getPublicClient();
    const config = this.chainService.getContractConfig();
    const { fromBlock, toBlock } = await this.getProjectionRange("score-sources", latestBlock);

    if (fromBlock > toBlock) {
      return;
    }

    const logs = await client.getLogs({
      address: config.scoreRootRegistryAddress,
      event: this.chainService.scoreSourceCreatedEvent,
      fromBlock: BigInt(fromBlock),
      toBlock: BigInt(toBlock)
    });

    for (const log of logs) {
      const scoreSourceId = log.args.scoreSourceId!;
      const source = await this.chainService.readScoreSource(scoreSourceId);
      await this.prisma.scoreSourcePublication.upsert({
        where: { scoreSourceId },
        create: {
          scoreSourceId,
          scoreSourceIdLabel: decodeBytes32Label(scoreSourceId),
          sourceTitle: source.sourceTitle,
          merkleRoot: source.merkleRoot.toString(),
          maxScore: Number(source.maxScore),
          issuer: source.issuer,
          issuedAt: toDateFromSeconds(source.issuedAt),
          txHash: log.transactionHash,
          blockNumber: Number(log.blockNumber ?? 0n),
          active: source.active
        },
        update: {
          scoreSourceIdLabel: decodeBytes32Label(scoreSourceId),
          sourceTitle: source.sourceTitle,
          merkleRoot: source.merkleRoot.toString(),
          maxScore: Number(source.maxScore),
          issuer: source.issuer,
          issuedAt: toDateFromSeconds(source.issuedAt),
          txHash: log.transactionHash,
          blockNumber: Number(log.blockNumber ?? 0n),
          active: source.active
        }
      });
    }

    await this.updateSyncState("score-sources", toBlock);
  }

  // 学校规则投影必须同时监听 SchoolCreated 和 SchoolConfigUpdated。
  // 否则大学“创建规则 + 开放申请”后，SQLite 会永远停留在未开放状态，学生侧也读不到可申请规则。
  private async syncSchoolRules(latestBlock: number) {
    const client = this.chainService.getPublicClient();
    const config = this.chainService.getContractConfig();
    const { fromBlock, toBlock } = await this.getProjectionRange("school-rules", latestBlock);

    if (fromBlock > toBlock) {
      return;
    }

    const [createdLogs, updatedLogs] = await Promise.all([
      client.getLogs({
        address: config.universityAdmissionVerifierAddress,
        event: this.chainService.schoolCreatedEvent,
        fromBlock: BigInt(fromBlock),
        toBlock: BigInt(toBlock)
      }),
      client.getLogs({
        address: config.universityAdmissionVerifierAddress,
        event: this.chainService.schoolConfigUpdatedEvent,
        fromBlock: BigInt(fromBlock),
        toBlock: BigInt(toBlock)
      })
    ]);

    // 这里不直接拿事件参数拼投影，而是先收集“本轮被触达过的 schoolId”，
    // 然后统一 readSchool 回读链上当前状态，确保 active / cutoffFrozen / updatedAt 一次到位。
    const touchedSchoolIds = new Map<
      string,
      {
        schoolId: `0x${string}`;
        txHash: `0x${string}` | null;
        blockNumber: bigint;
        logIndex: number;
      }
    >();

    const touchLogs = [...createdLogs, ...updatedLogs].sort((left, right) => {
      const blockDelta = Number((left.blockNumber ?? 0n) - (right.blockNumber ?? 0n));
      if (blockDelta !== 0) {
        return blockDelta;
      }
      return Number((left.logIndex ?? 0) - (right.logIndex ?? 0));
    });

    for (const log of touchLogs) {
      const schoolId = log.args.schoolId!;
      touchedSchoolIds.set(schoolId.toLowerCase(), {
        schoolId,
        txHash: log.transactionHash ?? null,
        blockNumber: log.blockNumber ?? 0n,
        logIndex: Number(log.logIndex ?? 0)
      });
    }

    if (!touchedSchoolIds.size) {
      await this.updateSyncState("school-rules", toBlock);
      return;
    }

    for (const touched of touchedSchoolIds.values()) {
      const schoolId = touched.schoolId;
      const school = await this.chainService.readSchool(schoolId);
      const schoolIdLabel = decodeBytes32Label(schoolId);
      const familyKey = deriveSchoolFamilyKey(
        school.universityKey,
        schoolIdLabel,
        school.schoolName
      );
      const versionNumber = parseVersionNumberFromLabel(schoolIdLabel, familyKey);

      await this.prisma.schoolRuleVersion.upsert({
        where: { schoolId },
        create: {
          schoolId,
          schoolIdLabel,
          familyKey,
          schoolName: school.schoolName,
          versionId: buildSchoolRuleVersionId(familyKey, versionNumber),
          versionNumber,
          universityKey: school.universityKey,
          scoreSourceId: school.scoreSourceId,
          cutoffScore: Number(school.cutoffScore),
          admin: school.admin,
          active: school.active,
          cutoffFrozen: school.cutoffFrozen,
          updatedAt: toDateFromSeconds(school.updatedAt),
          txHash: touched.txHash
        },
        update: {
          schoolIdLabel,
          familyKey,
          schoolName: school.schoolName,
          versionId: buildSchoolRuleVersionId(familyKey, versionNumber),
          versionNumber,
          universityKey: school.universityKey,
          scoreSourceId: school.scoreSourceId,
          cutoffScore: Number(school.cutoffScore),
          admin: school.admin,
          active: school.active,
          cutoffFrozen: school.cutoffFrozen,
          updatedAt: toDateFromSeconds(school.updatedAt),
          txHash: touched.txHash
        }
      });
    }

    await this.updateSyncState("school-rules", toBlock);
  }

  // 学生申请投影采用“事件标记 + 链上读取补全”的方式。
  // 事件负责告诉我们哪些学校 / 学生发生了变化，真正的状态仍然以合约当前记录为准。
  private async syncApplications(latestBlock: number) {
    const client = this.chainService.getPublicClient();
    const config = this.chainService.getContractConfig();
    const { fromBlock, toBlock } = await this.getProjectionRange("applications", latestBlock);

    if (fromBlock > toBlock) {
      return;
    }

    const [submittedLogs, approvedLogs, rejectedLogs] = await Promise.all([
      client.getLogs({
        address: config.universityAdmissionVerifierAddress,
        event: this.chainService.applicationSubmittedEvent,
        fromBlock: BigInt(fromBlock),
        toBlock: BigInt(toBlock)
      }),
      client.getLogs({
        address: config.universityAdmissionVerifierAddress,
        event: this.chainService.applicationApprovedEvent,
        fromBlock: BigInt(fromBlock),
        toBlock: BigInt(toBlock)
      }),
      client.getLogs({
        address: config.universityAdmissionVerifierAddress,
        event: this.chainService.applicationRejectedEvent,
        fromBlock: BigInt(fromBlock),
        toBlock: BigInt(toBlock)
      })
    ]);

    const submittedMeta = new Map<string, `0x${string}`>();
    const decisionMeta = new Map<string, `0x${string}`>();
    const touchedKeys = new Set<string>();
    const touchedSchoolIds = new Set<string>();

    for (const log of submittedLogs) {
      const schoolId = log.args.schoolId!;
      const applicant = log.args.applicant!;
      const key = `${schoolId.toLowerCase()}:${applicant.toLowerCase()}`;
      touchedKeys.add(key);
      touchedSchoolIds.add(schoolId.toLowerCase());
      submittedMeta.set(key, log.transactionHash!);
    }

    for (const log of [...approvedLogs, ...rejectedLogs]) {
      const schoolId = log.args.schoolId!;
      const applicant = log.args.applicant!;
      const key = `${schoolId.toLowerCase()}:${applicant.toLowerCase()}`;
      touchedKeys.add(key);
      touchedSchoolIds.add(schoolId.toLowerCase());
      decisionMeta.set(key, log.transactionHash!);
    }

    if (!touchedKeys.size) {
      await this.updateSyncState("applications", toBlock);
      return;
    }

    // 先把被触达 schoolId 对应的规则一次性读出来，避免后面逐条申请再回库产生额外 N+1 查询。
    const rules = await this.prisma.schoolRuleVersion.findMany({
      where: {
        schoolId: {
          in: [...touchedSchoolIds]
        }
      }
    });
    const rulesBySchoolId = new Map(
      rules.map((rule) => [rule.schoolId.toLowerCase(), rule] as const)
    );

    for (const key of touchedKeys) {
      const [schoolId, applicant] = key.split(":");
      const rule = rulesBySchoolId.get(schoolId);
      if (!rule) {
        continue;
      }

      const application = await this.chainService.readApplication(
        rule.schoolId as `0x${string}`,
        applicant as `0x${string}`
      );
      if (Number(application.status) === 0) {
        continue;
      }

      const status =
        Number(application.status) === 3
          ? "APPROVED"
          : Number(application.status) === 2
            ? "REJECTED"
            : "PENDING";

      await this.prisma.studentApplication.upsert({
        where: {
          schoolId_applicant: {
            schoolId: rule.schoolId,
            applicant
          }
        },
        create: {
          schoolId: rule.schoolId,
          schoolName: rule.schoolName,
          familyKey: rule.familyKey,
          applicant,
          nullifierHash: application.nullifierHash.toString(),
          status,
          submittedAt: toDateFromSeconds(application.submittedAt),
          decidedAt: Number(application.decidedAt) > 0 ? toDateFromSeconds(application.decidedAt) : null,
          submittedTxHash: submittedMeta.get(key),
          decisionTxHash: decisionMeta.get(key)
        },
        update: {
          schoolName: rule.schoolName,
          familyKey: rule.familyKey,
          nullifierHash: application.nullifierHash.toString(),
          status,
          submittedAt: toDateFromSeconds(application.submittedAt),
          decidedAt: Number(application.decidedAt) > 0 ? toDateFromSeconds(application.decidedAt) : null,
          submittedTxHash: submittedMeta.get(key),
          decisionTxHash: decisionMeta.get(key)
        }
      });
    }

    await this.updateSyncState("applications", toBlock);
  }
}
