// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {OnChain2048Scores} from "../src/OnChain2048Scores.sol";

interface Vm {
    function startBroadcast() external;

    function stopBroadcast() external;
}

contract Deploy {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (OnChain2048Scores scoreboard) {
        vm.startBroadcast();
        scoreboard = new OnChain2048Scores();
        vm.stopBroadcast();
    }
}
