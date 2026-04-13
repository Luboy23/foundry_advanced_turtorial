import { Injectable } from "@nestjs/common";
import { createPublicClient, http, parseAbi, parseAbiItem } from "viem";
import type { Abi, PublicClient } from "viem";
import { foundry } from "viem/chains";
import { loadAppConfig, resolveContractConfig, type BackendContractConfig } from "../config/app-config";
import { ZERO_BYTES32 } from "./chain.utils";

// 把后端对链的所有直接读取都收口在这里。
// service / indexer 不直接拼 ABI 或 RPC 参数，只通过这层读取角色、成绩源、学校规则和申请状态。
type ScoreSourceTuple = {
  scoreSourceId: `0x${string}`;
  sourceTitle: string;
  merkleRoot: bigint;
  maxScore: bigint | number;
  issuedAt: bigint;
  issuer: `0x${string}`;
  active: boolean;
};

type SchoolTuple = {
  schoolId: `0x${string}`;
  universityKey: `0x${string}`;
  schoolName: string;
  scoreSourceId: `0x${string}`;
  cutoffScore: bigint | number;
  updatedAt: bigint;
  admin: `0x${string}`;
  active: boolean;
  cutoffFrozen: boolean;
};

type ApplicationTuple = {
  schoolId: `0x${string}`;
  applicant: `0x${string}`;
  nullifierHash: bigint;
  submittedAt: bigint;
  decidedAt: bigint;
  status: bigint | number;
};

type AdmissionTuple = {
  schoolId: `0x${string}`;
  admittedAt: bigint;
  admitted: boolean;
};

@Injectable()
export class ChainService {
  private readonly appConfig = loadAppConfig();
  private readonly contractConfig = resolveContractConfig(this.appConfig);
  private readonly publicClient: PublicClient;

  readonly roleRegistryAbi = parseAbi([
    "function isAuthority(address account) view returns (bool)",
    "function isStudent(address account) view returns (bool)",
    "function getUniversityKeyByAdmin(address admin) view returns (bytes32)"
  ]) satisfies Abi;

  readonly scoreRootRegistryAbi = parseAbi([
    "function getScoreSource(bytes32 scoreSourceId) view returns ((bytes32 scoreSourceId, string sourceTitle, uint256 merkleRoot, uint32 maxScore, uint64 issuedAt, address issuer, bool active))"
  ]) satisfies Abi;

  readonly universityAdmissionVerifierAbi = parseAbi([
    "function getSchool(bytes32 schoolId) view returns ((bytes32 schoolId, bytes32 universityKey, string schoolName, bytes32 scoreSourceId, uint32 cutoffScore, uint64 updatedAt, address admin, bool active, bool cutoffFrozen))",
    "function getSchoolApplicants(bytes32 schoolId) view returns (address[])",
    "function getApplication(bytes32 schoolId, address applicant) view returns ((bytes32 schoolId, address applicant, uint256 nullifierHash, uint64 submittedAt, uint64 decidedAt, uint8 status))",
    "function getStudentApplication(address student) view returns ((bytes32 schoolId, address applicant, uint256 nullifierHash, uint64 submittedAt, uint64 decidedAt, uint8 status) application, bool exists)",
    "function getAdmission(address student) view returns ((bytes32 schoolId, uint64 admittedAt, bool admitted))"
  ]) satisfies Abi;

  readonly scoreSourceCreatedEvent = parseAbiItem(
    "event ScoreSourceCreated(bytes32 indexed scoreSourceId, string sourceTitle, uint32 maxScore, uint256 merkleRoot, address indexed issuer)"
  );

  readonly schoolCreatedEvent = parseAbiItem(
    "event SchoolCreated(bytes32 indexed schoolId, bytes32 indexed universityKey, string schoolName, bytes32 scoreSourceId, uint32 cutoffScore, address indexed admin)"
  );

  readonly schoolConfigUpdatedEvent = parseAbiItem(
    "event SchoolConfigUpdated(bytes32 indexed schoolId, uint32 cutoffScore, bool active)"
  );

  readonly applicationSubmittedEvent = parseAbiItem(
    "event ApplicationSubmitted(bytes32 indexed schoolId, address indexed applicant, uint256 nullifierHash)"
  );

