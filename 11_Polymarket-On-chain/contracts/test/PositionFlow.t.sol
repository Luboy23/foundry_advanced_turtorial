// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PolymarketTypes} from "../src/PolymarketTypes.sol";
import {TestBase} from "./TestBase.sol";

contract PositionFlowTest is TestBase {
    event PositionBought(
        uint256 indexed eventId,
        address indexed user,
        PolymarketTypes.PositionSide side,
        uint256 collateralIn,
        uint256 tokenAmount,
        uint256 yesPool,
        uint256 noPool
    );

    function test_BuyYes_RevertWhenZeroCollateral() public {
        uint256 eventId = createDefaultEvent();

        vm.prank(alice);
        vm.expectRevert(bytes("ZERO_COLLATERAL"));
        eventFactory.buyYes{value: 0}(eventId);
    }

    function test_BuyNo_SuccessAfterCloseTimeBeforeFinalize() public {
        uint256 eventId = createDefaultEvent();

        vm.warp(defaultCloseTime);
        vm.prank(alice);
        eventFactory.buyNo{value: 1 ether}(eventId);

        (uint256 yesBal, uint256 noBal) = eventFactory.getUserPosition(eventId, alice);
        assertEq(yesBal, 0);
        assertEq(noBal, 1 ether);
    }

    function test_BuyYes_SuccessDuringProposedCooldown() public {
        uint256 eventId = createDefaultEvent();

        vm.warp(defaultCloseTime + 1);
        eventFactory.proposeResolution(eventId, PolymarketTypes.Outcome.Yes);

        vm.prank(alice);
        eventFactory.buyYes{value: 1 ether}(eventId);

        (uint256 yesBal, uint256 noBal) = eventFactory.getUserPosition(eventId, alice);
        assertEq(yesBal, 1 ether);
        assertEq(noBal, 0);
    }

    function test_BuyYes_RevertWhenResolved() public {
        uint256 eventId = createDefaultEvent();

        vm.warp(defaultCloseTime + 1);
        eventFactory.proposeResolution(eventId, PolymarketTypes.Outcome.Yes);
        vm.warp(defaultCloseTime + 1 + oracle.LIVENESS());
        eventFactory.finalizeResolution(eventId);

        vm.prank(alice);
        vm.expectRevert(bytes("EVENT_NOT_BUYABLE"));
        eventFactory.buyYes{value: 1 ether}(eventId);
    }

    function test_BuyYes_MintsAndAccumulatesYesPool() public {
        uint256 eventId = createDefaultEvent();

        vm.prank(alice);
        eventFactory.buyYes{value: 2 ether}(eventId);

        (uint256 yesBal, uint256 noBal) = eventFactory.getUserPosition(eventId, alice);
        assertEq(yesBal, 2 ether);
        assertEq(noBal, 0);

        (,,,, uint256 totalCollateral, uint256 yesPool, uint256 noPool,,,,) = eventFactory.getEvent(eventId);
        assertEq(totalCollateral, 2 ether);
        assertEq(yesPool, 2 ether);
        assertEq(noPool, 0);
    }

    function test_BuyNo_MintsAndAccumulatesNoPool() public {
        uint256 eventId = createDefaultEvent();

        vm.prank(alice);
        eventFactory.buyNo{value: 1.5 ether}(eventId);

        (uint256 yesBal, uint256 noBal) = eventFactory.getUserPosition(eventId, alice);
        assertEq(yesBal, 0);
        assertEq(noBal, 1.5 ether);

        (,,,, uint256 totalCollateral, uint256 yesPool, uint256 noPool,,,,) = eventFactory.getEvent(eventId);
        assertEq(totalCollateral, 1.5 ether);
        assertEq(yesPool, 0);
        assertEq(noPool, 1.5 ether);
    }

    function test_BuyYes_EmitEvent() public {
        uint256 eventId = createDefaultEvent();
        uint256 amount = 1 ether;

        vm.expectEmit(true, true, false, true, address(eventFactory));
        emit PositionBought(eventId, alice, PolymarketTypes.PositionSide.Yes, amount, amount, amount, 0);

        vm.prank(alice);
        eventFactory.buyYes{value: amount}(eventId);
    }

    function testFuzz_BuyYes_IncreasesYesOnly(uint96 raw) public {
        uint256 eventId = createDefaultEvent();
        uint256 amount = boundAmount(uint256(raw), 20 ether);

        vm.prank(alice);
        eventFactory.buyYes{value: amount}(eventId);

        (uint256 yesBal, uint256 noBal) = eventFactory.getUserPosition(eventId, alice);
        assertEq(yesBal, amount);
        assertEq(noBal, 0);
    }
}
