// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "openzeppelin-contracts/access/Ownable.sol";

/// @title ETHCollateralVault
/// @notice ETH 抵押金库：仅授权 operator 可入金和出金。
/// @dev 该合约只负责资金托管与统计，不承担业务判定逻辑。
contract ETHCollateralVault is Ownable {
    /// @notice 可执行入金/出金操作的核心合约地址。
    address public operator;
    /// @notice 历史累计入金总额（wei）。
    uint256 public totalCollateralIn;
    /// @notice 历史累计出金总额（wei）。
    uint256 public totalRedeemed;

    /// @notice 更新 operator 地址时触发。
    /// @param previousOperator 更新前地址。
    /// @param newOperator 更新后地址。
    event OperatorUpdated(address indexed previousOperator, address indexed newOperator);
    /// @notice 事件收到新抵押时触发。
    /// @param eventId 事件 ID。
    /// @param amount 本次入金金额（wei）。
    event CollateralDeposited(uint256 indexed eventId, uint256 amount);
    /// @notice 向用户出金时触发。
    /// @param eventId 事件 ID。
    /// @param to 收款地址。
    /// @param amount 本次出金金额（wei）。
    event CollateralPaidOut(uint256 indexed eventId, address indexed to, uint256 amount);

    /// @notice 仅允许 operator 调用。
    modifier onlyOperator() {
        require(msg.sender == operator, "ONLY_OPERATOR");
        _;
    }

    /// @notice 设置核心 operator 地址。
    /// @dev 仅 owner 可调用；禁止零地址。
    /// @param newOperator 新 operator 地址。
    function setOperator(address newOperator) external onlyOwner {
        require(newOperator != address(0), "ZERO_ADDRESS");
        address previous = operator;
        operator = newOperator;
        emit OperatorUpdated(previous, newOperator);
    }

    /// @notice 记录并接收事件抵押资金。
    /// @dev 仅 operator 可调用，且金额必须大于 0。
    /// @param eventId 事件 ID。
    function depositCollateral(uint256 eventId) external payable onlyOperator {
        require(msg.value > 0, "ZERO_COLLATERAL");
        totalCollateralIn += msg.value;
        emit CollateralDeposited(eventId, msg.value);
    }

    /// @notice 向指定地址支付 ETH。
    /// @dev 仅 operator 可调用；执行前校验余额充足。
    /// @param to 收款地址。
    /// @param eventId 事件 ID。
    /// @param amount 出金金额（wei）。
    function payout(address to, uint256 eventId, uint256 amount) external onlyOperator {
        require(to != address(0), "ZERO_ADDRESS");
        require(amount > 0, "ZERO_PAYOUT");
        require(address(this).balance >= amount, "VAULT_INSUFFICIENT_BALANCE");

        totalRedeemed += amount;
        (bool success,) = to.call{value: amount}("");
        require(success, "TRANSFER_FAILED");

        emit CollateralPaidOut(eventId, to, amount);
    }

    /// @notice 返回当前金库 ETH 余额。
    /// @return 当前合约余额（wei）。
    function vaultBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
