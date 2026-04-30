// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "./common/Owned.sol";

contract RevenueBatchRegistry is Owned {
    /**
     * 这份合约只负责“当前结算批次是否可领取”这一层真值，不直接处理创作者 claim
     * 或分账打款。项目把批次状态机和资金执行器拆开，是为了让平台运营动作
     * （发布 / 暂停 / 关闭）与创作者领取逻辑保持解耦。
     */
    error InvalidBatch();
    error NativeEthOnly();
    error InvalidRoot();
    error BatchNotPublished();
    error BatchNotPaused();
    error BatchMissing();
    error BatchAlreadyClosed();
    error BatchAlreadyInitialized();
    error UnauthorizedPublisher();
    error InvalidPublishOperator();

    /// Unknown 表示链上还不存在该批次；Draft 只作为前端 / 服务端草稿语义保留。
    enum BatchStatus {
        Unknown,
        Draft,
        Published,
        Paused,
        Closed
    }

    struct Batch {
        bytes32 batchId;
        bytes32 merkleRoot;
        bytes32 metadataHash;
        address token;
        uint64 publishedAt;
        uint64 updatedAt;
        BatchStatus status;
    }

    mapping(bytes32 batchId => Batch) private batches;
    address public publishOperator;

    event BatchPublished(
        bytes32 indexed batchId,
        address indexed token,
        bytes32 merkleRoot,
        bytes32 metadataHash,
        uint64 publishedAt
    );
    event BatchContextCommitted(
        bytes32 indexed batchId,
        bytes32 indexed claimId,
        string monthLabel,
        string billId,
        uint256 grossAmount,
        address creator,
        uint64 committedAt
    );
    event PublishOperatorUpdated(address indexed previousOperator, address indexed nextOperator);
    event BatchPaused(bytes32 indexed batchId, uint64 updatedAt);
    event BatchResumed(bytes32 indexed batchId, uint64 updatedAt);
    event BatchClosed(bytes32 indexed batchId, uint64 updatedAt);

    modifier onlyPublisher() {
        if (msg.sender != owner && msg.sender != publishOperator) revert UnauthorizedPublisher();
        _;
    }

    /**
     * 批次注册表只需要平台 owner 这一层权限边界。
     * 后续所有 publish / pause / close 都围绕这个 owner 展开，不把领取逻辑混进来。
     */
    constructor(address initialOwner) Owned(initialOwner) {}

    /**
     * 平台发布批次时，只把当前月度结算结果的最小摘要写到链上：
     * batchId 标识当前月份，merkleRoot 约束可领取包集合，metadataHash 作为扩展锚点。
     * 当前教学版仅支持原生 ETH，因此 token 必须是 address(0)。
     */
    function setPublishOperator(address nextOperator) external onlyOwner {
        if (nextOperator == address(0)) revert InvalidPublishOperator();
        address previousOperator = publishOperator;
        publishOperator = nextOperator;
        emit PublishOperatorUpdated(previousOperator, nextOperator);
    }

    function publishBatch(bytes32 batchId, address token, bytes32 merkleRoot, bytes32 metadataHash) external onlyPublisher {
        _publishBatch(batchId, token, merkleRoot, metadataHash);
    }

    /**
     * publishBatchWithContext 在兼容旧 publishBatch 的基础上，额外把这次发布对应的
     * 业务上下文（claimId / monthLabel / billId / grossAmount / creator）写成链上事件。
     * 这样 indexer 和审计端可以直接复用链上留痕，而不再只依赖前端本地上下文。
     */
    function publishBatchWithContext(
        bytes32 batchId,
        address token,
        bytes32 merkleRoot,
        bytes32 metadataHash,
        bytes32 claimId,
        string calldata monthLabel,
        string calldata billId,
        uint256 grossAmount,
        address creator
    ) external onlyPublisher {
        _publishBatch(batchId, token, merkleRoot, metadataHash);

        emit BatchContextCommitted(
            batchId,
            claimId,
            monthLabel,
            billId,
            grossAmount,
            creator,
            uint64(block.timestamp)
        );
    }

    function _publishBatch(bytes32 batchId, address token, bytes32 merkleRoot, bytes32 metadataHash) internal {
        if (batchId == bytes32(0)) revert InvalidBatch();
        if (token != address(0)) revert NativeEthOnly();
        if (merkleRoot == bytes32(0)) revert InvalidRoot();

        Batch storage batch = batches[batchId];
        if (batch.publishedAt != 0) revert BatchAlreadyInitialized();
        uint64 timestamp = uint64(block.timestamp);

        batch.batchId = batchId;
        batch.token = token;
        batch.merkleRoot = merkleRoot;
        batch.metadataHash = metadataHash;
        batch.status = BatchStatus.Published;
        batch.updatedAt = timestamp;

        if (batch.publishedAt == 0) {
            batch.publishedAt = timestamp;
        }

        emit BatchPublished(batchId, token, merkleRoot, metadataHash, batch.publishedAt);
    }

    /**
     * 暂停是平台的“临时刹车”动作：
     * 链上仍保留这期批次和 merkleRoot，但新 claim 会被阻断，
     * 适合发现配置问题、资金问题或需要人工回查时先止损。
     */
    function pauseBatch(bytes32 batchId) external onlyOwner {
        Batch storage batch = batches[batchId];
        if (batch.status != BatchStatus.Published) revert BatchNotPublished();
        batch.status = BatchStatus.Paused;
        batch.updatedAt = uint64(block.timestamp);
        emit BatchPaused(batchId, batch.updatedAt);
    }

    /**
     * resume 只恢复已暂停批次的领取能力，不接受新的 merkleRoot 或上下文。
     * 这样可以保住“同一月份只能激活一次”的前提，同时保留平台临时暂停后的恢复能力。
     */
    function resumeBatch(bytes32 batchId) external onlyOwner {
        Batch storage batch = batches[batchId];
        if (batch.status == BatchStatus.Unknown) revert BatchMissing();
        if (batch.status != BatchStatus.Paused) revert BatchNotPaused();
        batch.status = BatchStatus.Published;
        batch.updatedAt = uint64(block.timestamp);
        emit BatchResumed(batchId, batch.updatedAt);
    }

    /**
     * 关闭代表这期批次进入最终只读状态。
     * 和 pause 不同，close 表示平台不打算再恢复该批次的 claim 能力，
     * 适合结算窗口结束后的归档语义。
     */
    function closeBatch(bytes32 batchId) external onlyOwner {
        Batch storage batch = batches[batchId];
        if (batch.status == BatchStatus.Unknown) revert BatchMissing();
        if (batch.status == BatchStatus.Closed) revert BatchAlreadyClosed();
        batch.status = BatchStatus.Closed;
        batch.updatedAt = uint64(block.timestamp);
        emit BatchClosed(batchId, batch.updatedAt);
    }

    /**
     * 这个完整 getter 主要服务管理端排查、测试断言和需要全部批次元数据的读取方。
     * 领取主路径不会走它，因为 claim 只依赖更窄的 getBatchSnapshot。
     */
    function getBatch(bytes32 batchId) external view returns (Batch memory) {
        return batches[batchId];
    }

    /**
     * claim 主路径只需要 token / merkleRoot / status 这三个字段，
     * 不必为每次领取都把完整 Batch 结构体搬出来。
     * 这个窄 getter 可以减少读取成本，也让“批次状态机”和“领取执行器”的依赖更清晰。
     */
    function getBatchSnapshot(bytes32 batchId) external view returns (address token, bytes32 merkleRoot, BatchStatus status) {
        Batch storage batch = batches[batchId];
        return (batch.token, batch.merkleRoot, batch.status);
    }

    /**
     * 对前端和脚本来说，很多时候只关心“现在还能不能 claim”，
     * 不需要知道完整状态细节，因此这里提供一个最直白的布尔读口。
     */
    function isBatchClaimable(bytes32 batchId) external view returns (bool) {
        return batches[batchId].status == BatchStatus.Published;
    }
}
