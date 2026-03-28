// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { StoneFallScoreboard } from "../src/StoneFallScoreboard.sol";

interface Vm {
    function envUint(string calldata name) external returns (uint256);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

/// @notice Foundry 部署脚本：从 PRIVATE_KEY 读取部署账户并部署 StoneFallScoreboard
contract Deploy {
    Vm private constant vm =
        Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (StoneFallScoreboard deployed) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);
        deployed = new StoneFallScoreboard();
        vm.stopBroadcast();
    }
}
