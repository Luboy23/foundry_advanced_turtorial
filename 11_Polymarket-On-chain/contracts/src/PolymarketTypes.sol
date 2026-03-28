// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title PolymarketTypes
/// @notice 预测事件核心类型集合，供各模块共享结构与枚举定义。
library PolymarketTypes {
    /// @notice 事件最终结果。
    /// @dev `Unresolved` 表示尚未最终化；`Invalid` 表示结果无效并按规则走退款路径。
    enum Outcome {
        Unresolved,
        Yes,
        No,
        Invalid
    }

    /// @notice 事件生命周期状态。
    /// @dev 当前主流程为 `Open -> Proposed -> Resolved`，`Closed` 仅为兼容保留位。
    enum EventState {
        Open,
        Closed,
        Proposed,
        Resolved
    }

    /// @notice 二元头寸方向。
    enum PositionSide {
        Yes,
        No
    }

    /// @notice 事件创建参数。
    struct EventConfig {
        /// @notice 事件问题文案。
        string question;
        /// @notice 截止时间戳（秒）。
        uint64 closeTime;
        /// @notice 外部裁定规则/来源链接。
        string resolutionSourceURI;
        /// @notice 事件展示资料 metadata 链接。
        string metadataURI;
    }

    /// @notice 结算提案状态（无争议版预言机）。
    struct ResolutionState {
        /// @notice 发起提案的钱包地址。
        address proposer;
        /// @notice 已提议的结果。
        Outcome proposedOutcome;
        /// @notice 提案时间戳（秒）。
        uint64 proposedAt;
        /// @notice 是否已有提案。
        bool proposed;
        /// @notice 是否已最终化。
        bool finalized;
        /// @notice 最早可最终化时间戳（秒）。
        uint64 canFinalizeAt;
    }
}
