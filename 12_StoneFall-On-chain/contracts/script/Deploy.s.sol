// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { StoneFallScoreboard } from "../src/StoneFallScoreboard.sol";

interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

/// @notice Foundry 部署脚本：部署 StoneFallScoreboard 并把结果写入 broadcast 目录
contract Deploy {
    Vm private constant vm =
        Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (StoneFallScoreboard deployed) {
        vm.startBroadcast();
        deployed = new StoneFallScoreboard();
        vm.stopBroadcast();
    }
}
