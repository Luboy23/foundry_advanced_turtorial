// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "openzeppelin-contracts/access/Ownable.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/security/ReentrancyGuard.sol";
import {ERC1155Holder} from "openzeppelin-contracts/token/ERC1155/utils/ERC1155Holder.sol";

import {PolymarketTypes} from "./PolymarketTypes.sol";
import {PositionToken} from "./PositionToken.sol";
import {ETHCollateralVault} from "./ETHCollateralVault.sol";
import {OracleAdapterMock} from "./OracleAdapterMock.sol";

/// @title BinaryEventCore
/// @notice Pari-mutuel 二元奖池核心流程（ETH 抵押、YES/NO 直购、结算后兑付）。
abstract contract BinaryEventCore is Ownable, ReentrancyGuard, ERC1155Holder {
    /// @notice 最小可配置事件时长（秒）。
    uint256 public constant MIN_CLOSE_DURATION_SEC = 30;
    /// @notice 最大可配置事件时长（秒）。
    uint256 public constant MAX_CLOSE_DURATION_SEC = 30 days;

    /// @notice 单个事件的核心状态快照。
    struct EventData {
        /// @notice 事件问题文案。
        string question;
        /// @notice 事件关闭时间戳（秒）。
        uint64 closeTime;
        /// @notice 外部裁定来源链接。
        string resolutionSourceURI;
        /// @notice 事件展示资料 metadata 链接。
        string metadataURI;
        /// @notice 事件生命周期状态。
        PolymarketTypes.EventState state;
        /// @notice 最终结果（仅在 `Resolved` 后生效）。
        PolymarketTypes.Outcome finalOutcome;
        /// @notice 当前尚未兑付的总抵押（wei）。
        uint256 totalCollateral;
        /// @notice YES 奖池累计金额（wei）。
        uint256 yesPool;
        /// @notice NO 奖池累计金额（wei）。
        uint256 noPool;
        /// @notice 结算最终化时记录的总奖池快照（wei）。
        /// @dev 用于赎回比例计算，避免结算后继续买入/赎回导致分母漂移。
        uint256 totalPoolSnapshot;
        /// @notice 结算最终化时记录的赢家方向奖池快照（wei）。
        /// @dev 赢家分配使用 `totalPoolSnapshot / winningPoolSnapshot` 固定比例。
        uint256 winningPoolSnapshot;
    }

    /// @notice ERC1155 头寸代币合约。
    PositionToken public immutable positionToken;
    /// @notice ETH 抵押金库合约。
    ETHCollateralVault public immutable collateralVault;
    /// @notice 结果提案/最终化适配器。
    OracleAdapterMock public immutable oracle;

    /// @notice 被授权提案和最终化结果的裁定员地址。
    address public resolver;
    /// @notice 已创建事件总数，eventId 从 1 递增。
    uint256 public eventCount;

    /// @notice 事件主存储，键为 eventId。
    mapping(uint256 => EventData) private events;

    /// @notice 裁定员地址变更事件。
    /// @param previousResolver 旧裁定员地址。
    /// @param newResolver 新裁定员地址。
    event ResolverUpdated(address indexed previousResolver, address indexed newResolver);

    /// @notice 事件创建事件。
    /// @param eventId 新事件 ID。
    /// @param creator 创建者地址。
    /// @param question 事件问题文案。
    /// @param closeTime 关闭时间戳（秒）。
    /// @param resolutionSourceURI 外部裁定来源链接。
    /// @param metadataURI 事件展示资料 metadata 链接。
    event EventCreated(
        uint256 indexed eventId,
        address indexed creator,
        string question,
        uint64 closeTime,
        string resolutionSourceURI,
        string metadataURI
    );

    /// @notice 用户买入头寸事件。
    /// @param eventId 事件 ID。
    /// @param user 买入地址。
    /// @param side 买入方向。
    /// @param collateralIn 本次投入 ETH（wei）。
    /// @param tokenAmount 本次铸造头寸数量（与投入等额）。
    /// @param yesPool 买入后 YES 奖池金额（wei）。
    /// @param noPool 买入后 NO 奖池金额（wei）。
    event PositionBought(
        uint256 indexed eventId,
        address indexed user,
        PolymarketTypes.PositionSide side,
        uint256 collateralIn,
        uint256 tokenAmount,
        uint256 yesPool,
        uint256 noPool
    );

    /// @notice 结果提案事件。
    /// @param eventId 事件 ID。
    /// @param proposer 提案地址。
    /// @param outcome 提案结果。
    /// @param proposedAt 提案时间戳（秒）。
    /// @param canFinalizeAt 最早可最终化时间戳（秒）。
    event ResolutionProposed(
        uint256 indexed eventId,
        address indexed proposer,
        PolymarketTypes.Outcome outcome,
        uint64 proposedAt,
        uint64 canFinalizeAt
    );

    /// @notice 结果最终化事件。
    /// @param eventId 事件 ID。
    /// @param outcome 最终结果。
    /// @param finalizedAt 最终化时间戳（秒）。
    event ResolutionFinalized(uint256 indexed eventId, PolymarketTypes.Outcome outcome, uint64 finalizedAt);

    /// @notice 用户赎回事件。
    /// @param eventId 事件 ID。
    /// @param user 赎回地址。
    /// @param yesAmount 本次提交的 YES 份额。
    /// @param noAmount 本次提交的 NO 份额。
    /// @param payout 本次兑付 ETH（wei）。
    /// @param outcome 赎回时事件最终结果。
    event Redeemed(
        uint256 indexed eventId,
        address indexed user,
        uint256 yesAmount,
        uint256 noAmount,
        uint256 payout,
        PolymarketTypes.Outcome outcome
    );

    /// @notice 仅 owner 可调用（显式语义别名，便于权限审计）。
    modifier onlyOwnerStrict() {
        require(msg.sender == owner(), "ONLY_OWNER");
        _;
    }

    /// @notice 仅 resolver 可调用。
    modifier onlyResolver() {
        require(msg.sender == resolver, "ONLY_RESOLVER");
        _;
    }

    /// @notice 初始化核心依赖并设置默认 resolver。
    /// @param _positionToken ERC1155 头寸代币合约。
    /// @param _collateralVault ETH 抵押金库合约。
    /// @param _oracle 结果提案/最终化适配器。
    constructor(
        PositionToken _positionToken,
        ETHCollateralVault _collateralVault,
        OracleAdapterMock _oracle
    ) {
        require(address(_positionToken) != address(0), "ZERO_ADDRESS");
        require(address(_collateralVault) != address(0), "ZERO_ADDRESS");
        require(address(_oracle) != address(0), "ZERO_ADDRESS");

        positionToken = _positionToken;
        collateralVault = _collateralVault;
        oracle = _oracle;
        resolver = msg.sender;
    }

    /// @notice 更新 resolver 地址。
    /// @param newResolver 新裁定员地址。
    function setResolver(address newResolver) external onlyOwnerStrict {
        require(newResolver != address(0), "ZERO_ADDRESS");
        address previous = resolver;
        resolver = newResolver;
        emit ResolverUpdated(previous, newResolver);
    }

    /// @notice 创建事件（绝对关闭时间）。
    /// @param question 事件问题文案。
    /// @param closeTime 关闭时间戳（秒）。
    /// @param resolutionSourceURI 外部裁定来源链接。
    /// @param metadataURI 事件展示资料 metadata 链接。
    /// @return eventId 新事件 ID。
    function createEvent(
        string calldata question,
        uint256 closeTime,
        string calldata resolutionSourceURI,
        string calldata metadataURI
    ) external onlyOwnerStrict returns (uint256 eventId) {
        eventId = _createEvent(question, closeTime, resolutionSourceURI, metadataURI);
    }

    /// @notice 创建事件（相对时长）。
    /// @param question 事件问题文案。
    /// @param closeDurationSec 距当前区块时间的关闭时长（秒）。
    /// @param resolutionSourceURI 外部裁定来源链接。
    /// @param metadataURI 事件展示资料 metadata 链接。
    /// @return eventId 新事件 ID。
    function createEventWithDuration(
        string calldata question,
        uint256 closeDurationSec,
        string calldata resolutionSourceURI,
        string calldata metadataURI
    ) external onlyOwnerStrict returns (uint256 eventId) {
        require(closeDurationSec >= MIN_CLOSE_DURATION_SEC, "CLOSE_DURATION_TOO_SHORT");
        require(closeDurationSec <= MAX_CLOSE_DURATION_SEC, "CLOSE_DURATION_TOO_LONG");
        eventId = _createEvent(question, block.timestamp + closeDurationSec, resolutionSourceURI, metadataURI);
    }

    /// @notice 买入 YES 头寸。
    /// @dev `msg.value` 为投入金额，1 wei 对应 1 wei 份额。
    /// @param eventId 事件 ID。
    function buyYes(uint256 eventId) external payable nonReentrant {
        _buyPosition(eventId, PolymarketTypes.PositionSide.Yes);
    }

    /// @notice 买入 NO 头寸。
    /// @dev `msg.value` 为投入金额，1 wei 对应 1 wei 份额。
    /// @param eventId 事件 ID。
    function buyNo(uint256 eventId) external payable nonReentrant {
        _buyPosition(eventId, PolymarketTypes.PositionSide.No);
    }

    /// @notice 提交事件结果提案并进入冷静期。
    /// @dev 仅 `Open` 状态可提案，且要求达到事件关闭时间。
    /// @param eventId 事件 ID。
    /// @param outcome 提案结果。
    /// @return proposedAt 提案时间戳（秒）。
    /// @return canFinalizeAt 最早可最终化时间戳（秒）。
    function proposeResolution(uint256 eventId, PolymarketTypes.Outcome outcome)
        external
        onlyResolver
        returns (uint64 proposedAt, uint64 canFinalizeAt)
    {
        _requireEventExists(eventId);

        EventData storage eventData = events[eventId];
        require(eventData.state != PolymarketTypes.EventState.Resolved, "EVENT_RESOLVED");
        require(block.timestamp >= eventData.closeTime, "EVENT_NOT_CLOSED");
        require(eventData.state == PolymarketTypes.EventState.Open, "EVENT_NOT_OPEN");

        (proposedAt, canFinalizeAt) = oracle.proposeResolution(eventId, msg.sender, outcome);
        eventData.state = PolymarketTypes.EventState.Proposed;

        emit ResolutionProposed(eventId, msg.sender, outcome, proposedAt, canFinalizeAt);
    }

    /// @notice 在冷静期后最终化事件结果。
    /// @dev 若裁定为 Yes/No 但赢家池为 0，则自动降级为 `Invalid`，避免分配分母为 0。
    /// @param eventId 事件 ID。
    /// @return outcome 最终结果。
    function finalizeResolution(uint256 eventId) external onlyResolver returns (PolymarketTypes.Outcome outcome) {
        _requireEventExists(eventId);

        EventData storage eventData = events[eventId];
        require(eventData.state == PolymarketTypes.EventState.Proposed, "NOT_PROPOSED");

        outcome = oracle.finalizeResolution(eventId);

        uint256 winningPoolSnapshot;
        if (outcome == PolymarketTypes.Outcome.Yes) {
            winningPoolSnapshot = eventData.yesPool;
            if (winningPoolSnapshot == 0) {
                // 无赢家仓位时无法按比例分配，降级为 Invalid 走 1:1 退款语义。
                outcome = PolymarketTypes.Outcome.Invalid;
                winningPoolSnapshot = 0;
            }
        } else if (outcome == PolymarketTypes.Outcome.No) {
            winningPoolSnapshot = eventData.noPool;
            if (winningPoolSnapshot == 0) {
                // 无赢家仓位时无法按比例分配，降级为 Invalid 走 1:1 退款语义。
                outcome = PolymarketTypes.Outcome.Invalid;
                winningPoolSnapshot = 0;
            }
        } else {
            winningPoolSnapshot = 0;
        }

        // 在最终化时冻结奖池快照，后续赎回统一基于该快照计算，避免时序引起结果漂移。
        eventData.totalPoolSnapshot = eventData.totalCollateral;
        eventData.winningPoolSnapshot = winningPoolSnapshot;
        eventData.finalOutcome = outcome;
        eventData.state = PolymarketTypes.EventState.Resolved;

        emit ResolutionFinalized(eventId, outcome, uint64(block.timestamp));
    }

    /// @notice 结算后赎回 ETH。
    /// @dev Yes/No 结果仅允许赎回赢家方向；`Invalid` 支持 Yes/No 同时 1:1 赎回。
    /// @param eventId 事件 ID。
    /// @param yesAmount 提交赎回的 YES 份额。
    /// @param noAmount 提交赎回的 NO 份额。
    /// @return payout 可兑付 ETH（wei）。
    function redeemToETH(uint256 eventId, uint256 yesAmount, uint256 noAmount) external nonReentrant returns (uint256 payout) {
        _requireEventExists(eventId);

        EventData storage eventData = events[eventId];
        require(eventData.state == PolymarketTypes.EventState.Resolved, "EVENT_NOT_RESOLVED");

        payout = _previewRedeemPayout(eventData, yesAmount, noAmount);
        require(payout > 0, "NO_POSITION");

        uint256 yesId = yesTokenId(eventId);
        uint256 noId = noTokenId(eventId);

        if (eventData.finalOutcome == PolymarketTypes.Outcome.Yes) {
            require(noAmount == 0, "ONLY_YES_REDEEM");
            require(positionToken.balanceOf(msg.sender, yesId) >= yesAmount, "INSUFFICIENT_YES");
            positionToken.burn(msg.sender, yesId, yesAmount);
        } else if (eventData.finalOutcome == PolymarketTypes.Outcome.No) {
            require(yesAmount == 0, "ONLY_NO_REDEEM");
            require(positionToken.balanceOf(msg.sender, noId) >= noAmount, "INSUFFICIENT_NO");
            positionToken.burn(msg.sender, noId, noAmount);
        } else if (eventData.finalOutcome == PolymarketTypes.Outcome.Invalid) {
            if (yesAmount > 0) {
                require(positionToken.balanceOf(msg.sender, yesId) >= yesAmount, "INSUFFICIENT_YES");
                positionToken.burn(msg.sender, yesId, yesAmount);
            }
            if (noAmount > 0) {
                require(positionToken.balanceOf(msg.sender, noId) >= noAmount, "INSUFFICIENT_NO");
                positionToken.burn(msg.sender, noId, noAmount);
            }
        }

        require(eventData.totalCollateral >= payout, "INSUFFICIENT_COLLATERAL");
        eventData.totalCollateral -= payout;

        collateralVault.payout(msg.sender, eventId, payout);

        emit Redeemed(eventId, msg.sender, yesAmount, noAmount, payout, eventData.finalOutcome);
    }

    /// @notice 计算 YES 头寸 tokenId。
    /// @param eventId 事件 ID。
    /// @return tokenId 对应 YES tokenId。
    function yesTokenId(uint256 eventId) public pure returns (uint256) {
        return eventId * 2;
    }

    /// @notice 计算 NO 头寸 tokenId。
    /// @param eventId 事件 ID。
    /// @return tokenId 对应 NO tokenId。
    function noTokenId(uint256 eventId) public pure returns (uint256) {
        return eventId * 2 + 1;
    }

    /// @notice 读取事件主状态。
    /// @param eventId 事件 ID。
    /// @return question 事件问题文案。
    /// @return closeTime 关闭时间戳（秒）。
    /// @return state 事件生命周期状态。
    /// @return finalOutcome 事件最终结果。
    /// @return totalCollateral 当前未兑付总抵押（wei）。
    /// @return yesPool YES 奖池累计金额（wei）。
    /// @return noPool NO 奖池累计金额（wei）。
    /// @return totalPoolSnapshot 最终化时总奖池快照（wei）。
    /// @return winningPoolSnapshot 最终化时赢家奖池快照（wei）。
    /// @return resolutionSourceURI 外部裁定来源链接。
    /// @return metadataURI 事件展示资料 metadata 链接。
    function getEvent(uint256 eventId)
        external
        view
        returns (
            string memory question,
            uint256 closeTime,
            PolymarketTypes.EventState state,
            PolymarketTypes.Outcome finalOutcome,
            uint256 totalCollateral,
            uint256 yesPool,
            uint256 noPool,
            uint256 totalPoolSnapshot,
            uint256 winningPoolSnapshot,
            string memory resolutionSourceURI,
            string memory metadataURI
        )
    {
        _requireEventExists(eventId);
        EventData storage eventData = events[eventId];

        question = eventData.question;
        closeTime = eventData.closeTime;
        state = eventData.state;
        finalOutcome = eventData.finalOutcome;
        totalCollateral = eventData.totalCollateral;
        yesPool = eventData.yesPool;
        noPool = eventData.noPool;
        totalPoolSnapshot = eventData.totalPoolSnapshot;
        winningPoolSnapshot = eventData.winningPoolSnapshot;
        resolutionSourceURI = eventData.resolutionSourceURI;
        metadataURI = eventData.metadataURI;
    }

    /// @notice 读取事件结算提案状态。
    /// @param eventId 事件 ID。
    /// @return proposer 提案地址。
    /// @return proposedOutcome 提案结果。
    /// @return proposedAt 提案时间戳（秒）。
    /// @return proposed 是否已提案。
    /// @return finalized 是否已最终化。
    /// @return canFinalizeAt 最早可最终化时间戳（秒）。
    function getResolutionState(uint256 eventId)
        external
        view
        returns (
            address proposer,
            PolymarketTypes.Outcome proposedOutcome,
            uint256 proposedAt,
            bool proposed,
            bool finalized,
            uint256 canFinalizeAt
        )
    {
        _requireEventExists(eventId);
        PolymarketTypes.ResolutionState memory state = oracle.getResolutionState(eventId);
        proposer = state.proposer;
        proposedOutcome = state.proposedOutcome;
        proposedAt = state.proposedAt;
        proposed = state.proposed;
        finalized = state.finalized;
        canFinalizeAt = state.canFinalizeAt;
    }

    /// @notice 读取用户在单事件中的 YES/NO 持仓。
    /// @param eventId 事件 ID。
    /// @param user 用户地址。
    /// @return yesBalance YES 份额余额。
    /// @return noBalance NO 份额余额。
    function getUserPosition(uint256 eventId, address user) external view returns (uint256 yesBalance, uint256 noBalance) {
        _requireEventExists(eventId);
        yesBalance = positionToken.balanceOf(user, yesTokenId(eventId));
        noBalance = positionToken.balanceOf(user, noTokenId(eventId));
    }

    /// @notice 读取赎回预估。
    /// @dev 未结算事件固定返回 0，避免前端误读可兑付值。
    /// @param eventId 事件 ID。
    /// @param yesAmount 计划赎回的 YES 份额。
    /// @param noAmount 计划赎回的 NO 份额。
    /// @return payout 可兑付 ETH（wei）。
    function getRedeemPreview(uint256 eventId, uint256 yesAmount, uint256 noAmount) external view returns (uint256 payout) {
        _requireEventExists(eventId);
        EventData storage eventData = events[eventId];
        if (eventData.state != PolymarketTypes.EventState.Resolved) {
            return 0;
        }
        payout = _previewRedeemPayout(eventData, yesAmount, noAmount);
    }

    /// @notice 读取金库统计指标。
    /// @return vaultBalance 当前金库余额（wei）。
    /// @return totalCollateralIn 累计入金（wei）。
    /// @return totalRedeemed 累计出金（wei）。
    function getVaultMetrics() external view returns (uint256 vaultBalance, uint256 totalCollateralIn, uint256 totalRedeemed) {
        vaultBalance = collateralVault.vaultBalance();
        totalCollateralIn = collateralVault.totalCollateralIn();
        totalRedeemed = collateralVault.totalRedeemed();
    }

    /// @notice 返回核心模块地址集合，便于前端/脚本发现依赖。
    /// @return eventCore 事件核心合约地址。
    /// @return token ERC1155 头寸代币地址。
    /// @return collateral ETH 抵押金库地址。
    /// @return oracleAdapter 结果适配器地址。
    function getModuleAddresses() external view returns (address eventCore, address token, address collateral, address oracleAdapter) {
        eventCore = address(this);
        token = address(positionToken);
        collateral = address(collateralVault);
        oracleAdapter = address(oracle);
    }

    /// @notice 计算赎回兑付金额。
    /// @dev Yes/No 按快照比例分配：`payout = winningAmount * totalPoolSnapshot / winningPoolSnapshot`；
    ///      Invalid 按 1:1 返回：`payout = yesAmount + noAmount`。
    /// @param eventData 当前事件存储引用。
    /// @param yesAmount 提交赎回的 YES 份额。
    /// @param noAmount 提交赎回的 NO 份额。
    /// @return 预估可兑付 ETH（wei）。
    function _previewRedeemPayout(EventData storage eventData, uint256 yesAmount, uint256 noAmount) internal view returns (uint256) {
        if (eventData.finalOutcome == PolymarketTypes.Outcome.Yes) {
            if (yesAmount == 0 || eventData.winningPoolSnapshot == 0) {
                return 0;
            }
            return (yesAmount * eventData.totalPoolSnapshot) / eventData.winningPoolSnapshot;
        }
        if (eventData.finalOutcome == PolymarketTypes.Outcome.No) {
            if (noAmount == 0 || eventData.winningPoolSnapshot == 0) {
                return 0;
            }
            return (noAmount * eventData.totalPoolSnapshot) / eventData.winningPoolSnapshot;
        }
        if (eventData.finalOutcome == PolymarketTypes.Outcome.Invalid) {
            return yesAmount + noAmount;
        }
        return 0;
    }

    /// @notice 统一买入执行逻辑。
    /// @dev 仅 `Open` 状态允许买入；一旦进入 `Proposed`（已提案）立即禁止新增买入。
    /// @param eventId 事件 ID。
    /// @param side 买入方向（YES/NO）。
    function _buyPosition(uint256 eventId, PolymarketTypes.PositionSide side) internal {
        _requireEventExists(eventId);
        require(msg.value > 0, "ZERO_COLLATERAL");

        EventData storage eventData = events[eventId];
        require(eventData.state == PolymarketTypes.EventState.Open, "EVENT_NOT_BUYABLE");

        collateralVault.depositCollateral{value: msg.value}(eventId);

        uint256 tokenId = side == PolymarketTypes.PositionSide.Yes ? yesTokenId(eventId) : noTokenId(eventId);
        positionToken.mint(msg.sender, tokenId, msg.value);

        if (side == PolymarketTypes.PositionSide.Yes) {
            eventData.yesPool += msg.value;
        } else {
            eventData.noPool += msg.value;
        }
        eventData.totalCollateral += msg.value;

        emit PositionBought(eventId, msg.sender, side, msg.value, msg.value, eventData.yesPool, eventData.noPool);
    }

    /// @notice 校验事件是否存在。
    /// @param eventId 事件 ID。
    function _requireEventExists(uint256 eventId) internal view {
        require(eventId > 0 && eventId <= eventCount, "EVENT_NOT_FOUND");
    }

    /// @notice 内部创建事件并初始化状态。
    /// @param question 事件问题文案。
    /// @param closeTime 关闭时间戳（秒）。
    /// @param resolutionSourceURI 外部裁定来源链接。
    /// @param metadataURI 事件展示资料 metadata 链接。
    /// @return eventId 新事件 ID。
    function _createEvent(
        string memory question,
        uint256 closeTime,
        string memory resolutionSourceURI,
        string memory metadataURI
    ) internal returns (uint256 eventId) {
        require(bytes(question).length > 0, "QUESTION_EMPTY");
        require(closeTime > block.timestamp, "ENDTIME_IN_PAST");

        eventId = ++eventCount;
        events[eventId] = EventData({
            question: question,
            closeTime: uint64(closeTime),
            resolutionSourceURI: resolutionSourceURI,
            metadataURI: metadataURI,
            state: PolymarketTypes.EventState.Open,
            finalOutcome: PolymarketTypes.Outcome.Unresolved,
            totalCollateral: 0,
            yesPool: 0,
            noPool: 0,
            totalPoolSnapshot: 0,
            winningPoolSnapshot: 0
        });

        emit EventCreated(eventId, msg.sender, question, uint64(closeTime), resolutionSourceURI, metadataURI);
    }
}
