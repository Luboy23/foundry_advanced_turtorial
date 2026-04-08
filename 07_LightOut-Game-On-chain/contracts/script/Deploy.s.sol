// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import { LightsOutResults } from "../src/LightsOutResults.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        new LightsOutResults();
        vm.stopBroadcast();
    }
}
