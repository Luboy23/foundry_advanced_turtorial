// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { BraveManGame } from "../src/BraveManGame.sol";

/// @dev 最小化 Vm 接口声明，仅保留部署脚本会使用到的 cheatcode。
interface Vm {
    /// @dev 从环境变量读取 uint256；变量缺失时会在脚本阶段报错。
    function envUint(string calldata name) external returns (uint256);
    /// @dev 从环境变量读取 address；变量格式非法会直接失败。
    function envAddress(string calldata name) external returns (address);
    /// @dev 开始以指定私钥广播交易。
    function startBroadcast(uint256 privateKey) external;
    /// @dev 停止广播交易，恢复到本地调用上下文。
    function stopBroadcast() external;
}

contract Deploy {
    /// @dev Forge 固定的 hevm cheatcode 地址。
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    /// @notice 读取环境变量并部署 BraveManGame 合约。
    /// @dev
    /// 部署依赖三项环境变量：
    /// 1) PRIVATE_KEY：脚本广播使用的部署者私钥；
    /// 2) API_SIGNER_ADDRESS：后端 EIP-712 结算签名地址；
    /// 3) INITIAL_OWNER：初始治理地址（可更新 signer 等）。
    /// 参数顺序必须与合约构造函数 `(initialOwner, initialSigner)` 保持一致。
    /// @return deployed 新部署的合约实例
    function run() external returns (BraveManGame deployed) {
        // 部署者私钥：用于 forge script 广播交易。
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        // 后端签名地址：用于链上校验 EIP-712 结算签名。
        address signer = vm.envAddress("API_SIGNER_ADDRESS");
        // 初始 owner：拥有 updateSigner 等管理权限。
        address owner = vm.envAddress("INITIAL_OWNER");

        vm.startBroadcast(deployerKey);
        // 构造参数顺序必须与合约构造函数完全一致。
        deployed = new BraveManGame(owner, signer);
        vm.stopBroadcast();
    }
}
