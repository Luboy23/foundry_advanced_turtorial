// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { PolymarketTypes } from "../src/PolymarketTypes.sol";
import { TestBase } from "./TestBase.sol";

contract InvariantTest is TestBase {
    // 场景：组合资金视角下应满足 资金覆盖不变量
    function test_Invariant_VaultBalanceCoverage() public {
        uint256 eventId = createDefaultEvent();

        vm.prank(alice);
        eventFactory.buyYes{ value: 4 ether }(eventId);

        vm.prank(bob);
        eventFactory.buyNo{ value: 3 ether }(eventId);

        vm.warp(defaultCloseTime + 1);
        eventFactory.proposeResolution(eventId, PolymarketTypes.Outcome.Yes);
        vm.warp(defaultCloseTime + 1 + oracle.LIVENESS());
        eventFactory.finalizeResolution(eventId);

        (uint256 yesBalAlice,) = eventFactory.getUserPosition(eventId, alice);
        vm.prank(alice);
        eventFactory.redeemToETH(eventId, yesBalAlice / 2, 0);

        (,,,, uint256 totalCollateral,,,,,,) = eventFactory.getEvent(eventId);
        (uint256 vaultBalance,,) = eventFactory.getVaultMetrics();

        require(vaultBalance >= totalCollateral, "INVARIANT_BROKEN");
    }
}
