// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "openzeppelin-contracts/access/Ownable.sol";

import {PolymarketTypes} from "./PolymarketTypes.sol";

/// @title OracleAdapterMock
/// @notice 无争议流程的结果适配器：提案 -> 冷静期 -> 最终化。
contract OracleAdapterMock is Ownable {
    /// @notice 结果提案后的冷静期时长。
    uint256 public constant LIVENESS = 30 seconds;

    /// @notice 被授权执行提案/最终化的核心合约地址。
    address public operator;
    /// @notice 按 eventId 存储结算提案状态。
    mapping(uint256 => PolymarketTypes.ResolutionState) private resolutionStates;

    /// @notice 更新 operator 地址时触发。
    /// @param previousOperator 更新前地址。
    /// @param newOperator 更新后地址。
    event OperatorUpdated(address indexed previousOperator, address indexed newOperator);

    /// @notice 新提案写入时触发。
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

    /// @notice 结果最终化时触发。
    /// @param eventId 事件 ID。
    /// @param outcome 最终结果。
    /// @param finalizedAt 最终化时间戳（秒）。
    event ResolutionFinalized(uint256 indexed eventId, PolymarketTypes.Outcome outcome, uint64 finalizedAt);

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

    /// @notice 提交事件结果提案并记录冷静期。
    /// @dev 同一事件只允许一次提案；结果不能是 `Unresolved`。
    /// @param eventId 事件 ID。
    /// @param proposer 提案发起人地址。
    /// @param outcome 提案结果。
    /// @return proposedAt 提案时间戳（秒）。
    /// @return canFinalizeAt 最早可最终化时间戳（秒）。
    function proposeResolution(uint256 eventId, address proposer, PolymarketTypes.Outcome outcome)
        external
        onlyOperator
        returns (uint64 proposedAt, uint64 canFinalizeAt)
    {
        PolymarketTypes.ResolutionState storage state = resolutionStates[eventId];

        require(!state.proposed, "ALREADY_PROPOSED");
        require(outcome != PolymarketTypes.Outcome.Unresolved, "INVALID_OUTCOME");

        proposedAt = uint64(block.timestamp);
        canFinalizeAt = uint64(block.timestamp + LIVENESS);

        state.proposer = proposer;
        state.proposedOutcome = outcome;
        state.proposedAt = proposedAt;
        state.proposed = true;
        state.finalized = false;
        state.canFinalizeAt = canFinalizeAt;

        emit ResolutionProposed(eventId, proposer, outcome, proposedAt, canFinalizeAt);
    }

    /// @notice 在冷静期后确认最终结果。
    /// @param eventId 事件 ID。
    /// @return outcome 最终结果。
    function finalizeResolution(uint256 eventId) external onlyOperator returns (PolymarketTypes.Outcome outcome) {
        PolymarketTypes.ResolutionState storage state = resolutionStates[eventId];

        require(state.proposed, "NOT_PROPOSED");
        require(!state.finalized, "ALREADY_FINALIZED");
        require(block.timestamp >= state.canFinalizeAt, "LIVENESS_NOT_PASSED");

        state.finalized = true;
        outcome = state.proposedOutcome;

        emit ResolutionFinalized(eventId, outcome, uint64(block.timestamp));
    }

    /// @notice 读取事件提案状态。
    /// @param eventId 事件 ID。
    /// @return 指定事件的提案状态快照。
    function getResolutionState(uint256 eventId) external view returns (PolymarketTypes.ResolutionState memory) {
        return resolutionStates[eventId];
    }
}
