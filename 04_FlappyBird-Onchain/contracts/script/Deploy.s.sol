// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {FlappyScoreboard} from "../src/FlappyScoreboard.sol";

contract Deploy is Script {
    function run() external returns (FlappyScoreboard scoreboard) {
        vm.startBroadcast();
        scoreboard = new FlappyScoreboard();
        vm.stopBroadcast();
    }
}
