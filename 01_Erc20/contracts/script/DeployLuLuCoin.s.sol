// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {LuLuCoin} from "../src/LuLuCoin.sol";

contract DeployLuLuCoin is Script {
    function run() external returns (LuLuCoin luluCoin) {
        uint256 ownerPrivateKey = vm.envUint("OWNER_PRIVATE_KEY");
        address ownerAddress = vm.envAddress("OWNER_ADDRESS");

        vm.startBroadcast(ownerPrivateKey);
        luluCoin = new LuLuCoin(ownerAddress);
        vm.stopBroadcast();
    }
}
