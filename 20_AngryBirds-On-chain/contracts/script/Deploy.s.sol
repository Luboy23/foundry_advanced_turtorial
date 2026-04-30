// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { AngryBirdsLevelCatalog } from "../src/AngryBirdsLevelCatalog.sol";
import { AngryBirdsScoreboard } from "../src/AngryBirdsScoreboard.sol";

interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract Deploy {
    Vm private constant vm =
        Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run()
        external
        returns (
            AngryBirdsLevelCatalog catalog,
            AngryBirdsScoreboard scoreboard
        )
    {
        return run("local-dev");
    }

    function run(string memory deploymentId)
        public
        returns (
            AngryBirdsLevelCatalog catalog,
            AngryBirdsScoreboard scoreboard
        )
    {
        return _deploy(deploymentId, tx.origin);
    }

    function _deploy(string memory deploymentId, address initialVerifier)
        private
        returns (
            AngryBirdsLevelCatalog catalog,
            AngryBirdsScoreboard scoreboard
        )
    {
        vm.startBroadcast();

        catalog = new AngryBirdsLevelCatalog();
        scoreboard = new AngryBirdsScoreboard(
            address(catalog),
            initialVerifier,
            deploymentId
        );

        vm.stopBroadcast();
    }
}
