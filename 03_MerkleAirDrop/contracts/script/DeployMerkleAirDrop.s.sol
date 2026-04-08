// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LLCAirDrop} from "../src/LLCAirDrop.sol";
import {LuLuCoin} from "../src/LuLuCoin.sol";

contract DeployMerkleAirDrop is Script {
    function run() external returns (LuLuCoin luluCoin, LLCAirDrop airdrop) {
        uint256 ownerPrivateKey = vm.envUint("OWNER_SK");
        address ownerAddress = vm.envAddress("OWNER_PK");
        bytes32 merkleRoot = vm.envBytes32("MERKLE_ROOT");
        uint256 totalAmount = vm.envUint("TOTAL_AMOUNT");

        vm.startBroadcast(ownerPrivateKey);
        luluCoin = new LuLuCoin(ownerAddress);
        airdrop = new LLCAirDrop(merkleRoot, IERC20(address(luluCoin)));
        luluCoin.mint(totalAmount);
        luluCoin.transfer(address(airdrop), totalAmount);
        vm.stopBroadcast();
    }
}
