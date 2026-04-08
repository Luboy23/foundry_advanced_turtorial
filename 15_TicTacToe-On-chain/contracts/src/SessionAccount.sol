// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SessionAccount
/// @notice 轻量会话智能账户：允许在受限范围内以会话 key 免签执行目标合约调用。
/// @dev 所有会话启停与刷新均由工厂触发，owner 仅负责失效会话。
contract SessionAccount {
    /// @notice 工厂传入的会话配置结构。
    struct SessionConfigInput {
        address sessionKey;
        uint64 expiresAt;
        uint32 maxCalls;
        bytes4[] allowedSelectors;
        uint96 prefundAmount;
    }

    address public immutable owner;
    address public immutable factory;

    address public sessionKey;
    address public sessionTarget;
    uint64 public sessionExpiresAt;
    uint32 public sessionMaxCalls;
    uint32 public sessionCallsUsed;
    bool public sessionActive;

    mapping(bytes4 => bool) public sessionSelectorAllowed;
    bytes4[] private selectorList;

    error NotOwner();
    error NotFactory();
    error InvalidOwner();
    error InvalidTarget();
    error InvalidSessionKey();
    error InvalidExpiry();
    error InvalidMaxCalls();
    error EmptySelectorList();
    error SessionInactive();
    error SessionExpired();
    error WrongSessionKey();
    error MaxCallsReached();
    error SelectorNotAllowed();
    error InvalidCalldata();
    error PrefundTransferFailed();

    event SessionEnabled(
        address indexed sessionKey,
        address indexed target,
        uint64 expiresAt,
        uint32 maxCalls
    );
    event SessionDisabled();
    event SessionPrefunded(address indexed sessionKey, uint96 amount);
    event SessionCallExecuted(
        address indexed sessionKey,
        address indexed target,
        bytes4 selector,
        uint32 callsUsed,
        uint32 maxCalls
    );

    /// @notice 部署会话账户并绑定 owner 与 factory。
    /// @param owner_ 会话账户的控制者（主钱包）。
    /// @param factory_ 工厂地址，仅该地址可执行工厂入口函数。
    constructor(address owner_, address factory_) payable {
        if (owner_ == address(0)) revert InvalidOwner();
        owner = owner_;
        factory = factory_;
    }

    /// @notice 允许账户接收 ETH，用于会话预充值等场景。
    receive() external payable {}

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyFactory() {
        if (msg.sender != factory) revert NotFactory();
        _;
    }

    /// @notice 工厂入口：开启回合并立即执行开局调用。
    /// @dev 会先启用会话，再执行 openingCallData；若目标调用失败将原样回滚。
    /// @param owner_ 期望的 owner 地址，需与构造时 owner 一致。
    /// @param target 业务合约地址。
    /// @param openingCallData 开局调用数据。
    /// @param config 会话配置参数。
    /// @return result openingCallData 执行返回数据。
    function setupRoundFromFactory(
        address owner_,
        address target,
        bytes calldata openingCallData,
        SessionConfigInput calldata config
    ) external payable onlyFactory returns (bytes memory result) {
        if (owner_ != owner) revert InvalidOwner();

        _enableSession(target, config);

        // 将目标调用失败原因原样抛出，便于前端直观展示失败原因。
        result = _call(target, openingCallData);

        if (config.prefundAmount > 0) {
            _prefundSessionKey(config.sessionKey, config.prefundAmount);
        }
    }

    /// @notice 工厂入口：刷新现有会话配置，不执行开局调用。
    /// @param owner_ 期望的 owner 地址。
    /// @param target 业务合约地址。
    /// @param config 新会话配置。
    function refreshSessionFromFactory(
        address owner_,
        address target,
        SessionConfigInput calldata config
    ) external payable onlyFactory {
        if (owner_ != owner) revert InvalidOwner();
        _enableSession(target, config);

        if (config.prefundAmount > 0) {
            _prefundSessionKey(config.sessionKey, config.prefundAmount);
        }
    }

    /// @notice owner 主动失效当前会话。
    /// @dev 常用于风控或用户主动结束免签授权。
    function invalidateSession() external onlyOwner {
        _disableSession();
    }

    /// @notice 通过会话 key 在受限范围内执行目标合约调用。
    /// @dev 会校验会话是否激活、是否过期、调用次数、目标地址与方法白名单。
    /// @param target 目标业务合约地址。
    /// @param data 目标函数 calldata。
    /// @return result 目标调用返回数据。
    function executeWithSession(
        address target,
        bytes calldata data
    ) external returns (bytes memory result) {
        if (!sessionActive) revert SessionInactive();
        if (block.timestamp > sessionExpiresAt) revert SessionExpired();
        if (msg.sender != sessionKey) revert WrongSessionKey();
        if (sessionCallsUsed >= sessionMaxCalls) revert MaxCallsReached();
        if (target != sessionTarget) revert InvalidTarget();
        if (data.length < 4) revert InvalidCalldata();

        bytes4 selector;
        assembly {
            selector := calldataload(data.offset)
        }
        if (!sessionSelectorAllowed[selector]) revert SelectorNotAllowed();

        sessionCallsUsed += 1;
        result = _call(target, data);

        emit SessionCallExecuted(
            msg.sender,
            target,
            selector,
            sessionCallsUsed,
            sessionMaxCalls
        );

        if (sessionCallsUsed >= sessionMaxCalls) {
            _disableSession();
        }
    }

    /// @notice 返回当前会话允许调用的方法选择器列表。
    function getAllowedSelectors() external view returns (bytes4[] memory) {
        return selectorList;
    }

    /// @dev 启用会话并写入全部约束参数。
    /// @param target 目标业务合约地址。
    /// @param config 会话配置。
    function _enableSession(
        address target,
        SessionConfigInput calldata config
    ) internal {
        if (target == address(0)) revert InvalidTarget();
        if (config.sessionKey == address(0)) revert InvalidSessionKey();
        if (config.expiresAt <= block.timestamp) revert InvalidExpiry();
        if (config.maxCalls == 0) revert InvalidMaxCalls();
        if (config.allowedSelectors.length == 0) revert EmptySelectorList();

        _clearSelectors();

        sessionKey = config.sessionKey;
        sessionTarget = target;
        sessionExpiresAt = config.expiresAt;
        sessionMaxCalls = config.maxCalls;
        sessionCallsUsed = 0;
        sessionActive = true;

        for (uint256 i = 0; i < config.allowedSelectors.length; i++) {
            bytes4 selector = config.allowedSelectors[i];
            if (!sessionSelectorAllowed[selector]) {
                sessionSelectorAllowed[selector] = true;
                selectorList.push(selector);
            }
        }

        emit SessionEnabled(
            config.sessionKey,
            target,
            config.expiresAt,
            config.maxCalls
        );
    }

    /// @dev 向会话 key 预充值 ETH，减少后续执行交易的中断风险。
    /// @param key 会话 key 地址。
    /// @param amount 预充值金额（wei）。
    function _prefundSessionKey(address key, uint96 amount) internal {
        (bool success, ) = payable(key).call{value: amount}("");
        if (!success) revert PrefundTransferFailed();
        emit SessionPrefunded(key, amount);
    }

    /// @dev 关闭会话并清空全部会话态字段。
    function _disableSession() internal {
        if (!sessionActive) return;

        _clearSelectors();
        sessionActive = false;
        sessionKey = address(0);
        sessionTarget = address(0);
        sessionExpiresAt = 0;
        sessionMaxCalls = 0;
        sessionCallsUsed = 0;

        emit SessionDisabled();
    }

    /// @dev 清空选择器白名单映射与列表，避免旧会话权限残留。
    function _clearSelectors() internal {
        uint256 len = selectorList.length;
        for (uint256 i = 0; i < len; i++) {
            delete sessionSelectorAllowed[selectorList[i]];
        }
        delete selectorList;
    }

    /// @dev 底层调用封装：若失败则透传原始 revert 数据。
    /// @param target 目标地址。
    /// @param data 调用数据。
    /// @return result 调用返回值。
    function _call(
        address target,
        bytes calldata data
    ) internal returns (bytes memory result) {
        (bool success, bytes memory returnData) = target.call(data);
        if (!success) {
            assembly {
                revert(add(returnData, 32), mload(returnData))
            }
        }
        return returnData;
    }
}
