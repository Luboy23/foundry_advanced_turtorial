// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { DownManScoreboard } from "../src/DownManScoreboard.sol";

interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

/// @notice Foundry 部署脚本：部署 DownManScoreboard 并把结果写入 broadcast 目录
contract Deploy {
    Vm private constant vm =
        Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (DownManScoreboard deployed) {
        vm.startBroadcast();
        deployed = new DownManScoreboard();
        vm.stopBroadcast();
    }
}
