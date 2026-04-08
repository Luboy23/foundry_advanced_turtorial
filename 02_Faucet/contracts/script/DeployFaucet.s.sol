// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {LuLuCoin} from "../src/LuLuCoin.sol";
import {LLCFaucet} from "../src/LLCFaucet.sol";

contract DeployFaucet is Script {
    function run() external returns (LuLuCoin luluCoin, LLCFaucet faucet) {
        uint256 ownerPrivateKey = vm.envUint("OWNER_PRIVATE_KEY");
        address ownerAddress = vm.envAddress("OWNER_ADDRESS");
        uint256 dripInterval = vm.envUint("DRIP_INTERVAL");
        uint256 dripLimit = vm.envUint("DRIP_LIMIT");
        uint256 mintAmount = vm.envUint("MINT_AMOUNT");
        uint256 depositAmount = vm.envUint("DEPOSIT_AMOUNT");

        vm.startBroadcast(ownerPrivateKey);
        luluCoin = new LuLuCoin(ownerAddress);
        faucet = new LLCFaucet(address(luluCoin), dripInterval, dripLimit, ownerAddress);
        luluCoin.mint(mintAmount);
        luluCoin.approve(address(faucet), depositAmount);
        faucet.deposit(depositAmount);
        vm.stopBroadcast();
    }
}
