// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title BraveManGame
/// @notice ERC1155 资产、EIP-712 结算签名与个人历史的教学合约
/// @dev 为避免本地 OpenZeppelin 版本漂移导致编译失败，首版直接内置最小实现
contract BraveManGame {
    /// @dev 结算 payload 中的 player 与交易发送者不一致。
    error InvalidSettlementPlayer();
    /// @dev EIP-712 签名恢复地址与当前 settlementSigner 不一致。
    error InvalidSigner();
    /// @dev ECDSA 签名长度必须严格为 65 字节。
    error InvalidSignatureLength();
    /// @dev 同一个 sessionId 只允许 claim 一次（防重放）。
    error SessionAlreadyClaimed();
    /// @dev 弓解锁资产为一次性购买，不允许重复购买。
    error AlreadyOwnsBow();
    /// @dev GOLD 余额不足以完成购买。
    error InsufficientGold();
    /// @dev address(0) 非法输入保护。
    error ZeroAddress();
    /// @dev 仅 owner 可调用的权限保护错误。
    error OwnableUnauthorizedAccount(address account);
    error OwnableInvalidOwner(address owner);
    error OwnableInvalidPendingOwner(address pendingOwner);

    /// @notice 后端签名并由链上验签的结算数据载体（EIP-712 typed data）。
    struct Settlement {
        /// @dev 本局唯一标识，由后端创建 session 时生成。
        bytes32 sessionId;
        /// @dev 玩家地址，链上要求必须与 msg.sender 相同。
        address player;
        /// @dev 本局击杀数（用于 best/history 展示）。
        uint32 kills;
        /// @dev 本局存活时长（毫秒）。
        uint32 survivalMs;
        /// @dev 本局应发放 GOLD 数量。
        uint32 goldEarned;
        /// @dev 结算时间戳（秒）。
        uint64 endedAt;
        /// @dev 规则版本号，前后端与链上都依赖该字段做一致性语义。
        uint32 rulesetVersion;
        /// @dev 规则配置哈希，对应后端生成的 configHash。
        bytes32 configHash;
    }

    /// @notice 写入个人历史的扁平记录结构。
    struct RunRecord {
        address player;
        uint32 kills;
        uint32 survivalMs;
        uint32 goldEarned;
        uint64 endedAt;
    }

    /// @notice 固定容量（MAX_HISTORY）的环形历史缓冲区。
    struct HistoryBuffer {
        /// @dev 当缓冲区写满后，head 指向“下一个将被覆盖”的最旧槽位。
        uint32 head;
        /// @dev 当前有效记录数，最大不超过 MAX_HISTORY。
        uint32 count;
        /// @dev 真实记录存储，逻辑顺序由 head/count 共同解释。
        mapping(uint32 => RunRecord) entries;
    }

    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant SETTLEMENT_TYPEHASH = keccak256(
        "Settlement(bytes32 sessionId,address player,uint32 kills,uint32 survivalMs,uint32 goldEarned,uint64 endedAt,uint32 rulesetVersion,bytes32 configHash)"
    );
    bytes32 private constant NAME_HASH = keccak256("BraveManGame");
    bytes32 private constant VERSION_HASH = keccak256("1");

    uint256 public constant GOLD_TOKEN_ID = 1;
    uint256 public constant BOW_UNLOCK_TOKEN_ID = 2;
    uint256 public constant BOW_PRICE = 10;
    uint32 public constant MAX_HISTORY = 50;

    /// @dev ERC1155 简化账本：tokenId => (account => balance)。
    mapping(uint256 => mapping(address => uint256)) private balances;
    /// @dev 已 claim 的 sessionId 集合，作为结算防重放闸门。
    mapping(bytes32 => bool) public claimedSessionIds;
    /// @dev 玩家历史最高击杀（仅当本局更高时更新）。
    mapping(address => uint32) public bestKillsOf;
    /// @dev 玩家历史环形记录。
    mapping(address => HistoryBuffer) private histories;

    /// @dev 两步所有权转移：当前 owner。
    address public owner;
    /// @dev 两步所有权转移：候选 owner（需主动 accept）。
    address public pendingOwner;
    /// @dev 后端结算签名地址，owner 可治理更新。
    address public settlementSigner;

    event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event SettlementClaimed(
        bytes32 indexed sessionId,
        address indexed player,
        uint32 kills,
        uint32 survivalMs,
        uint32 goldEarned,
        uint64 endedAt
    );
    event BowPurchased(address indexed player, uint256 price);
    event SignerUpdated(address indexed previousSigner, address indexed newSigner);

    /// @notice 初始化合约所有者与结算签名者
    /// @param initialOwner 初始 owner 地址
    /// @param initialSigner 后端 EIP-712 签名地址
    constructor(address initialOwner, address initialSigner) {
        if (initialOwner == address(0) || initialSigner == address(0)) {
            revert ZeroAddress();
        }
        owner = initialOwner;
        settlementSigner = initialSigner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    /// @notice 仅 owner 可调用
    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert OwnableUnauthorizedAccount(msg.sender);
        }
        _;
    }

    /// @notice 查询 ERC1155 余额
    /// @param account 查询账户
    /// @param id 资产 tokenId
    /// @return 账户余额
    function balanceOf(address account, uint256 id) public view returns (uint256) {
        if (account == address(0)) {
            revert ZeroAddress();
        }
        return balances[id][account];
    }

    /// @notice 教学示例中未启用 metadata URI，返回空字符串
    function uri(uint256) external pure returns (string memory) {
        return "";
    }

    /// @notice 返回本合约支持的接口标识（ERC165/ERC1155/ERC1155MetadataURI）
    /// @dev 教学实现返回固定三类接口标识，不实现额外扩展接口。
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 || interfaceId == 0xd9b67a26 || interfaceId == 0x0e89341c;
    }

    /// @notice 发起所有权转移（两步转移第一步）
    /// @param newOwner 候选新 owner
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    /// @notice 接受所有权（两步转移第二步）
    function acceptOwnership() external {
        address nextOwner = pendingOwner;
        if (msg.sender != nextOwner) {
            revert OwnableUnauthorizedAccount(msg.sender);
        }
        pendingOwner = address(0);
        emit OwnershipTransferred(owner, nextOwner);
        owner = nextOwner;
    }

    /// @notice 提交后端签名的结算结果并铸造金币
    /// @dev
    /// 执行顺序：
    /// 1) 校验 `settlement.player == msg.sender`，防止他人代领；
    /// 2) 校验 `sessionId` 未 claim，防止重放；
    /// 3) EIP-712 验签，要求签名地址等于 `settlementSigner`；
    /// 4) 写入 claim 标记；
    /// 5) 按 `goldEarned` 铸造 GOLD；
    /// 6) 刷新 bestKills 与环形历史；
    /// 7) 发出 SettlementClaimed 事件供前端/索引读取。
    /// 验签失败、重放、地址不匹配均会回滚。
    function claimSettlement(Settlement calldata settlement, bytes calldata signature) external {
        if (settlement.player != msg.sender) {
            revert InvalidSettlementPlayer();
        }
        if (claimedSessionIds[settlement.sessionId]) {
            revert SessionAlreadyClaimed();
        }
        if (_recoverSettlementSigner(settlement, signature) != settlementSigner) {
            revert InvalidSigner();
        }

        claimedSessionIds[settlement.sessionId] = true;
        if (settlement.goldEarned > 0) {
            _mint(msg.sender, GOLD_TOKEN_ID, settlement.goldEarned);
        }

        RunRecord memory record = RunRecord({
            player: settlement.player,
            kills: settlement.kills,
            survivalMs: settlement.survivalMs,
            goldEarned: settlement.goldEarned,
            endedAt: settlement.endedAt
        });

        if (settlement.kills > bestKillsOf[msg.sender]) {
            bestKillsOf[msg.sender] = settlement.kills;
        }

        _pushHistory(msg.sender, record);

        emit SettlementClaimed(
            settlement.sessionId,
            msg.sender,
            settlement.kills,
            settlement.survivalMs,
            settlement.goldEarned,
            settlement.endedAt
        );
    }

    /// @notice 消耗 10 GOLD 永久购买霜翎逐月解锁权
    /// @dev
    /// 约束：
    /// - 玩家已持有 `BOW_UNLOCK_TOKEN_ID` 时拒绝重复购买；
    /// - GOLD 余额必须 >= `BOW_PRICE`；
    /// 资金流：
    /// - 先 burn GOLD，再 mint BOW_UNLOCK，保持经济闭环。
    function purchaseBow() external {
        if (balances[BOW_UNLOCK_TOKEN_ID][msg.sender] > 0) {
            revert AlreadyOwnsBow();
        }
        if (balances[GOLD_TOKEN_ID][msg.sender] < BOW_PRICE) {
            revert InsufficientGold();
        }

        _burn(msg.sender, GOLD_TOKEN_ID, BOW_PRICE);
        _mint(msg.sender, BOW_UNLOCK_TOKEN_ID, 1);

        emit BowPurchased(msg.sender, BOW_PRICE);
    }

    /// @notice 更新后端结算签名地址
    /// @param newSigner 新签名地址
    /// @dev 仅 owner 可调用；更新后仅新 signer 的结算可被链上接受。
    function updateSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) {
            revert ZeroAddress();
        }
        address previousSigner = settlementSigner;
        settlementSigner = newSigner;
        emit SignerUpdated(previousSigner, newSigner);
    }

    /// @notice 查询用户历史记录总数
    /// @param player 玩家地址
    /// @return 历史记录条数
    /// @dev 返回值上限为 MAX_HISTORY（环形缓冲区容量）。
    function getUserHistoryCount(address player) external view returns (uint256) {
        return histories[player].count;
    }

    /// @notice 按倒序分页查询个人历史（最新在前）
    /// @param player 玩家地址
    /// @param offset 偏移量（从最新记录开始）
    /// @param limit 读取上限
    /// @return result 记录数组
    /// @dev
    /// 倒序读取规则：
    /// - `offset=0` 代表最新一条；
    /// - 内部通过 `head + count - 1 - (offset + i)` 反推真实槽位；
    /// - 缓冲区写满后会覆盖最旧记录，因此可见窗口最多 MAX_HISTORY。
    function getUserHistory(address player, uint256 offset, uint256 limit) external view returns (RunRecord[] memory) {
        HistoryBuffer storage buffer = histories[player];
        uint256 count = buffer.count;

        if (offset >= count || limit == 0) {
            return new RunRecord[](0);
        }

        uint256 remaining = count - offset;
        uint256 size = limit < remaining ? limit : remaining;
        RunRecord[] memory result = new RunRecord[](size);
        uint256 historyCap = uint256(MAX_HISTORY);

        for (uint256 i = 0; i < size; i++) {
            uint256 indexFromHead = (uint256(buffer.head) + count - 1 - (offset + i)) % historyCap;
            result[i] = buffer.entries[uint32(indexFromHead)];
        }

        return result;
    }

    /// @dev 内部铸造函数，更新余额并发出 TransferSingle 事件
    /// @param to 接收地址
    /// @param id ERC1155 tokenId
    /// @param amount 铸造数量
    function _mint(address to, uint256 id, uint256 amount) private {
        if (to == address(0)) {
            revert ZeroAddress();
        }
        balances[id][to] += amount;
        emit TransferSingle(msg.sender, address(0), to, id, amount);
    }

    /// @dev 内部销毁函数，检查余额后扣减并发出 TransferSingle 事件
    /// @param from 扣减地址
    /// @param id ERC1155 tokenId
    /// @param amount 销毁数量
    function _burn(address from, uint256 id, uint256 amount) private {
        if (from == address(0)) {
            revert ZeroAddress();
        }
        uint256 currentBalance = balances[id][from];
        if (currentBalance < amount) {
            revert InsufficientGold();
        }
        unchecked {
            balances[id][from] = currentBalance - amount;
        }
        emit TransferSingle(msg.sender, from, address(0), id, amount);
    }

    /// @dev 恢复 settlement 的 EIP-712 签名地址
    /// @param settlement 待验签的结算 payload
    /// @param signature 后端返回的 65 字节签名
    /// @return signer 从 digest 恢复出的签名地址
    function _recoverSettlementSigner(Settlement calldata settlement, bytes calldata signature)
        private
        view
        returns (address)
    {
        if (signature.length != 65) {
            revert InvalidSignatureLength();
        }

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                keccak256(abi.encode(EIP712_DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(this))),
                keccak256(
                    abi.encode(
                        SETTLEMENT_TYPEHASH,
                        settlement.sessionId,
                        settlement.player,
                        settlement.kills,
                        settlement.survivalMs,
                        settlement.goldEarned,
                        settlement.endedAt,
                        settlement.rulesetVersion,
                        settlement.configHash
                    )
                )
            )
        );

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

        return ecrecover(digest, v, r, s);
    }

    /// @dev 将结算记录写入环形缓冲区（超过上限后覆盖最旧记录）
    /// @param player 玩家地址
    /// @param entry 本次写入的记录
    function _pushHistory(address player, RunRecord memory entry) private {
        HistoryBuffer storage buffer = histories[player];

        if (buffer.count < MAX_HISTORY) {
            uint32 index = buffer.count;
            buffer.entries[index] = entry;
            buffer.count += 1;
            return;
        }

        uint32 head = buffer.head;
        buffer.entries[head] = entry;
        buffer.head = head + 1;
        if (buffer.head >= MAX_HISTORY) {
            buffer.head = 0;
        }
    }
}
