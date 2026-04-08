// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { BinaryEventCore } from "./BinaryEventCore.sol";
import { PositionToken } from "./PositionToken.sol";
import { ETHCollateralVault } from "./ETHCollateralVault.sol";
import { OracleAdapterMock } from "./OracleAdapterMock.sol";

/// @title EventFactory
/// @notice 事件统一入口合约，继承并暴露核心交互能力。
contract EventFactory is BinaryEventCore {
    /// @notice 初始化核心依赖模块。
    /// @param _positionToken ERC1155 头寸代币合约。
    /// @param _collateralVault ETH 抵押金库合约。
    /// @param _oracle 结果提案/最终化适配器。
    constructor(PositionToken _positionToken, ETHCollateralVault _collateralVault, OracleAdapterMock _oracle)
        BinaryEventCore(_positionToken, _collateralVault, _oracle)
    { }
}
