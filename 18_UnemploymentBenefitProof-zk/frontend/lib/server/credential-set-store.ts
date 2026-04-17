import "server-only";

import { randomBytes } from "crypto";
import fs from "fs";
import path from "path";
import { createPublicClient, http } from "viem";
import { benefitRoleRegistryAbi, unemploymentCredentialRootRegistryAbi } from "@/lib/contracts/abis";
import {
  buildCredentialSetArtifacts,
  credentialSetRecordsAreEqual,
  getTodayReferenceDate,
  validateCredentialSetDraftInput,
  validateResolvedCredentialSetDraftInput
} from "@/lib/credential-set-management";
import { readRuntimeConfigForScript } from "@/lib/runtime-config.server";
import type { Address } from "@/types/contract-config";
import type {
  CredentialSetDraftInput,
  EditableApplicantRecord,
  GeneratedCredentialSetSnapshot,
  GovernmentCredentialSetState,
  LocalUnemploymentCredential,
  ResolvedApplicantRecord,
  ResolvedCredentialSetDraftInput,
  UnemploymentCredentialSet
} from "@/types/domain";

/**
 * 政府端资格名单快照与私有凭证样例存储层。
 *
 * 这一层运行在 Next.js 服务端，负责把“链上当前生效版本”“本地历史快照”“编辑中的待发布草稿”
 * 统一整理成政府页面可读的状态，并在需要时为新版本名单重新生成私有凭证样例。
 */
type SampleInputFile = {
  credentialSet?: {
    v1?: {
      version: number;
      referenceDate: number;
      records: Array<{
        applicantLabel?: string;
        identityHash: string;
        secretSalt: string;
        boundApplicantAddress: Address;
      }>;
    };
    v2?: {
      version: number;
      referenceDate: number;
      records: Array<{
        applicantLabel?: string;
        identityHash: string;
        secretSalt: string;
        boundApplicantAddress: Address;
      }>;
    };
  };
};

const CREDENTIAL_SET_ROOT_DIR = path.join(process.cwd(), "server-data", "credential-sets");
const CREDENTIAL_SET_SNAPSHOTS_DIR = path.join(CREDENTIAL_SET_ROOT_DIR, "snapshots");
const PRIVATE_CREDENTIALS_DIR = path.join(process.cwd(), "server-data", "credentials");
const SAMPLE_INPUT_FILE = path.resolve(process.cwd(), "..", "zk", "data", "input", "sample-unemployment-records.json");

/** 确保持久化目录存在。 */
function ensureDir(targetPath: string) {
  fs.mkdirSync(targetPath, { recursive: true });
}

/** 创建只读 public client，用于服务端读取链上当前名单和角色状态。 */
function getPublicClient() {
  const config = readRuntimeConfigForScript();
  return createPublicClient({
    transport: http(config.rpcUrl)
  });
}

/** 同时兼容 viem 返回的 tuple 与具名 struct 字段。 */
function readStructValue<T>(value: unknown, key: string, index: number): T {
  const record = value as Record<string, T> & T[];
  return record?.[key] ?? record?.[index];
}

/** 把地址统一转成小写，用于文件命名和历史记录对比。 */
function normalizeAddress(address: Address) {
  return address.toLowerCase();
}

/** 计算指定版本快照文件路径。 */
function snapshotFilePath(version: number) {
  return path.join(CREDENTIAL_SET_SNAPSHOTS_DIR, `v${version}.json`);
}

/** 计算指定版本私有凭证目录路径。 */
function versionedCredentialDir(version: number) {
  return path.join(PRIVATE_CREDENTIALS_DIR, `v${version}`);
}

/** 计算指定版本和账户对应的私有凭证文件路径。 */
function versionedCredentialPath(version: number, address: Address) {
  return path.join(versionedCredentialDir(version), `${normalizeAddress(address)}.json`);
}

/** 读取 JSON 文件并按调用方约定的类型返回。 */
function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

/** 把对象按稳定的格式写入 JSON 文件。 */
function writeJsonFile(filePath: string, value: unknown) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