  readonly applicationApprovedEvent = parseAbiItem(
    "event ApplicationApproved(bytes32 indexed schoolId, address indexed applicant, uint64 approvedAt)"
  );

  readonly applicationRejectedEvent = parseAbiItem(
    "event ApplicationRejected(bytes32 indexed schoolId, address indexed applicant, uint64 rejectedAt)"
  );

  constructor() {
    this.publicClient = createPublicClient({
      chain: foundry,
      transport: http(this.contractConfig.rpcUrl || this.appConfig.chainRpcUrl)
    });
  }

  // 对外暴露统一 public client，供 indexer 读取事件日志时复用。
  getPublicClient() {
    return this.publicClient;
  }

  getContractConfig(): BackendContractConfig {
    return this.contractConfig;
  }

  async getCurrentBlockNumber() {
    return this.publicClient.getBlockNumber();
  }

  // 角色读取是后端鉴权和页面守卫的共同基础。
  // 这里统一解释成 authority / student / university / unknown，避免其他层自行组合多次链上查询。
  async getRole(address: `0x${string}`) {
    const [isAuthority, isStudent, universityKey] = await Promise.all([
      this.publicClient.readContract({
        abi: this.roleRegistryAbi,
        address: this.contractConfig.admissionRoleRegistryAddress,
        functionName: "isAuthority",
        args: [address]
      }),
      this.publicClient.readContract({
        abi: this.roleRegistryAbi,
        address: this.contractConfig.admissionRoleRegistryAddress,
        functionName: "isStudent",
        args: [address]
      }),
      this.publicClient.readContract({
        abi: this.roleRegistryAbi,
        address: this.contractConfig.admissionRoleRegistryAddress,
        functionName: "getUniversityKeyByAdmin",
        args: [address]
      })
    ]);

    if (isAuthority) {
      return { role: "authority" as const, universityKey: null };
    }
    if (isStudent) {
      return { role: "student" as const, universityKey: null };
    }
    if (universityKey !== ZERO_BYTES32) {
      return { role: "university" as const, universityKey };
    }
    return { role: "unknown" as const, universityKey: null };
  }

  // 下面这组读取方法保持“最小事实读取”风格：
  // 不做业务解释，只返回合约当前状态，真正的页面语义交给 workbench service 组装。
  async readScoreSource(scoreSourceId: `0x${string}`) {
    return (await this.publicClient.readContract({
      abi: this.scoreRootRegistryAbi,
      address: this.contractConfig.scoreRootRegistryAddress,
      functionName: "getScoreSource",
      args: [scoreSourceId]
    })) as unknown as ScoreSourceTuple;
  }

  async readSchool(schoolId: `0x${string}`) {
    return (await this.publicClient.readContract({
      abi: this.universityAdmissionVerifierAbi,
      address: this.contractConfig.universityAdmissionVerifierAddress,
      functionName: "getSchool",
      args: [schoolId]
    })) as unknown as SchoolTuple;
  }

  async readSchoolApplicants(schoolId: `0x${string}`) {
    return (await this.publicClient.readContract({
      abi: this.universityAdmissionVerifierAbi,
      address: this.contractConfig.universityAdmissionVerifierAddress,
      functionName: "getSchoolApplicants",
      args: [schoolId]
    })) as `0x${string}`[];
  }

  async readApplication(schoolId: `0x${string}`, applicant: `0x${string}`) {
    return (await this.publicClient.readContract({
      abi: this.universityAdmissionVerifierAbi,
      address: this.contractConfig.universityAdmissionVerifierAddress,
      functionName: "getApplication",
      args: [schoolId, applicant]
    })) as unknown as ApplicationTuple;
  }

  async readStudentApplication(student: `0x${string}`) {
    return (await this.publicClient.readContract({
      abi: this.universityAdmissionVerifierAbi,
      address: this.contractConfig.universityAdmissionVerifierAddress,
      functionName: "getStudentApplication",
      args: [student]
    })) as unknown as { application: ApplicationTuple; exists: boolean };
  }

  async readAdmission(student: `0x${string}`) {
    return (await this.publicClient.readContract({
      abi: this.universityAdmissionVerifierAbi,
      address: this.contractConfig.universityAdmissionVerifierAddress,
      functionName: "getAdmission",
      args: [student]
    })) as unknown as AdmissionTuple;
  }
}
