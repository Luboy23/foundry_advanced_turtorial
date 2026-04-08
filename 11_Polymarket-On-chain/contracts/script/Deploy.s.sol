// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { PositionToken } from "../src/PositionToken.sol";
import { ETHCollateralVault } from "../src/ETHCollateralVault.sol";
import { OracleAdapterMock } from "../src/OracleAdapterMock.sol";
import { EventFactory } from "../src/EventFactory.sol";

interface Vm {
    function startBroadcast() external;

    function stopBroadcast() external;
}

contract Deploy {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (EventFactory factory) {
        return _deploy("ipfs://polymarket/{id}.json");
    }

    function run(string memory positionUriBase) external returns (EventFactory factory) {
        return _deploy(positionUriBase);
    }

    function _deploy(string memory positionUriBase) internal returns (EventFactory factory) {
        vm.startBroadcast();

        PositionToken positionToken = new PositionToken(positionUriBase);
        ETHCollateralVault collateralVault = new ETHCollateralVault();
        OracleAdapterMock oracleAdapter = new OracleAdapterMock();
        factory = new EventFactory(positionToken, collateralVault, oracleAdapter);

        positionToken.setCore(address(factory));
        collateralVault.setOperator(address(factory));
        oracleAdapter.setOperator(address(factory));

        vm.stopBroadcast();
    }
}