/** 读取链上当前生效的资格名单；未发布或读取失败时返回 `null`。 */
async function readCurrentChainCredentialSet(): Promise<UnemploymentCredentialSet | null> {
  const config = readRuntimeConfigForScript();
  const publicClient = getPublicClient();

  try {
    const value = await publicClient.readContract({
      abi: unemploymentCredentialRootRegistryAbi,
      address: config.rootRegistryAddress,
      functionName: "getCurrentCredentialSet"
    });

    return {
      setId: readStructValue<`0x${string}`>(value, "setId", 0),
      merkleRoot: BigInt(readStructValue<bigint | string>(value, "merkleRoot", 1)),
      version: Number(readStructValue<number | bigint>(value, "version", 2)),
      referenceDate: Number(readStructValue<number | bigint>(value, "referenceDate", 3)),
      eligibleCount: Number(readStructValue<number | bigint>(value, "eligibleCount", 4)),
      issuer: readStructValue<Address>(value, "issuer", 5),
      updatedAt: Number(readStructValue<number | bigint>(value, "updatedAt", 6)),
      active: Boolean(readStructValue<boolean>(value, "active", 7))
    };
  } catch {
    return null;
  }
}

/** 批量读取申请人角色状态，供政府端判断发布前还需同步哪些 applicant 权限。 */
async function readApplicantRoleStates(addresses: Address[]) {
  const uniqueAddresses = [...new Set(addresses.map(normalizeAddress))] as Address[];
  if (!uniqueAddresses.length) {
    return new Map<string, boolean>();
  }

  const config = readRuntimeConfigForScript();
  const publicClient = getPublicClient();
  const states = await Promise.all(
    uniqueAddresses.map(async (address) => {
      const allowed = (await publicClient.readContract({
        abi: benefitRoleRegistryAbi,
        address: config.roleRegistryAddress,
        functionName: "isApplicant",
        args: [address]
      })) as boolean;

      return [normalizeAddress(address), allowed] as const;
    })
  );

  return new Map(states);
}

/** 列出本地所有快照文件，并按版本从小到大排序。 */
function listSnapshotFiles() {
  ensureDir(CREDENTIAL_SET_SNAPSHOTS_DIR);
  return fs
    .readdirSync(CREDENTIAL_SET_SNAPSHOTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^v\d+\.json$/.test(entry.name))
    .map((entry) => path.join(CREDENTIAL_SET_SNAPSHOTS_DIR, entry.name))
    .sort((left, right) => {
      const leftVersion = Number(path.basename(left).slice(1, -5));
      const rightVersion = Number(path.basename(right).slice(1, -5));
      return leftVersion - rightVersion;
    });
}

/** 读取所有快照文件。 */
function listSnapshots() {
  return listSnapshotFiles().map((filePath) => readJsonFile<GeneratedCredentialSetSnapshot>(filePath));
}

/** 读取本地最新快照。 */
function getLatestSnapshot() {
  const snapshots = listSnapshots();
  return snapshots.at(-1) ?? null;
}

/** 从 zk 输入样例里挑选一份可用的种子版本，供首次启动时初始化本地快照。 */
function readSampleSeedVersion(currentVersion?: number | null) {
  const payload = readJsonFile<SampleInputFile>(SAMPLE_INPUT_FILE);
  const versions = [payload.credentialSet?.v1, payload.credentialSet?.v2].filter(Boolean);
  if (!versions.length) {
    throw new Error("当前未找到可用的资格名单种子数据。");
  }

  const matched = versions.find((version) => version!.version === currentVersion);
  return matched ?? versions[0]!;
}

/**
 * 把 resolved 草稿写成快照，并为该版本生成所有申请人的私有凭证样例。
 *
 * 每次写入前会先重建该版本的凭证目录，避免旧草稿残留文件污染新版本。
 */
async function writeSnapshotAndCredentials(
  input: ResolvedCredentialSetDraftInput,
  previousSnapshot?: GeneratedCredentialSetSnapshot | null
) {
  const { set, credentials } = await buildCredentialSetArtifacts(input);
  const snapshot: GeneratedCredentialSetSnapshot = {
    version: input.version,
    createdAt: previousSnapshot?.createdAt ?? Math.floor(Date.now() / 1000),
    publishedAt: previousSnapshot?.publishedAt,
    publishedTxHash: previousSnapshot?.publishedTxHash,
    roleSyncTxHash: previousSnapshot?.roleSyncTxHash,
    input,
    set
  };

  writeJsonFile(snapshotFilePath(input.version), snapshot);
  fs.rmSync(versionedCredentialDir(input.version), { recursive: true, force: true });
  ensureDir(versionedCredentialDir(input.version));
  for (const credential of credentials) {
    writeJsonFile(versionedCredentialPath(input.version, credential.boundApplicantAddress), credential);
  }

  return snapshot;
}

/** 把 resolved 记录裁剪回页面可编辑形态。 */
function toEditableApplicantRecord(record: ResolvedApplicantRecord): EditableApplicantRecord {
  return {
    applicantAddress: record.applicantAddress,
    applicantLabel: record.applicantLabel ?? ""
  };
}

