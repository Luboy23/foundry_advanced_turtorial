// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {MyNFT} from "../src/MyNFT.sol";
import {FixedPriceMarket} from "../src/FixedPriceMarket.sol";

interface Vm {
    function startBroadcast() external;

    function stopBroadcast() external;
}

contract Deploy {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (MyNFT nft, FixedPriceMarket market) {
        vm.startBroadcast();
        nft = new MyNFT("LuLuNFT", "LULU");
        market = new FixedPriceMarket(address(nft));
        vm.stopBroadcast();
    }
}
