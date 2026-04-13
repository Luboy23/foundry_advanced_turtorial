// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { IAdmissionRoleRegistry } from "./interfaces/IAdmissionRoleRegistry.sol";
import { IScoreRootRegistry } from "./interfaces/IScoreRootRegistry.sol";
import { IUniversityCutoffProofVerifier } from "./interfaces/IUniversityCutoffProofVerifier.sol";

/// @title 大学录取资格验证合约
/// @notice 负责大学申请规则创建、冻结以及学生申请凭证的最终链上核验。
/// @dev 合约本身不接触学生明文成绩，只验证“成绩可信且达到录取线”这个结论。
contract UniversityAdmissionVerifier {
    /// @dev 地址级基础参数为空时统一回退这类错误，避免不同入口各自发明含义接近的错误分支。
    error ZeroAddress();
    /// @dev 每个 schoolId 在当前版本里就是一轮独立规则，因此禁止复用。
    error SchoolAlreadyExists(bytes32 schoolId);
    error SchoolNotFound(bytes32 schoolId);
    error InvalidCutoffScore(uint32 cutoffScore, uint32 maxScore);
    error SchoolCutoffFrozen(bytes32 schoolId);
    error SchoolCutoffLocked(bytes32 schoolId);
    error SchoolInactive(bytes32 schoolId);
    error ScoreSourceInactive(bytes32 scoreSourceId);
    error ScoreSourceRuleAlreadyExists(bytes32 universityKey, bytes32 scoreSourceId, bytes32 existingSchoolId);
    error NullifierAlreadyUsed(bytes32 schoolId, uint256 nullifierHash);
    error Unauthorized(address caller);
    error InvalidProof();
    error StudentAlreadyApplied(address student, bytes32 submittedSchoolId);
    error StudentAlreadyAdmitted(address student, bytes32 admittedSchoolId);
    error ApplicationAlreadySubmitted(bytes32 schoolId, address applicant);
    error ApplicationNotFound(bytes32 schoolId, address applicant);
    error ApplicationNotPending(bytes32 schoolId, address applicant, uint8 currentStatus);

    uint256 internal constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    struct SchoolConfig {
        /// @notice 规则唯一标识；在当前项目里等价于“某所大学的某一轮申请规则”。
        bytes32 schoolId;
        /// @notice 对应大学家族键，用来约束只有本校管理员才能管理这条规则。
        bytes32 universityKey;
        string schoolName;
        /// @notice 这条规则绑定的成绩源编号，确保学生证明和大学规则引用的是同一届成绩。
        bytes32 scoreSourceId;
        uint32 cutoffScore;
        uint64 updatedAt;
        address admin;
        bool active;
        bool cutoffFrozen;
    }

    enum ApplicationStatus {
        None,
        Pending,
        Rejected,
        Approved
    }

    struct ApplicationRecord {
        bytes32 schoolId;
        address applicant;
        uint256 nullifierHash;
        uint64 submittedAt;
        uint64 decidedAt;
        ApplicationStatus status;
    }

    struct AdmissionRecord {
        bytes32 schoolId;
        uint64 admittedAt;
        bool admitted;
    }

    struct StudentApplicationLock {
        /// @notice 当前学生第一次成功提交申请时锁定的学校规则。
        bytes32 schoolId;
        uint64 submittedAt;
        /// @notice 提交即永久锁定；拒绝不会解除这把锁。
        bool locked;
    }

    IAdmissionRoleRegistry public immutable roleRegistry;
    IScoreRootRegistry public immutable scoreRootRegistry;
    IUniversityCutoffProofVerifier public immutable verifier;

    mapping(bytes32 => SchoolConfig) private s_schools;
    mapping(bytes32 => mapping(address => ApplicationRecord)) private s_applications;
    mapping(address => AdmissionRecord) private s_admissions;
    mapping(address => StudentApplicationLock) private s_studentApplicationLocks;
    mapping(bytes32 => mapping(bytes32 => bytes32)) private s_schoolIdBySource;
    mapping(bytes32 => address[]) private s_schoolApplicants;
    mapping(bytes32 => mapping(address => bool)) private s_hasSchoolApplicant;
    mapping(bytes32 => mapping(uint256 => bool)) public usedNullifiers;

    event SchoolCreated(
        bytes32 indexed schoolId,
        bytes32 indexed universityKey,
        string schoolName,
        bytes32 scoreSourceId,
        uint32 cutoffScore,
        address indexed admin
    );
    event SchoolConfigUpdated(bytes32 indexed schoolId, uint32 cutoffScore, bool active);
    event ApplicationSubmitted(bytes32 indexed schoolId, address indexed applicant, uint256 nullifierHash);
    event ApplicationApproved(bytes32 indexed schoolId, address indexed applicant, uint64 approvedAt);
    event ApplicationRejected(bytes32 indexed schoolId, address indexed applicant, uint64 rejectedAt);

    /// @param scoreRootRegistryAddress 成绩源登记合约地址。
    /// @param verifierAddress Groth16 验证器地址。
    /// @param roleRegistryAddress 角色白名单合约地址。
    constructor(address scoreRootRegistryAddress, address verifierAddress, address roleRegistryAddress) {
        if (scoreRootRegistryAddress == address(0) || verifierAddress == address(0) || roleRegistryAddress == address(0)) {
            revert ZeroAddress();
        }
        roleRegistry = IAdmissionRoleRegistry(roleRegistryAddress);
        scoreRootRegistry = IScoreRootRegistry(scoreRootRegistryAddress);
        verifier = IUniversityCutoffProofVerifier(verifierAddress);
    }

    /// @notice 创建新的学校申请规则。
    /// @dev 当前版本采用“新 schoolId = 新申请规则版本”的建模方式，因此既有 schoolId 永远不可复用。
    function createSchool(
        bytes32 universityKey,
        bytes32 schoolId,
        string calldata schoolName,
        bytes32 scoreSourceId,
        uint32 cutoffScore
    ) external {
        bytes32 callerUniversityKey = roleRegistry.getUniversityKeyByAdmin(msg.sender);
        // 只有被考试院登记过的大学管理员，才能代表本校创建申请规则。
        if (callerUniversityKey == bytes32(0) || callerUniversityKey != universityKey) {
            revert Unauthorized(msg.sender);
        }
        if (s_schools[schoolId].admin != address(0)) {
            revert SchoolAlreadyExists(schoolId);
        }
        bytes32 existingSchoolId = s_schoolIdBySource[universityKey][scoreSourceId];
        if (existingSchoolId != bytes32(0)) {
            revert ScoreSourceRuleAlreadyExists(universityKey, scoreSourceId, existingSchoolId);
        }

        IScoreRootRegistry.ScoreSource memory scoreSource = scoreRootRegistry.getScoreSource(scoreSourceId);
        if (cutoffScore == 0 || cutoffScore > scoreSource.maxScore) {
            revert InvalidCutoffScore(cutoffScore, scoreSource.maxScore);
        }

        s_schools[schoolId] = SchoolConfig({
            schoolId: schoolId,
            universityKey: universityKey,
            schoolName: schoolName,
            scoreSourceId: scoreSourceId,
            cutoffScore: cutoffScore,
            updatedAt: uint64(block.timestamp),
            admin: msg.sender,
            active: false,
            cutoffFrozen: false
        });
        s_schoolIdBySource[universityKey][scoreSourceId] = schoolId;

        emit SchoolCreated(schoolId, universityKey, schoolName, scoreSourceId, cutoffScore, msg.sender);
    }

    /// @notice 当前版本不允许修改已创建规则的录取线。
    /// @dev 每次考试院发布一版成绩后，大学只能基于该成绩源提交一条规则；如需新规则，必须等待新的成绩源。
    function updateSchoolCutoff(bytes32 schoolId, uint32 cutoffScore) external view {
        SchoolConfig memory school = _getSchool(schoolId);
        if (school.admin != msg.sender || roleRegistry.getUniversityKeyByAdmin(msg.sender) != school.universityKey) {
            revert Unauthorized(msg.sender);
        }
        cutoffScore;
        revert SchoolCutoffLocked(schoolId);
    }

    /// @notice 调整学校规则状态。
    /// @dev 当 active 被置为 true 时，同时把 cutoffFrozen 锁死，确保进入开放申请后规则不再漂移。
    function setSchoolStatus(bytes32 schoolId, bool active) external {
        SchoolConfig storage school = _getSchoolStorage(schoolId);
        if (school.admin != msg.sender || roleRegistry.getUniversityKeyByAdmin(msg.sender) != school.universityKey) {
            revert Unauthorized(msg.sender);
        }

        if (active) {
            school.cutoffFrozen = true;
        }
        school.active = active;
        school.updatedAt = uint64(block.timestamp);
        emit SchoolConfigUpdated(schoolId, school.cutoffScore, active);
    }

    /// @notice 读取学校申请规则。
    function getSchool(bytes32 schoolId) external view returns (SchoolConfig memory) {
        SchoolConfig memory school = s_schools[schoolId];
        if (school.admin == address(0)) {
            revert SchoolNotFound(schoolId);
        }
        return school;
    }

    /// @notice 查询某所大学在某个成绩源下是否已经提交过申请规则。
    function getSchoolIdByScoreSource(bytes32 universityKey, bytes32 scoreSourceId) external view returns (bytes32) {
        return s_schoolIdBySource[universityKey][scoreSourceId];
    }

    /// @notice 验证学生申请凭证并创建待大学审批的申请记录。
    /// @dev 该函数只接受已经开放的申请规则，防止学生基于未定稿规则提交申请。
    function submitApplication(
        bytes32 schoolId,
        uint256 nullifierHash,
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c
    ) external {
        SchoolConfig memory school = _getSchool(schoolId);
        StudentApplicationLock memory studentLock = s_studentApplicationLocks[msg.sender];
        if (studentLock.locked) {
            revert StudentAlreadyApplied(msg.sender, studentLock.schoolId);
        }
        AdmissionRecord memory existingAdmission = s_admissions[msg.sender];
        if (existingAdmission.admitted) {
            revert StudentAlreadyAdmitted(msg.sender, existingAdmission.schoolId);
        }
        if (!school.active) {
            revert SchoolInactive(schoolId);
        }

        IScoreRootRegistry.ScoreSource memory scoreSource = scoreRootRegistry.getScoreSource(school.scoreSourceId);
        if (!scoreSource.active) {
            revert ScoreSourceInactive(school.scoreSourceId);
        }
        if (school.cutoffScore == 0 || school.cutoffScore > scoreSource.maxScore) {
            revert InvalidCutoffScore(school.cutoffScore, scoreSource.maxScore);
        }
        // nullifier 绑定学校、学生和成绩源，用来阻止同一轮申请被重复提交。
        if (usedNullifiers[schoolId][nullifierHash]) {
            revert NullifierAlreadyUsed(schoolId, nullifierHash);
        }

        uint256[6] memory publicSignals = _buildPublicSignals(
            schoolId,
            school.scoreSourceId,
            scoreSource.merkleRoot,
            school.cutoffScore,
            msg.sender,
            nullifierHash
        );

        bool verified = verifier.verifyProof(a, b, c, publicSignals);
        if (!verified) {
            revert InvalidProof();
        }

        usedNullifiers[schoolId][nullifierHash] = true;
        s_applications[schoolId][msg.sender] = ApplicationRecord({
            schoolId: schoolId,
            applicant: msg.sender,
            nullifierHash: nullifierHash,
            submittedAt: uint64(block.timestamp),
            decidedAt: 0,
            status: ApplicationStatus.Pending
        });
        s_studentApplicationLocks[msg.sender] =
            StudentApplicationLock({ schoolId: schoolId, submittedAt: uint64(block.timestamp), locked: true });
        if (!s_hasSchoolApplicant[schoolId][msg.sender]) {
            s_hasSchoolApplicant[schoolId][msg.sender] = true;
            s_schoolApplicants[schoolId].push(msg.sender);
        }

        emit ApplicationSubmitted(schoolId, msg.sender, nullifierHash);
    }

    /// @notice 大学管理员批准一条待处理申请，并为学生写入全局录取状态。
    function approveApplication(bytes32 schoolId, address applicant) external {
        SchoolConfig memory school = _getSchool(schoolId);
        _assertSchoolAdmin(school, msg.sender);

        ApplicationRecord storage application = _getApplicationStorage(schoolId, applicant);
        if (application.status != ApplicationStatus.Pending) {
            revert ApplicationNotPending(schoolId, applicant, uint8(application.status));
        }

        AdmissionRecord storage admission = s_admissions[applicant];
        if (admission.admitted) {
            revert StudentAlreadyAdmitted(applicant, admission.schoolId);
        }

        // 批准动作同时写申请状态和全局录取状态，
        // 这样学生首页与大学审批页都能围绕同一份链上真相做展示。
        uint64 decidedAt = uint64(block.timestamp);
        application.status = ApplicationStatus.Approved;
        application.decidedAt = decidedAt;
        s_admissions[applicant] = AdmissionRecord({ schoolId: schoolId, admittedAt: decidedAt, admitted: true });

        emit ApplicationApproved(schoolId, applicant, decidedAt);
    }

    /// @notice 大学管理员拒绝一条待处理申请。
    function rejectApplication(bytes32 schoolId, address applicant) external {
        SchoolConfig memory school = _getSchool(schoolId);
        _assertSchoolAdmin(school, msg.sender);

        ApplicationRecord storage application = _getApplicationStorage(schoolId, applicant);
        if (application.status != ApplicationStatus.Pending) {
            revert ApplicationNotPending(schoolId, applicant, uint8(application.status));
        }

        uint64 decidedAt = uint64(block.timestamp);
        application.status = ApplicationStatus.Rejected;
        application.decidedAt = decidedAt;

        emit ApplicationRejected(schoolId, applicant, decidedAt);
    }

    /// @notice 读取指定学校下某位学生的申请状态。
    function getApplication(bytes32 schoolId, address applicant) external view returns (ApplicationRecord memory) {
        return _getApplication(schoolId, applicant);
    }

    /// @notice 读取某位学生当前的全局录取状态。
    function getAdmission(address student) external view returns (AdmissionRecord memory) {
        return s_admissions[student];
    }

    /// @notice 读取某位学生当前是否已经提交过链上申请。
    function getStudentApplication(
        address student
    ) external view returns (ApplicationRecord memory application, bool exists) {
        StudentApplicationLock memory studentLock = s_studentApplicationLocks[student];
        // 这里显式返回“空记录 + exists=false”，让前端能稳定地区分“没有申请”和“读取失败”。
        if (!studentLock.locked) {
            return (
                ApplicationRecord({
                    schoolId: bytes32(0),
                    applicant: address(0),
                    nullifierHash: 0,
                    submittedAt: 0,
                    decidedAt: 0,
                    status: ApplicationStatus.None
                }),
                false
            );
        }

        application = _getApplication(studentLock.schoolId, student);
        exists = true;
    }

    /// @notice 读取某个学校规则下的全部申请人列表。
    function getSchoolApplicants(bytes32 schoolId) external view returns (address[] memory) {
        return s_schoolApplicants[schoolId];
    }

    /// @dev 按电路要求拼装公共输入，顺序必须与 circom 电路和 verifier 严格一致。
    function _buildPublicSignals(
        bytes32 schoolId,
        bytes32 scoreSourceId,
        uint256 merkleRoot,
        uint32 cutoffScore,
        address recipient,
        uint256 nullifierHash
    ) internal pure returns (uint256[6] memory publicSignals) {
        publicSignals[0] = merkleRoot;
        publicSignals[1] = uint256(scoreSourceId) % SNARK_SCALAR_FIELD;
        publicSignals[2] = uint256(schoolId) % SNARK_SCALAR_FIELD;
        publicSignals[3] = uint256(cutoffScore);
        publicSignals[4] = uint256(uint160(recipient));
        publicSignals[5] = nullifierHash;
    }

    /// @dev 返回内存副本给外部调用方，避免误暴露 storage 引用语义。
    function _getSchool(bytes32 schoolId) private view returns (SchoolConfig memory school) {
        school = s_schools[schoolId];
        if (school.admin == address(0)) {
            revert SchoolNotFound(schoolId);
        }
    }

    /// @dev 读取申请记录时统一做存在性校验，避免默认零值被误判成有效申请。
    function _getApplication(bytes32 schoolId, address applicant) private view returns (ApplicationRecord memory application) {
        application = s_applications[schoolId][applicant];
        if (application.status == ApplicationStatus.None) {
            revert ApplicationNotFound(schoolId, applicant);
        }
    }

    /// @dev 所有审批入口都从 storage 版本读取申请，保证不存在记录时行为一致。
    function _getApplicationStorage(
        bytes32 schoolId,
        address applicant
    ) private view returns (ApplicationRecord storage application) {
        application = s_applications[schoolId][applicant];
        if (application.status == ApplicationStatus.None) {
            revert ApplicationNotFound(schoolId, applicant);
        }
    }

    /// @dev 所有可变入口统一经过 storage 版本读取，保证存在性校验行为一致。
    function _getSchoolStorage(bytes32 schoolId) private view returns (SchoolConfig storage school) {
        school = s_schools[schoolId];
        if (school.admin == address(0)) {
            revert SchoolNotFound(schoolId);
        }
    }

    /// @dev 审批动作必须由对应学校管理员发起，并且角色白名单仍能映射回同一所大学。
    function _assertSchoolAdmin(SchoolConfig memory school, address caller) private view {
        if (school.admin != caller || roleRegistry.getUniversityKeyByAdmin(caller) != school.universityKey) {
            revert Unauthorized(caller);
        }
    }
}