/** 把 resolved 草稿裁剪回政府端编辑器使用的输入结构。 */
function toEditableDraftInput(input: ResolvedCredentialSetDraftInput): CredentialSetDraftInput {
  return {
    version: input.version,
    referenceDate: input.referenceDate,
    records: input.records.map(toEditableApplicantRecord)
  };
}

/** 为新申请地址生成随机 secretSalt，避免不同版本复用同一组私有字段。 */
function generateSecretSalt() {
  const value = BigInt(`0x${randomBytes(16).toString("hex")}`);
  return (value === 0n ? 1n : value).toString();
}

/** 扫描历史快照中使用过的最大 identityHash，保证新增申请人始终递增分配。 */
function getMaximumIdentityHash(snapshots: GeneratedCredentialSetSnapshot[]) {
  let maxIdentityHash = 0n;

  for (const snapshot of snapshots) {
    for (const record of snapshot.input.records) {
      const identityHash = BigInt(record.identityHash);
      if (identityHash > maxIdentityHash) {
        maxIdentityHash = identityHash;
      }
    }
  }

  return maxIdentityHash;
}

/** 建立“地址 -> 历史记录”映射，用于判断新草稿是否重复录入老申请地址。 */
function getHistoricalApplicantRecordMap(snapshots: GeneratedCredentialSetSnapshot[]) {
  const history = new Map<string, ResolvedApplicantRecord>();

  for (const snapshot of snapshots) {
    for (const record of snapshot.input.records) {
      history.set(normalizeAddress(record.applicantAddress as Address), record);
    }
  }

  return history;
}

/**
 * 解析当前不可变的基线快照。
 *
 * 如果链上已有已发布版本，政府端只能在该版本基础上追加新地址，不能删除或改写历史记录。
 */
function resolveImmutableBaseSnapshot(
  currentChainSet: UnemploymentCredentialSet | null,
  snapshots: GeneratedCredentialSetSnapshot[]
) {
  if (!snapshots.length) {
    return null;
  }

  if (!currentChainSet) {
    return snapshots.at(-1) ?? null;
  }

  return [...snapshots].reverse().find((snapshot) => snapshot.version >= currentChainSet.version) ?? null;
}

/**
 * 把政府页面提交的可编辑草稿解析成最终可生成凭证的 resolved 草稿。
 *
 * 这里会强制保护两类约束：
 * 1. 已发布记录不能修改或删除；
 * 2. 新增地址必须是历史上从未出现过的地址，并为其生成新的 identityHash / secretSalt。
 */
function resolveDraftInput(
  input: CredentialSetDraftInput,
  immutableBaseInput: ResolvedCredentialSetDraftInput | null,
  snapshots: GeneratedCredentialSetSnapshot[]
): ResolvedCredentialSetDraftInput {
  const baseRecords = immutableBaseInput?.records ?? [];
  if (input.records.length < baseRecords.length) {
    throw new Error("已录入的申请地址不支持删除。");
  }

  const historicalRecordMap = getHistoricalApplicantRecordMap(snapshots);
  const resolvedRecords: ResolvedApplicantRecord[] = [];

  // 已发布部分必须原样保留，否则同一版本的老申请人会因为身份字段被重写而导致旧凭证失效。
  for (let index = 0; index < baseRecords.length; index += 1) {
    const baseRecord = baseRecords[index];
    const submittedRecord = input.records[index];

    if (!submittedRecord) {
      throw new Error("已录入的申请地址不支持删除。");
    }

    if (normalizeAddress(submittedRecord.applicantAddress as Address) !== normalizeAddress(baseRecord.applicantAddress as Address)) {
      throw new Error("已录入的申请地址不支持修改或删除。");
    }

    if ((submittedRecord.applicantLabel?.trim() ?? "") !== (baseRecord.applicantLabel ?? "")) {
      throw new Error("已录入的申请记录不支持修改。");
    }

    resolvedRecords.push(baseRecord);
  }

  let nextIdentityHash = getMaximumIdentityHash(snapshots);
  // 只有新增记录才会分配新的 identityHash / secretSalt，保证历史地址在不同快照里不会被重复定义。
  for (let index = baseRecords.length; index < input.records.length; index += 1) {
    const submittedRecord = input.records[index];
    const applicantAddress = submittedRecord.applicantAddress as Address;
    const normalizedAddress = normalizeAddress(applicantAddress);

    if (historicalRecordMap.has(normalizedAddress)) {
      throw new Error("该申请钱包地址已录入，无需重复添加。");
    }

    nextIdentityHash += 1n;
    const resolvedRecord: ResolvedApplicantRecord = {
      applicantAddress,
      applicantLabel: submittedRecord.applicantLabel?.trim() ?? "",
      identityHash: nextIdentityHash.toString(),
      secretSalt: generateSecretSalt()
    };

    resolvedRecords.push(resolvedRecord);
    historicalRecordMap.set(normalizedAddress, resolvedRecord);
  }

  const resolvedInput: ResolvedCredentialSetDraftInput = {
    version: input.version,
    referenceDate: input.referenceDate,
    records: resolvedRecords
  };
  const resolvedValidation = validateResolvedCredentialSetDraftInput(resolvedInput);
  if (!resolvedValidation.valid) {
    throw new Error(resolvedValidation.errors[0] ?? "资格名单数据无效。");
  }

  return resolvedValidation.normalizedInput;
}

