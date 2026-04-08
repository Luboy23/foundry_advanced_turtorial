// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {TicTacToe} from "../src/TicTacToe.sol";
import {SessionAccountFactory} from "../src/SessionAccountFactory.sol";

interface Vm {
    function startBroadcast() external;

    function stopBroadcast() external;
}

contract Deploy {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (TicTacToe ticTacToe, SessionAccountFactory factory) {
        vm.startBroadcast();
        ticTacToe = new TicTacToe();
        factory = new SessionAccountFactory();
        vm.stopBroadcast();
    }
}
