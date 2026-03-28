// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "openzeppelin-contracts/access/Ownable.sol";

import {PolymarketTypes} from "./PolymarketTypes.sol";

/// @title OracleAdapterDisputeMock
/// @notice 带争议窗口的结果适配器：提案 -> 争议 -> 冷静期后最终化。
/// @dev 一旦被争议，最终结果统一降级为 `Invalid`。
contract OracleAdapterDisputeMock is Ownable {
    /// @notice 提案后最短冷静期。
    uint256 public constant LIVENESS = 30 seconds;
    /// @notice 允许发起争议的时间窗口。
    uint256 public constant DISPUTE_WINDOW = 1 hours;

    /// @notice 被授权执行提案/争议/最终化的核心合约地址。
    address public operator;

    /// @notice 单个事件的争议状态。
    struct DisputeState {
        /// @notice 提案发起人地址。
        address proposer;
        /// @notice 被提议的结果。
        PolymarketTypes.Outcome proposedOutcome;
        /// @notice 提案时间戳（秒）。
        uint64 proposedAt;
        /// @notice 最早可最终化时间戳（秒）。
        uint64 canFinalizeAt;
        /// @notice 争议截止时间戳（秒）。
        uint64 disputeDeadline;
        /// @notice 是否已提交提案。
        bool proposed;
        /// @notice 是否已被争议。
        bool disputed;
        /// @notice 是否已最终化。
        bool finalized;
        /// @notice 争议者地址。
        address challenger;
        /// @notice 争议保证金金额（wei）。
        uint256 challengeBond;
    }

    /// @notice 按 eventId 存储争议状态。
    mapping(uint256 => DisputeState) private disputeStates;

    /// @notice 更新 operator 地址时触发。
    /// @param previousOperator 更新前地址。
    /// @param newOperator 更新后地址。
    event OperatorUpdated(address indexed previousOperator, address indexed newOperator);

    /// @notice 提案写入时触发。
    /// @param eventId 事件 ID。
    /// @param proposer 提案地址。
    /// @param outcome 提案结果。
    /// @param proposedAt 提案时间戳（秒）。
    /// @param canFinalizeAt 最早可最终化时间戳（秒）。
    /// @param disputeDeadline 争议截止时间戳（秒）。
    event ResolutionProposed(
        uint256 indexed eventId,
        address indexed proposer,
        PolymarketTypes.Outcome outcome,
        uint64 proposedAt,
        uint64 canFinalizeAt,
        uint64 disputeDeadline
    );

    /// @notice 争议发起时触发。
    /// @param eventId 事件 ID。
    /// @param challenger 争议者地址。
    /// @param bond 争议保证金（wei）。
    event ResolutionDisputed(uint256 indexed eventId, address indexed challenger, uint256 bond);

    /// @notice 最终化时触发。
    /// @param eventId 事件 ID。
    /// @param outcome 最终结果。
    /// @param disputed 是否经历争议。
    /// @param finalizedAt 最终化时间戳（秒）。
    event ResolutionFinalized(uint256 indexed eventId, PolymarketTypes.Outcome outcome, bool disputed, uint64 finalizedAt);

    /// @notice 仅允许 operator 调用。
    modifier onlyOperator() {
        require(msg.sender == operator, "ONLY_OPERATOR");
        _;
    }

    /// @notice 设置 operator 地址。
    /// @dev 仅 owner 可调用；禁止零地址。
    /// @param newOperator 新 operator 地址。
    function setOperator(address newOperator) external onlyOwner {
        require(newOperator != address(0), "ZERO_ADDRESS");
        address previous = operator;
        operator = newOperator;
        emit OperatorUpdated(previous, newOperator);
    }

    /// @notice 提交事件结果提案并写入争议窗口。
    /// @param eventId 事件 ID。
    /// @param proposer 提案发起人地址。
    /// @param outcome 提案结果。
    /// @return proposedAt 提案时间戳（秒）。
    /// @return canFinalizeAt 最早可最终化时间戳（秒）。
    /// @return disputeDeadline 争议截止时间戳（秒）。
    function proposeResolution(uint256 eventId, address proposer, PolymarketTypes.Outcome outcome)
        external
        onlyOperator
        returns (uint64 proposedAt, uint64 canFinalizeAt, uint64 disputeDeadline)
    {
        DisputeState storage state = disputeStates[eventId];

        require(!state.proposed, "ALREADY_PROPOSED");
        require(outcome != PolymarketTypes.Outcome.Unresolved, "INVALID_OUTCOME");

        proposedAt = uint64(block.timestamp);
        canFinalizeAt = uint64(block.timestamp + LIVENESS);
        disputeDeadline = uint64(block.timestamp + DISPUTE_WINDOW);

        state.proposer = proposer;
        state.proposedOutcome = outcome;
        state.proposedAt = proposedAt;
        state.canFinalizeAt = canFinalizeAt;
        state.disputeDeadline = disputeDeadline;
        state.proposed = true;

        emit ResolutionProposed(eventId, proposer, outcome, proposedAt, canFinalizeAt, disputeDeadline);
    }

    /// @notice 发起争议并记录挑战信息。
    /// @dev 仅在争议窗口内可执行，且每个事件只接受一次争议。
    /// @param eventId 事件 ID。
    /// @param challenger 争议者地址。
    function disputeResolution(uint256 eventId, address challenger) external payable onlyOperator {
        DisputeState storage state = disputeStates[eventId];

        require(state.proposed, "NOT_PROPOSED");
        require(!state.finalized, "ALREADY_FINALIZED");
        require(!state.disputed, "ALREADY_DISPUTED");
        require(block.timestamp <= state.disputeDeadline, "DISPUTE_WINDOW_PASSED");
        require(challenger != address(0), "ZERO_ADDRESS");

        state.disputed = true;
        state.challenger = challenger;
        state.challengeBond = msg.value;

        emit ResolutionDisputed(eventId, challenger, msg.value);
    }

    /// @notice 在冷静期后最终化结果。
    /// @dev 若提案曾被争议，则结果自动降级为 `Invalid`。
    /// @param eventId 事件 ID。
    /// @return outcome 最终结果。
    function finalizeResolution(uint256 eventId) external onlyOperator returns (PolymarketTypes.Outcome outcome) {
        DisputeState storage state = disputeStates[eventId];

        require(state.proposed, "NOT_PROPOSED");
        require(!state.finalized, "ALREADY_FINALIZED");
        require(block.timestamp >= state.canFinalizeAt, "LIVENESS_NOT_PASSED");

        state.finalized = true;

        if (state.disputed) {
            outcome = PolymarketTypes.Outcome.Invalid;
        } else {
            outcome = state.proposedOutcome;
        }

        emit ResolutionFinalized(eventId, outcome, state.disputed, uint64(block.timestamp));
    }

    /// @notice 读取事件争议状态。
    /// @param eventId 事件 ID。
    /// @return 指定事件的争议状态快照。
    function getDisputeState(uint256 eventId) external view returns (DisputeState memory) {
        return disputeStates[eventId];
    }
}