/** 首次启动本地服务端存储时，用样例数据落一份初始快照，保证政府端页面有可编辑基线。 */
export async function ensureSeededCredentialSetStore() {
  ensureDir(CREDENTIAL_SET_SNAPSHOTS_DIR);
  ensureDir(PRIVATE_CREDENTIALS_DIR);

  if (listSnapshotFiles().length > 0) {
    return;
  }

  const currentChainSet = await readCurrentChainCredentialSet();
  const seedVersion = readSampleSeedVersion(currentChainSet?.version ?? null);
  const seedDraft: ResolvedCredentialSetDraftInput = {
    version: seedVersion.version,
    referenceDate: seedVersion.referenceDate,
    records: seedVersion.records.map((record) => ({
      applicantAddress: record.boundApplicantAddress,
      identityHash: record.identityHash,
      secretSalt: record.secretSalt,
      applicantLabel: record.applicantLabel ?? ""
    }))
  };

  await writeSnapshotAndCredentials(seedDraft, null);
}

/** 生成政府端编辑器默认展示的草稿。 */
function buildEditorDraft(
  currentChainSet: UnemploymentCredentialSet | null,
  currentPublishedSnapshot: GeneratedCredentialSetSnapshot | null,
  latestDraftSnapshot: GeneratedCredentialSetSnapshot | null
): CredentialSetDraftInput {
  if (latestDraftSnapshot) {
    return toEditableDraftInput(latestDraftSnapshot.input);
  }

  if (currentPublishedSnapshot) {
    return {
      version: currentPublishedSnapshot.version + 1,
      referenceDate: getTodayReferenceDate(),
      records: currentPublishedSnapshot.input.records.map(toEditableApplicantRecord)
    };
  }

  const latestSnapshot = getLatestSnapshot();
  if (latestSnapshot) {
    return {
      version: currentChainSet ? currentChainSet.version + 1 : latestSnapshot.version,
      referenceDate: getTodayReferenceDate(),
      records: latestSnapshot.input.records.map(toEditableApplicantRecord)
    };
  }

  return {
    version: currentChainSet ? currentChainSet.version + 1 : 1,
    referenceDate: getTodayReferenceDate(),
    records: []
  };
}

/**
 * 聚合政府端工作台所需的完整状态。
 *
 * 返回结果同时包含链上 current set、本地已发布快照、最新待发布草稿，以及哪些地址仍需在
 * 发布前同步 applicant 权限。
 */
export async function readGovernmentCredentialSetState(): Promise<GovernmentCredentialSetState> {
  await ensureSeededCredentialSetStore();

  const currentChainSet = await readCurrentChainCredentialSet();
  const snapshots = listSnapshots();
  const currentPublishedSnapshot = currentChainSet
    ? snapshots.find((snapshot) => snapshot.version === currentChainSet.version) ?? null
    : null;
  const immutableBaseSnapshot = resolveImmutableBaseSnapshot(currentChainSet, snapshots);
  const latestDraftSnapshot =
    immutableBaseSnapshot && (!currentPublishedSnapshot || immutableBaseSnapshot.version > currentPublishedSnapshot.version)
      ? immutableBaseSnapshot
      : null;
  const editorDraft = buildEditorDraft(currentChainSet, currentPublishedSnapshot, latestDraftSnapshot);
  const pendingRoleMap = latestDraftSnapshot
    ? await readApplicantRoleStates(
        latestDraftSnapshot.input.records.map((record) => record.applicantAddress as Address)
      )
    : new Map<string, boolean>();

  return {
    currentChainSet,
    currentPublishedSnapshot,
    latestDraftSnapshot,
    editorDraft,
    draftPendingApplicantAddresses: latestDraftSnapshot
      ? latestDraftSnapshot.input.records
          .map((record) => record.applicantAddress as Address)
          .filter((address) => !pendingRoleMap.get(normalizeAddress(address)))
      : []
  };
}

