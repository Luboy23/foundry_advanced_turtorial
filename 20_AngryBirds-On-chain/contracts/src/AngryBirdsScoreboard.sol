// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IAngryBirdsLevelCatalog {
    struct LevelConfig {
        bytes32 levelId;
        uint32 version;
        bytes32 contentHash;
        uint32 order;
        bool enabled;
    }

    function levelExists(bytes32 levelId, uint32 version) external view returns (bool);
    function isLevelEnabled(bytes32 levelId, uint32 version) external view returns (bool);
    function getLevel(bytes32 levelId, uint32 version) external view returns (LevelConfig memory);
}

contract AngryBirdsScoreboard {
    error DuplicateBatchId();
    error DuplicateRunId();
    error EmptyBatch();
    error InvalidBatchId();
    error InvalidBirdsUsed();
    error InvalidCatalogAddress();
    error InvalidDelegate();
    error InvalidDeploymentId();
    error InvalidDuration();
    error InvalidEvidenceHash();
    error InvalidLevelId();
    error InvalidLevelVersion();
    error InvalidOwner();
    error InvalidPermitWindow();
    error InvalidPlayer();
    error InvalidPlayerSignature();
    error InvalidRunId();
    error InvalidSessionId();
    error InvalidVerifier();
    error InvalidVerifierSignature();
    error LevelDisabled();
    error LevelNotFound();
    error MaxRunsExceeded();
    error SessionRevoked();
    error Unauthorized();

    struct RunResult {
        bytes32 levelId;
        uint32 levelVersion;
        uint8 birdsUsed;
        uint16 destroyedPigs;
        uint32 durationMs;
        bytes32 evidenceHash;
        uint64 submittedAt;
    }

    struct LeaderboardEntry {
        address player;
        RunResult result;
    }

    struct HistoryBuffer {
        uint32 head;
        uint32 count;
        mapping(uint32 => RunResult) entries;
    }

    struct SessionPermit {
        address player;
        address delegate;
        bytes32 sessionId;
        bytes32 deploymentIdHash;
        uint64 issuedAt;
        uint64 deadline;
        uint32 nonce;
        uint16 maxRuns;
    }

    struct VerifiedRun {
        bytes32 runId;
        bytes32 levelId;
        uint32 levelVersion;
        uint8 birdsUsed;
        uint16 destroyedPigs;
        uint32 durationMs;
        bytes32 evidenceHash;
    }

    struct SessionUsage {
        uint16 submittedRuns;
        bool revoked;
    }

    uint256 public constant MAX_LEADERBOARD_PER_LEVEL = 20;
    uint32 public constant MAX_HISTORY_PER_USER = 50;

    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        );
    bytes32 private constant SESSION_PERMIT_TYPEHASH =
        keccak256(
            "SessionPermit(address player,address delegate,bytes32 sessionId,bytes32 deploymentIdHash,uint64 issuedAt,uint64 deadline,uint32 nonce,uint16 maxRuns)"
        );
    bytes32 private constant VERIFIED_RUN_TYPEHASH =
        keccak256(
            "VerifiedRun(bytes32 runId,bytes32 levelId,uint32 levelVersion,uint8 birdsUsed,uint16 destroyedPigs,uint32 durationMs,bytes32 evidenceHash)"
        );
    bytes32 private constant VERIFIED_BATCH_TYPEHASH =
        keccak256(
            "VerifierBatch(address player,address delegate,bytes32 sessionId,uint32 nonce,bytes32 batchId,bytes32 runsHash)"
        );
    bytes32 private constant VERSION_HASH = keccak256("1");
    bytes32 private constant SESSION_PERMIT_NAME_HASH =
        keccak256("AngryBirdsSessionPermit");
    bytes32 private constant VERIFIED_BATCH_NAME_HASH =
        keccak256("AngryBirdsVerifiedBatch");

    IAngryBirdsLevelCatalog public immutable levelCatalog;
    bytes32 public immutable deploymentIdHash;

    address public owner;
    address public verifier;

    mapping(bytes32 => mapping(uint32 => LeaderboardEntry[])) private _leaderboards;
    LeaderboardEntry[] private _globalLeaderboard;
    mapping(address => HistoryBuffer) private _histories;
    mapping(address => RunResult) private _globalBest;
    mapping(address => bool) private _hasGlobalBest;
    mapping(address => uint256) private _globalLeaderboardIndexPlusOne;
    mapping(address => mapping(uint32 => SessionUsage)) private _sessionUsages;
    mapping(bytes32 => bool) private _recordedRuns;
    mapping(bytes32 => bool) private _recordedBatches;

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );
    event VerifierUpdated(
        address indexed previousVerifier,
        address indexed newVerifier
    );
    event RunSubmitted(
        address indexed player,
        bytes32 indexed levelId,
        uint32 indexed levelVersion,
        uint8 birdsUsed,
        uint16 destroyedPigs,
        uint32 durationMs,
        bytes32 evidenceHash
    );
    event GlobalBestUpdated(
        address indexed player,
        bytes32 indexed levelId,
        uint32 indexed levelVersion,
        uint8 birdsUsed,
        uint32 durationMs,
        bytes32 evidenceHash
    );
    event VerifiedBatchSubmitted(
        address indexed player,
        address indexed delegate,
        bytes32 indexed batchId,
        bytes32 sessionId,
        uint32 nonce,
        uint256 runCount
    );

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert Unauthorized();
        }
        _;
    }

    constructor(
        address levelCatalogAddress,
        address initialVerifier,
        string memory deploymentId
    ) {
        if (levelCatalogAddress == address(0)) {
            revert InvalidCatalogAddress();
        }
        if (initialVerifier == address(0)) {
            revert InvalidVerifier();
        }
        if (bytes(deploymentId).length == 0) {
            revert InvalidDeploymentId();
        }

        levelCatalog = IAngryBirdsLevelCatalog(levelCatalogAddress);
        deploymentIdHash = keccak256(bytes(deploymentId));
        owner = msg.sender;
        verifier = initialVerifier;

        emit OwnershipTransferred(address(0), msg.sender);
        emit VerifierUpdated(address(0), initialVerifier);
    }

    /// @notice 转移合约管理员权限。
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) {
            revert InvalidOwner();
        }

        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice 更新离线验证者地址（用于校验 verifier 批量签名）。
    function updateVerifier(address newVerifier) external onlyOwner {
        if (newVerifier == address(0)) {
            revert InvalidVerifier();
        }

        emit VerifierUpdated(verifier, newVerifier);
        verifier = newVerifier;
    }

    /// @notice 批量提交经离线验证的 run 结果，并一次性写入排行榜/历史记录。
    /// @dev 顺序执行：校验 permit -> 校验批次唯一性 -> 校验玩家签名 -> 校验 verifier 签名 -> 逐条落库。
    function submitVerifiedBatch(
        SessionPermit calldata permit,
        bytes calldata playerPermitSig,
        VerifiedRun[] calldata runs,
        bytes32 batchId,
        bytes calldata verifierSig
    ) external {
        if (permit.player == address(0)) {
            revert InvalidPlayer();
        }
        if (permit.delegate == address(0) || msg.sender != permit.delegate) {
            revert InvalidDelegate();
        }
        if (permit.sessionId == bytes32(0)) {
            revert InvalidSessionId();
        }
        if (permit.deploymentIdHash != deploymentIdHash) {
            revert InvalidDeploymentId();
        }
        if (
            permit.issuedAt > block.timestamp ||
            permit.deadline <= permit.issuedAt ||
            block.timestamp > permit.deadline
        ) {
            revert InvalidPermitWindow();
        }
        if (permit.maxRuns == 0) {
            revert MaxRunsExceeded();
        }
        if (runs.length == 0) {
            revert EmptyBatch();
        }
        if (_recordedBatches[batchId]) {
            revert DuplicateBatchId();
        }

        SessionUsage storage usage = _sessionUsages[permit.player][permit.nonce];
        if (usage.revoked) {
            revert SessionRevoked();
        }

        uint256 newSubmittedRuns = uint256(usage.submittedRuns) + runs.length;
        if (newSubmittedRuns > permit.maxRuns) {
            revert MaxRunsExceeded();
        }

        bytes32 expectedBatchId = keccak256(
            abi.encode(permit.sessionId, permit.nonce, runs[0].runId, runs.length)
        );
        if (batchId != expectedBatchId) {
            revert InvalidBatchId();
        }

        bytes32 permitDigest = _hashTypedData(
            SESSION_PERMIT_NAME_HASH,
            _hashSessionPermit(permit)
        );
        if (_recoverSigner(permitDigest, playerPermitSig) != permit.player) {
            revert InvalidPlayerSignature();
        }

        bytes32 runsHash = _hashRuns(permit.sessionId, runs);
        bytes32 batchDigest = _hashTypedData(
            VERIFIED_BATCH_NAME_HASH,
            keccak256(
                abi.encode(
                    VERIFIED_BATCH_TYPEHASH,
                    permit.player,
                    permit.delegate,
                    permit.sessionId,
                    permit.nonce,
                    batchId,
                    runsHash
                )
            )
        );
        if (_recoverSigner(batchDigest, verifierSig) != verifier) {
            revert InvalidVerifierSignature();
        }

        _recordedBatches[batchId] = true;
        usage.submittedRuns = uint16(newSubmittedRuns);
        if (newSubmittedRuns == permit.maxRuns) {
            usage.revoked = true;
        }

        for (uint256 i = 0; i < runs.length; i++) {
            VerifiedRun calldata run = runs[i];
            _recordedRuns[run.runId] = true;

            RunResult memory result = RunResult({
                levelId: run.levelId,
                levelVersion: run.levelVersion,
                birdsUsed: run.birdsUsed,
                destroyedPigs: run.destroyedPigs,
                durationMs: run.durationMs,
                evidenceHash: run.evidenceHash,
                submittedAt: uint64(block.timestamp)
            });

            _recordRun(permit.player, result);
            emit RunSubmitted(
                permit.player,
                run.levelId,
                run.levelVersion,
                run.birdsUsed,
                run.destroyedPigs,
                run.durationMs,
                run.evidenceHash
            );
        }

        emit VerifiedBatchSubmitted(
            permit.player,
            permit.delegate,
            batchId,
            permit.sessionId,
            permit.nonce,
            runs.length
        );
    }

    /// @notice 查询指定关卡版本的排行榜快照（按成绩已排序）。
    function getLeaderboard(
        bytes32 levelId,
        uint32 version
    ) external view returns (LeaderboardEntry[] memory) {
        return _leaderboards[levelId][version];
    }

    /// @notice 查询跨关卡全局榜。
    function getGlobalLeaderboard()
        external
        view
        returns (LeaderboardEntry[] memory)
    {
        return _globalLeaderboard;
    }

    /// @notice 查询玩家历史 run 条数（环形缓冲区内，最多 50 条）。
    function getUserHistoryCount(address player) external view returns (uint256) {
        return _histories[player].count;
    }

    /// @notice 按 offset/limit 倒序分页读取玩家历史（最新成绩优先）。
    function getUserHistory(
        address player,
        uint256 offset,
        uint256 limit
    ) external view returns (RunResult[] memory) {
        HistoryBuffer storage buffer = _histories[player];
        uint256 count = buffer.count;

        if (offset >= count || limit == 0) {
            return new RunResult[](0);
        }

        uint256 remaining = count - offset;
        uint256 size = limit < remaining ? limit : remaining;
        RunResult[] memory result = new RunResult[](size);
        uint256 historyCap = uint256(MAX_HISTORY_PER_USER);

        for (uint256 i = 0; i < size; i++) {
            uint256 indexFromHead =
                (uint256(buffer.head) + count - 1 - (offset + i)) % historyCap;
            result[i] = buffer.entries[uint32(indexFromHead)];
        }

        return result;
    }

    function getSessionUsage(
        address player,
        uint32 nonce
    ) external view returns (uint16 submittedRuns, bool revoked) {
        SessionUsage storage usage = _sessionUsages[player][nonce];
        return (usage.submittedRuns, usage.revoked);
    }

    /// @notice 判断 runId 是否已被上链接收（用于去重防重放）。
    function isRunRecorded(bytes32 runId) external view returns (bool) {
        return _recordedRuns[runId];
    }

    /// @dev 单条 run 入榜总入口：写历史、写关卡榜、尝试刷新全局最佳。
    function _recordRun(address player, RunResult memory result) private {
        _pushHistory(player, result);
        _upsertLeaderboard(player, result);
        if (_updateGlobalBest(player, result)) {
            emit GlobalBestUpdated(
                player,
                result.levelId,
                result.levelVersion,
                result.birdsUsed,
                result.durationMs,
                result.evidenceHash
            );
        }
    }

    /// @dev 将成绩写入玩家历史环形缓冲区，满容量后覆盖最旧记录。
    function _pushHistory(address player, RunResult memory result) private {
        HistoryBuffer storage buffer = _histories[player];

        if (buffer.count < MAX_HISTORY_PER_USER) {
            uint32 index = buffer.count;
            buffer.entries[index] = result;
            buffer.count += 1;
            return;
        }

        uint32 head = buffer.head;
        buffer.entries[head] = result;
        buffer.head = head + 1;
        if (buffer.head >= MAX_HISTORY_PER_USER) {
            buffer.head = 0;
        }
    }

    /// @dev 将成绩按排序规则插入到关卡榜，保持有序并限制最大长度。
    function _upsertLeaderboard(address player, RunResult memory result) private {
        LeaderboardEntry[] storage board = _leaderboards[result.levelId][result.levelVersion];
        uint256 length = board.length;
        uint256 insertIndex = _findInsertIndex(board, result, length);

        if (length >= MAX_LEADERBOARD_PER_LEVEL && insertIndex >= length) {
            return;
        }

        LeaderboardEntry memory entry = LeaderboardEntry({
            player: player,
            result: result
        });

        if (length < MAX_LEADERBOARD_PER_LEVEL) {
            board.push(entry);
            for (uint256 i = length; i > insertIndex; i--) {
                board[i] = board[i - 1];
            }
            board[insertIndex] = entry;
            return;
        }

        for (uint256 i = length - 1; i > insertIndex; i--) {
            board[i] = board[i - 1];
        }
        board[insertIndex] = entry;
    }

    /// @dev 仅当新成绩优于当前全局最佳时更新，返回是否发生更新。
    function _updateGlobalBest(
        address player,
        RunResult memory result
    ) private returns (bool) {
        if (!_hasGlobalBest[player]) {
            _globalBest[player] = result;
            _hasGlobalBest[player] = true;
            _upsertGlobalLeaderboard(player, result);
            return true;
        }

        RunResult memory currentBest = _globalBest[player];
        if (_isBetter(result, currentBest)) {
            _globalBest[player] = result;
            _upsertGlobalLeaderboard(player, result);
            return true;
        }

        return false;
    }

    /// @dev 对全局榜执行“先删旧再插新”，并在超限时淘汰尾部玩家。
    function _upsertGlobalLeaderboard(
        address player,
        RunResult memory result
    ) private {
        LeaderboardEntry[] storage board = _globalLeaderboard;
        uint256 existingIndexPlusOne = _globalLeaderboardIndexPlusOne[player];
        if (existingIndexPlusOne != 0) {
            _removeGlobalLeaderboardEntry(existingIndexPlusOne - 1);
        }

        uint256 length = board.length;
        uint256 insertIndex = _findInsertIndex(board, result, length);
        if (length >= MAX_LEADERBOARD_PER_LEVEL && insertIndex >= length) {
            _globalLeaderboardIndexPlusOne[player] = 0;
            return;
        }

        LeaderboardEntry memory entry = LeaderboardEntry({
            player: player,
            result: result
        });

        if (length < MAX_LEADERBOARD_PER_LEVEL) {
            board.push(entry);
        } else {
            board.push(board[length - 1]);
        }

        for (uint256 i = board.length - 1; i > insertIndex; i--) {
            board[i] = board[i - 1];
        }
        board[insertIndex] = entry;

        if (board.length > MAX_LEADERBOARD_PER_LEVEL) {
            address evictedPlayer = board[board.length - 1].player;
            board.pop();
            _globalLeaderboardIndexPlusOne[evictedPlayer] = 0;
        }

        _reindexGlobalLeaderboard();
    }

    /// @dev 删除全局榜指定下标条目，供玩家最佳成绩更新时复用。
    function _removeGlobalLeaderboardEntry(uint256 index) private {
        LeaderboardEntry[] storage board = _globalLeaderboard;
        uint256 length = board.length;
        address removedPlayer = board[index].player;

        for (uint256 i = index; i + 1 < length; i++) {
            board[i] = board[i + 1];
        }

        board.pop();
        _globalLeaderboardIndexPlusOne[removedPlayer] = 0;
    }

    /// @dev 重建 player -> 排名索引映射，保证 O(1) 定位玩家名次。
    function _reindexGlobalLeaderboard() private {
        LeaderboardEntry[] storage board = _globalLeaderboard;
        for (uint256 i = 0; i < board.length; i++) {
            _globalLeaderboardIndexPlusOne[board[i].player] = i + 1;
        }
    }

    /// @dev 在线性扫描中找到候选成绩应插入的位置（越靠前成绩越好）。
    function _findInsertIndex(
        LeaderboardEntry[] storage board,
        RunResult memory candidate,
        uint256 length
    ) private view returns (uint256) {
        uint32 candidateLevelOrder = _getLevelOrder(
            candidate.levelId,
            candidate.levelVersion
        );
        for (uint256 i = 0; i < length; i++) {
            if (
                _isBetterWithOrders(
                    candidate,
                    candidateLevelOrder,
                    board[i].result,
                    _getLevelOrder(
                        board[i].result.levelId,
                        board[i].result.levelVersion
                    )
                )
            ) {
                return i;
            }
        }
        return length;
    }

    /// @dev 成绩比较入口：补齐关卡顺序后复用统一比较规则。
    function _isBetter(
        RunResult memory left,
        RunResult memory right
    ) private view returns (bool) {
        return
            _isBetterWithOrders(
                left,
                _getLevelOrder(left.levelId, left.levelVersion),
                right,
                _getLevelOrder(right.levelId, right.levelVersion)
            );
    }

    /// @dev 全局榜比较规则：先比较关卡深度，再比较用鸟数、用时、提交时间。
    function _isBetterWithOrders(
        RunResult memory left,
        uint32 leftLevelOrder,
        RunResult memory right,
        uint32 rightLevelOrder
    ) private pure returns (bool) {
        if (leftLevelOrder > rightLevelOrder) return true;
        if (leftLevelOrder < rightLevelOrder) return false;

        if (left.birdsUsed < right.birdsUsed) return true;
        if (left.birdsUsed > right.birdsUsed) return false;

        if (left.durationMs < right.durationMs) return true;
        if (left.durationMs > right.durationMs) return false;

        return left.submittedAt < right.submittedAt;
    }

    /// @dev 从目录合约读取关卡 order，用于跨关卡统一排序。
    function _getLevelOrder(
        bytes32 levelId,
        uint32 levelVersion
    ) private view returns (uint32) {
        IAngryBirdsLevelCatalog.LevelConfig memory level =
            levelCatalog.getLevel(levelId, levelVersion);
        return level.order;
    }

    /// @dev 校验单条 run 的关键业务字段与关卡状态。
    function _validateRunFields(
        bytes32 levelId,
        uint32 levelVersion,
        uint8 birdsUsed,
        uint32 durationMs,
        bytes32 evidenceHash
    ) private view {
        if (levelId == bytes32(0)) {
            revert InvalidLevelId();
        }
        if (levelVersion == 0) {
            revert InvalidLevelVersion();
        }
        if (!levelCatalog.levelExists(levelId, levelVersion)) {
            revert LevelNotFound();
        }
        if (!levelCatalog.isLevelEnabled(levelId, levelVersion)) {
            revert LevelDisabled();
        }
        if (birdsUsed == 0) {
            revert InvalidBirdsUsed();
        }
        if (durationMs == 0) {
            revert InvalidDuration();
        }
        if (evidenceHash == bytes32(0)) {
            revert InvalidEvidenceHash();
        }
    }

    /// @dev 对批量 runs 做字段校验、runId 校验、去重校验，并生成签名用 runsHash。
    function _hashRuns(
        bytes32 sessionId,
        VerifiedRun[] calldata runs
    ) private view returns (bytes32) {
        bytes32[] memory runHashes = new bytes32[](runs.length);

        for (uint256 i = 0; i < runs.length; i++) {
            VerifiedRun calldata run = runs[i];
            _validateRunFields(
                run.levelId,
                run.levelVersion,
                run.birdsUsed,
                run.durationMs,
                run.evidenceHash
            );

            bytes32 expectedRunId = keccak256(
                abi.encode(
                    sessionId,
                    run.levelId,
                    run.levelVersion,
                    run.evidenceHash
                )
            );
            if (run.runId == bytes32(0) || run.runId != expectedRunId) {
                revert InvalidRunId();
            }
            if (_recordedRuns[run.runId]) {
                revert DuplicateRunId();
            }

            runHashes[i] = keccak256(
                abi.encode(
                    VERIFIED_RUN_TYPEHASH,
                    run.runId,
                    run.levelId,
                    run.levelVersion,
                    run.birdsUsed,
                    run.destroyedPigs,
                    run.durationMs,
                    run.evidenceHash
                )
            );
        }

        return keccak256(abi.encode(runHashes));
    }

    /// @dev 生成 SessionPermit 的 EIP-712 struct hash。
    function _hashSessionPermit(
        SessionPermit calldata permit
    ) private pure returns (bytes32) {
        return keccak256(
            abi.encode(
                SESSION_PERMIT_TYPEHASH,
                permit.player,
                permit.delegate,
                permit.sessionId,
                permit.deploymentIdHash,
                permit.issuedAt,
                permit.deadline,
                permit.nonce,
                permit.maxRuns
            )
        );
    }

    /// @dev 按 EIP-712 规范拼接 domain separator 与 struct hash。
    function _hashTypedData(
        bytes32 nameHash,
        bytes32 structHash
    ) private view returns (bytes32) {
        return keccak256(
            abi.encodePacked("\x19\x01", _domainSeparator(nameHash), structHash)
        );
    }

    /// @dev 生成当前合约的 EIP-712 domain separator。
    function _domainSeparator(bytes32 nameHash) private view returns (bytes32) {
        return keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                nameHash,
                VERSION_HASH,
                block.chainid,
                address(this)
            )
        );
    }

    /// @dev 从 65 字节签名恢复 signer；格式不合法时返回零地址。
    function _recoverSigner(
        bytes32 digest,
        bytes calldata signature
    ) private pure returns (address signer) {
        if (signature.length != 65) {
            return address(0);
        }

        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }

        if (v < 27) {
            v += 27;
        }
        if (v != 27 && v != 28) {
            return address(0);
        }

        signer = ecrecover(digest, v, r, s);
    }
}
