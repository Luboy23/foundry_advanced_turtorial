// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { IBenefitRoleRegistry } from "./interfaces/IBenefitRoleRegistry.sol";
import { IUnemploymentCredentialRootRegistry } from "./interfaces/IUnemploymentCredentialRootRegistry.sol";
import { IUnemploymentBenefitProofVerifier } from "./interfaces/IUnemploymentBenefitProofVerifier.sol";

/// @title 失业一次性补助发放合约
/// @notice 发放机构向补助池充值并开启项目，申请人通过一次 zk 交易完成验证与领款。
/// @dev 合约把“角色校验、名单版本校验、proof 校验、nullifier 防重放、资金结算”收敛在同一笔交易里。
contract UnemploymentBenefitDistributor {
    error ZeroAddress();
    error ZeroProgramId();
    error InvalidBenefitAmount(uint256 amountWei);
    error Unauthorized(address caller);
    error ProgramInactive(bytes32 programId);
    error CredentialSetInactive(bytes32 setId);
    error CredentialSetMismatch(uint256 expectedRoot, uint256 providedRoot);
    error ProgramMismatch(uint256 expectedProgramIdField, uint256 providedProgramIdField);
    error RecipientMismatch(address recipient, uint256 providedRecipientField);
    error NullifierAlreadyUsed(bytes32 nullifierHash);
    error BenefitAlreadyClaimed(address recipient);
    error InvalidProof();
    error InsufficientPoolBalance(uint256 available, uint256 requiredAmount);
    error TransferFailed();

    uint256 private constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    /// @notice 补助项目的链上配置和累计统计。
    /// @dev programIdField 会作为 zk 电路公开输入参与约束，避免证明被挪到别的项目复用。
    struct BenefitProgram {
        bytes32 programId;
        uint256 programIdField;
        uint256 amountWei;
        bool active;
        uint64 updatedAt;
        uint64 totalClaims;
        uint256 totalDisbursedWei;
    }

    IBenefitRoleRegistry public immutable roleRegistry;
    IUnemploymentCredentialRootRegistry public immutable rootRegistry;
    IUnemploymentBenefitProofVerifier public immutable verifier;

    BenefitProgram private s_program;
    mapping(bytes32 => bool) private s_usedNullifiers;
    mapping(address => bool) private s_claimedRecipients;

    event BenefitPoolFunded(address indexed agency, uint256 amountWei, uint256 newBalance);
    event ProgramStatusUpdated(bytes32 indexed programId, bool active);
    event BenefitDisbursed(
        bytes32 indexed programId,
        address indexed recipient,
        bytes32 indexed nullifierHash,
        uint256 amountWei,
        uint32 rootVersion
    );

    /// @notice 初始化角色登记、名单登记、proof verifier 和固定补助项目。
    /// @param roleRegistryAddress 角色登记合约地址。
    /// @param rootRegistryAddress 当前资格名单登记合约地址。
    /// @param verifierAddress zk proof verifier 地址。
    /// @param programId 补助项目标识。
    /// @param programIdField 电路中使用的项目字段值。
    /// @param amountWei 单次补助金额。
    constructor(
        address roleRegistryAddress,
        address rootRegistryAddress,
        address verifierAddress,
        bytes32 programId,
        uint256 programIdField,
        uint256 amountWei
    ) {
        if (roleRegistryAddress == address(0) || rootRegistryAddress == address(0) || verifierAddress == address(0)) {
            revert ZeroAddress();
        }
        if (programId == bytes32(0)) {
            revert ZeroProgramId();
        }
        if (amountWei == 0) {
            revert InvalidBenefitAmount(amountWei);
        }

        roleRegistry = IBenefitRoleRegistry(roleRegistryAddress);
        rootRegistry = IUnemploymentCredentialRootRegistry(rootRegistryAddress);
        verifier = IUnemploymentBenefitProofVerifier(verifierAddress);
        s_program = BenefitProgram({
            programId: programId,
            programIdField: programIdField,
            amountWei: amountWei,
            active: false,
            updatedAt: uint64(block.timestamp),
            totalClaims: 0,
            totalDisbursedWei: 0
        });
    }

    /// @notice 限制只有发放机构才能调整资金池与项目开关。
    modifier onlyAgency() {
        if (!roleRegistry.isAgency(msg.sender)) {
            revert Unauthorized(msg.sender);
        }
        _;
    }

    /// @notice 读取当前补助项目配置。
    /// @return 当前项目结构体。
    function getProgram() external view returns (BenefitProgram memory) {
        return s_program;
    }

    /// @notice 读取当前合约持有的可发放余额。
    /// @return 当前补助池余额。
    function getProgramBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice 判断某地址是否已经成功领取过补助。
    /// @param account 目标申请地址。
    /// @return 是否已领取。
    function hasClaimed(address account) external view returns (bool) {
        return s_claimedRecipients[account];
    }

    /// @notice 判断某个 nullifier 是否已经被消费。
    /// @param nullifierHash 证明中导出的 nullifier。
    /// @return 是否已被使用。
    function isNullifierUsed(bytes32 nullifierHash) external view returns (bool) {
        return s_usedNullifiers[nullifierHash];
    }

    /// @notice 由发放机构向补助池注资。
    /// @dev 充值和 receive 都会触发同一个事件，方便前端只维护一套资金变更展示逻辑。
    function fundProgram() external payable onlyAgency {
        if (msg.value == 0) {
            revert InvalidBenefitAmount(msg.value);
        }

        emit BenefitPoolFunded(msg.sender, msg.value, address(this).balance);
    }

    /// @notice 开启或暂停补助项目。
    /// @param active 项目是否允许新的领取请求进入结算。
    function setProgramActive(bool active) external onlyAgency {
        s_program.active = active;
        s_program.updatedAt = uint64(block.timestamp);
        emit ProgramStatusUpdated(s_program.programId, active);
    }

    /// @notice 校验证明并向申请人发放补助。
    /// @dev 这里遵循“先校验、再写状态、最后转账”的顺序，尽量降低脏写和重放风险。
    /// @param proofA Groth16 证明的 A 点。
    /// @param proofB Groth16 证明的 B 点。
    /// @param proofC Groth16 证明的 C 点。
    /// @param publicSignals 电路公开输入，包含名单摘要、项目字段、领取地址字段和 nullifier。
    function verifyAndDisburse(
        uint256[2] calldata proofA,
        uint256[2][2] calldata proofB,
        uint256[2] calldata proofC,
        uint256[4] calldata publicSignals
    ) external {
        if (!roleRegistry.isApplicant(msg.sender)) {
            revert Unauthorized(msg.sender);
        }

        BenefitProgram storage program = s_program;
        if (!program.active) {
            revert ProgramInactive(program.programId);
        }

        IUnemploymentCredentialRootRegistry.UnemploymentCredentialSet memory currentSet =
            rootRegistry.getCurrentCredentialSet();
        if (!currentSet.active) {
            revert CredentialSetInactive(currentSet.setId);
        }

        if (address(this).balance < program.amountWei) {
            revert InsufficientPoolBalance(address(this).balance, program.amountWei);
        }

        // 公开输入必须与当前链上名单、当前项目和当前调用账户同时一致，避免旧证明或错账户复用。
        uint256 expectedRecipientField = uint256(uint160(msg.sender)) % SNARK_SCALAR_FIELD;
        if (publicSignals[0] != currentSet.merkleRoot) {
            revert CredentialSetMismatch(currentSet.merkleRoot, publicSignals[0]);
        }
        if (publicSignals[1] != program.programIdField) {
            revert ProgramMismatch(program.programIdField, publicSignals[1]);
        }
        if (publicSignals[2] != expectedRecipientField) {
            revert RecipientMismatch(msg.sender, publicSignals[2]);
        }

        bytes32 nullifierHash = bytes32(publicSignals[3]);
        if (s_usedNullifiers[nullifierHash]) {
            revert NullifierAlreadyUsed(nullifierHash);
        }
        if (s_claimedRecipients[msg.sender]) {
            revert BenefitAlreadyClaimed(msg.sender);
        }

        bool verified = verifier.verifyProof(proofA, proofB, proofC, publicSignals);
        if (!verified) {
            revert InvalidProof();
        }

        // 证明通过后先落状态，再执行外部转账，避免重入或失败回滚前留下可重复领取窗口。
        s_usedNullifiers[nullifierHash] = true;
        s_claimedRecipients[msg.sender] = true;
        program.totalClaims += 1;
        program.totalDisbursedWei += program.amountWei;
        program.updatedAt = uint64(block.timestamp);

        (bool success,) = msg.sender.call{ value: program.amountWei }("");
        if (!success) {
            revert TransferFailed();
        }

        emit BenefitDisbursed(program.programId, msg.sender, nullifierHash, program.amountWei, currentSet.version);
    }

    /// @notice 兼容直接转账补充资金池。
    receive() external payable {
        emit BenefitPoolFunded(msg.sender, msg.value, address(this).balance);
    }
}