/**
 * 校验并生成一份新的待发布草稿。
 *
 * 这里不会写链，只会把快照和私有凭证样例准备好，真正的角色同步与名单发布由前端签名后
 * 再调用链上交易完成。
 */
export async function prepareCredentialSetDraft(input: CredentialSetDraftInput) {
  await ensureSeededCredentialSetStore();

  const validation = validateCredentialSetDraftInput(input);
  if (!validation.valid) {
    throw new Error(validation.errors[0] ?? "资格名单数据无效。");
  }

  const currentChainSet = await readCurrentChainCredentialSet();
  const snapshots = listSnapshots();
  const expectedVersion = currentChainSet ? currentChainSet.version + 1 : 1;
  if (validation.normalizedInput.version !== expectedVersion) {
    throw new Error(`新资格名单版本必须为 v${expectedVersion}。`);
  }

  const currentPublishedSnapshot = currentChainSet
    ? snapshots.find((snapshot) => snapshot.version === currentChainSet.version) ?? null
    : null;
  const immutableBaseSnapshot = resolveImmutableBaseSnapshot(currentChainSet, snapshots);
  const resolvedInput = resolveDraftInput(validation.normalizedInput, immutableBaseSnapshot?.input ?? null, snapshots);
  const previousSnapshot = fs.existsSync(snapshotFilePath(validation.normalizedInput.version))
    ? readJsonFile<GeneratedCredentialSetSnapshot>(snapshotFilePath(validation.normalizedInput.version))
    : null;
  const preview = await buildCredentialSetArtifacts(resolvedInput);

  // 如果名单摘要和记录都没变化，就没有必要重复写快照或重新发起发布。
  if (
    currentChainSet &&
    preview.set.merkleRoot === currentChainSet.merkleRoot.toString() &&
    currentPublishedSnapshot &&
    credentialSetRecordsAreEqual(resolvedInput, currentPublishedSnapshot.input)
  ) {
    throw new Error("当前资格名单没有发生变化，无需重复发布。");
  }

  const snapshot = await writeSnapshotAndCredentials(resolvedInput, previousSnapshot);

  const roleMap = await readApplicantRoleStates(
    snapshot.input.records.map((record) => record.applicantAddress as Address)
  );
  return {
    snapshot,
    pendingApplicantAddresses: snapshot.input.records
      .map((record) => record.applicantAddress as Address)
      .filter((address) => !roleMap.get(normalizeAddress(address)))
  };
}

/** 在链上发布成功后，把本地快照补上发布时间和交易哈希，形成已发布版本记录。 */
export async function markCredentialSetPublished(version: number, txHash: `0x${string}`, roleSyncTxHash?: `0x${string}`) {
  await ensureSeededCredentialSetStore();

  const filePath = snapshotFilePath(version);
  if (!fs.existsSync(filePath)) {
    throw new Error(`当前未找到 v${version} 对应的资格名单草稿。`);
  }

  const snapshot = readJsonFile<GeneratedCredentialSetSnapshot>(filePath);
  const nextSnapshot: GeneratedCredentialSetSnapshot = {
    ...snapshot,
    publishedAt: Math.floor(Date.now() / 1000),
    publishedTxHash: txHash,
    roleSyncTxHash: roleSyncTxHash ?? snapshot.roleSyncTxHash
  };

  writeJsonFile(filePath, nextSnapshot);
  return nextSnapshot;
}

/**
 * 读取指定版本、指定地址的私有凭证样例。
 *
 * 兼容旧目录结构的回退逻辑保留下来，是为了让历史演示数据在目录升级后仍可被读取。
 */
export async function loadPrivateCredentialByVersionAndAddress(version: number, address: Address) {
  await ensureSeededCredentialSetStore();

  const targetPath = versionedCredentialPath(version, address);
  if (fs.existsSync(targetPath)) {
    return readJsonFile<LocalUnemploymentCredential>(targetPath);
  }

  const legacyCandidates = fs
    .readdirSync(PRIVATE_CREDENTIALS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && path.extname(entry.name) === ".json");

  for (const candidate of legacyCandidates) {
    const payload = readJsonFile<LocalUnemploymentCredential>(path.join(PRIVATE_CREDENTIALS_DIR, candidate.name));
    if (
      payload.boundApplicantAddress.toLowerCase() === normalizeAddress(address) &&
      payload.versionNumber === version
    ) {
      return payload;
    }
  }

  return null;
}
