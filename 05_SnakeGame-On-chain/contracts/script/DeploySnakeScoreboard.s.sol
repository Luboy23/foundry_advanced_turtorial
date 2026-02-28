// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/SnakeScoreboard.sol";

/// @notice Foundry 部署脚本：部署 SnakeScoreboard 合约
contract DeploySnakeScoreboard is Script {
    /// @notice 脚本入口：开始广播并部署合约
    function run() external {
        vm.startBroadcast();
        new SnakeScoreboard();
        vm.stopBroadcast();
    }
}
