// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "./RevenueBatchRegistry.sol";
import "./common/Owned.sol";
import "./common/MerkleProofLib.sol";

contract CreatorRevenueDistributor is Owned {
    /**
     * 这份合约只负责“合法领取包 -> 一次 claim -> 同笔自动分账”。
     * 它不维护批次状态本身，而是依赖 RevenueBatchRegistry 提供当前批次快照，
     * 从而把“是否可领取”和“钱怎么发出去”拆成两层职责。
     */
    error InvalidRegistry();
    error ReentrancyGuarded();
    error CreatorOnly();
    error ClaimAlreadyUsed();
    error InvalidAmount();
    error InvalidSplit();
    error BatchNotActive();
    error NativeEthOnly();
    error InsufficientLiquidity();
    error InvalidProof();
    error InvalidRecipient();
    error InvalidBpsTotal();
    error TransferFailed();
    error InvalidFundingAmount();
    error BatchAlreadyActivated();
    error DirectFundingDisabled();

    RevenueBatchRegistry public immutable batchRegistry;
    mapping(bytes32 batchId => mapping(bytes32 claimId => bool)) public isClaimed;
    mapping(bytes32 batchId => bool) public isBatchActivated;
    uint256 private locked = 1;

    event ClaimProcessed(
        bytes32 indexed batchId,
        bytes32 indexed claimId,
        address indexed creator,
        address token,
        uint256 grossAmount
    );
    event SplitPaid(
        bytes32 indexed batchId,
        bytes32 indexed claimId,
        address indexed recipient,
        uint256 amount,
        uint16 bps,
        bool isCreator
    );
    /**
     * 构造时只固定两件事：
     * 1. 这份分账执行器由谁拥有；
     * 2. 它后续应该信任哪一个批次注册表作为“当前批次状态”的来源。
     * registry 被设成 immutable，是因为部署后这层信任边界不应再漂移。
     */
    constructor(address initialOwner, address registryAddress) Owned(initialOwner) {
        if (registryAddress == address(0)) revert InvalidRegistry();
        batchRegistry = RevenueBatchRegistry(registryAddress);
    }

    /**
     * claim 会在一笔交易里连续做 proof 校验、状态落账和多次转账，
     * 因此这里用最小化的互斥锁阻断重入，避免外部 recipient 在 receive/fallback
     * 中回调 claim 导致同一条领取包被重复消费。
     */
    modifier nonReentrant() {
        if (locked != 1) revert ReentrancyGuarded();
        locked = 2;
        _;
        locked = 1;
    }

    /**
     * 当前版本不再接受平台“先打钱、后发布”的裸充值流程。
     * 所有月度资金都必须跟随 activateBatchWithFunding 一起进入合约，
     * 这样才能保证同一月份只录入一次，也避免后续补资打乱演示语义。
     */
    receive() external payable {
        revert DirectFundingDisabled();
    }

    /**
     * 单笔激活会把“发布批次 + 注入等额资金”合并到同一笔交易：
     * - 月份只能激活一次；
     * - msg.value 必须和 grossAmount 完全一致；
     * - 资金会随着这笔交易原子进入分账执行器，后续不再接受补资。
     */
    function activateBatchWithFunding(
        bytes32 batchId,
        bytes32 merkleRoot,
        bytes32 metadataHash,
        bytes32 claimId,
        string calldata monthLabel,
        string calldata billId,
        uint256 grossAmount,
        address creator
    ) external payable onlyOwner nonReentrant {
        if (grossAmount == 0 || msg.value != grossAmount) revert InvalidFundingAmount();
        if (isBatchActivated[batchId]) revert BatchAlreadyActivated();

        batchRegistry.publishBatchWithContext(
            batchId,
            address(0),
            merkleRoot,
            metadataHash,
            claimId,
            monthLabel,
            billId,
            grossAmount,
            creator
        );

        isBatchActivated[batchId] = true;
    }

    /**
     * 创作者领取当前批次里的一条合法领取包，并在同一笔交易内完成自动分账。
     * 这笔交易验证的不是“原始账单文案”，而是一个已经被平台结算并压缩进 merkleRoot 的 claim package：
     * 1. 当前调用者确实是这条领取包对应的 creator；
     * 2. 这条 claimId 在当前 batch 下尚未被使用；
     * 3. (batchId, claimId, creator, grossAmount, recipients, bps) 这组数据确实属于当前已发布批次；
     * 4. 合约余额足够把 grossAmount 完整拆给创作者和协作者。
     * @param batchId 当前结算批次标识，决定这条领取包应该去哪个批次根上验真。
     * @param claimId 当前创作者在该批次内的唯一领取标识，用来防重复领取。
     * @param creator 这条领取包绑定的创作者地址，也必须等于 msg.sender。
     * @param grossAmount 这次领取对应的税前总额，也是后续分账计算的基数。
     * @param recipients 参与分账的全部收款地址，通常包括创作者本人和若干协作者。
     * @param bps 每个收款地址对应的分账比例，单位是 basis points，整组必须严格等于 10_000。
     * @param merkleProof 用来证明这条领取包属于当前已发布批次的 merkle 树证明路径。
     */
    function claim(
        bytes32 batchId,
        bytes32 claimId,
        address creator,
        uint256 grossAmount,
        address[] calldata recipients,
        uint16[] calldata bps,
        bytes32[] calldata merkleProof
    ) external nonReentrant {
        uint256 recipientCount = recipients.length;
        if (msg.sender != creator) revert CreatorOnly();
        if (isClaimed[batchId][claimId]) revert ClaimAlreadyUsed();
        if (grossAmount == 0) revert InvalidAmount();
        if (recipientCount == 0 || recipientCount != bps.length) revert InvalidSplit();

        // 批次快照只暴露领取主路径真正需要的最小字段：
        // 当前教学版只接受 Published 状态，且只允许原生 ETH 分账。
        (address token, bytes32 merkleRoot, RevenueBatchRegistry.BatchStatus status) = batchRegistry.getBatchSnapshot(batchId);
        if (status != RevenueBatchRegistry.BatchStatus.Published) revert BatchNotActive();
        if (token != address(0)) revert NativeEthOnly();
        if (address(this).balance < grossAmount) revert InsufficientLiquidity();

        // 叶子不是“账单文案”，而是当前批次中的一条合法领取包。
        // merkleProof 验证通过，才说明这次 claim 的金额、收款人和分账比例
        // 都与平台发布批次时承诺的最终结算结果一致。
        bytes32 leaf = keccak256(abi.encode(batchId, claimId, creator, grossAmount, recipients, bps));
        if (!MerkleProofLib.verify(merkleProof, merkleRoot, leaf)) revert InvalidProof();

        uint256 bpsTotal;
        uint256 distributed;
        isClaimed[batchId][claimId] = true;

        for (uint256 index = 0; index < recipientCount;) {
            address recipient = recipients[index];
            uint16 splitBps = bps[index];
            if (recipient == address(0)) revert InvalidRecipient();
            bpsTotal += splitBps;

            // 最后一个收款人承担尾差，避免整数除法导致分账总额小于 grossAmount。
            uint256 amount = index == recipientCount - 1
                ? grossAmount - distributed
                : (grossAmount * splitBps) / 10_000;

            distributed += amount;
            (bool ok,) = recipient.call{value: amount}("");
            if (!ok) revert TransferFailed();

            // SplitPaid 既是协作者到账记录，也是后端 / indexer 构建流水与汇总的基础事件。
            emit SplitPaid(batchId, claimId, recipient, amount, splitBps, recipient == creator);

            unchecked {
                ++index;
            }
        }

        // bps 总和必须严格等于 100%，否则说明这份分账快照本身不自洽。
        if (bpsTotal != 10_000) revert InvalidBpsTotal();

        // ClaimProcessed 代表“本条领取包已经完整消费成功”，适合构建创作者历史主记录。
        emit ClaimProcessed(batchId, claimId, creator, token, grossAmount);
    }
}
