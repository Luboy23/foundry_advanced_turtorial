// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";
import {FlappyScoreboard} from "../src/FlappyScoreboard.sol";

/// @notice Foundry 脚本：部署 FlappyScoreboard 合约
contract FlappyScoreboardScript is Script {
    /// @notice 部署后的合约实例
    FlappyScoreboard public scoreboard;

    /// @notice 预留的 setUp（当前无额外逻辑）
    function setUp() public {}

    /// @notice 运行脚本：开启广播并部署合约
    function run() public {
        vm.startBroadcast();
        scoreboard = new FlappyScoreboard();
        vm.stopBroadcast();
    }
}
