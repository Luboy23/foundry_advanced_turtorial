// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {SessionAccount} from "./SessionAccount.sol";

/// @title SessionAccountFactory
/// @notice 为每个主钱包地址创建并维护唯一的会话智能账户。
/// @dev 同一 owner 始终复用同一个 SessionAccount，避免重复部署。
contract SessionAccountFactory {
    /// @notice owner => session account 地址映射。
    mapping(address => address) public accountOf;
    /// @notice session account => owner 反向映射。
    mapping(address => address) public ownerOfAccount;

    event AccountCreated(address indexed owner, address indexed account);
    event RoundSetup(
        address indexed owner,
        address indexed account,
        address indexed target,
        address sessionKey,
        uint64 expiresAt,
        uint32 maxCalls,
        uint96 prefundAmount
    );
    event SessionRefreshed(
        address indexed owner,
        address indexed account,
        address indexed target,
        address sessionKey,
        uint64 expiresAt,
        uint32 maxCalls,
        uint96 prefundAmount
    );

    /// @notice 开启新一局并配置会话权限。
    /// @dev 若账户不存在会自动创建，存在则复用；调用会透传 msg.value 到账户。
    /// @param target 业务合约地址（本项目为 TicTacToe）。
    /// @param openingCallData 开局时要执行的业务调用数据。
    /// @param config 会话配置（会话 key、到期时间、可调用方法等）。
    /// @return account 本次使用的会话账户地址。
    /// @return result openingCallData 的执行返回数据。
    function setupRound(
        address target,
        bytes calldata openingCallData,
        SessionAccount.SessionConfigInput calldata config
    ) external payable returns (address account, bytes memory result) {
        account = _getOrCreateAccount(msg.sender);
        result = SessionAccount(payable(account)).setupRoundFromFactory{
            value: msg.value
        }(msg.sender, target, openingCallData, config);

        emit RoundSetup(
            msg.sender,
            account,
            target,
            config.sessionKey,
            config.expiresAt,
            config.maxCalls,
            config.prefundAmount
        );
    }

    /// @notice 刷新当前 owner 的会话配置。
    /// @dev 若账户不存在会自动创建；若已存在则覆盖会话参数并重置会话状态。
    /// @param target 业务合约地址（本项目为 TicTacToe）。
    /// @param config 新会话配置。
    /// @return account 刷新后的会话账户地址。
    function refreshSession(
        address target,
        SessionAccount.SessionConfigInput calldata config
    ) external payable returns (address account) {
        account = _getOrCreateAccount(msg.sender);
        SessionAccount(payable(account)).refreshSessionFromFactory{
            value: msg.value
        }(msg.sender, target, config);

        emit SessionRefreshed(
            msg.sender,
            account,
            target,
            config.sessionKey,
            config.expiresAt,
            config.maxCalls,
            config.prefundAmount
        );
    }

    /// @dev 获取或创建 owner 对应的唯一会话账户。
    /// @param owner 主钱包地址。
    /// @return account 已存在或新创建的会话账户地址。
    function _getOrCreateAccount(address owner) internal returns (address) {
        address account = accountOf[owner];
        if (account != address(0)) {
            return account;
        }

        SessionAccount created = new SessionAccount(owner, address(this));
        account = address(created);
        accountOf[owner] = account;
        ownerOfAccount[account] = owner;
        emit AccountCreated(owner, account);
        return account;
    }
}
