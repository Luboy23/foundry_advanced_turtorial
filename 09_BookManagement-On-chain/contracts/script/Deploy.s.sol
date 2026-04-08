// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BookManagement} from "../src/BookManagement.sol";

interface Vm {
    function startBroadcast() external;

    function stopBroadcast() external;
}

contract Deploy {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (BookManagement registry) {
        vm.startBroadcast();
        registry = new BookManagement();
        vm.stopBroadcast();
    }
}
