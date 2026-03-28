// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PolymarketTypes} from "../src/PolymarketTypes.sol";
import {TestBase} from "./TestBase.sol";

contract RedeemTest is TestBase {
    event Redeemed(
        uint256 indexed eventId,
        address indexed user,
        uint256 yesAmount,
        uint256 noAmount,
        uint256 payout,
        PolymarketTypes.Outcome outcome
    );

    function test_Redeem_RevertWhenEventNotResolved() public {
        uint256 eventId = createDefaultEvent();

        vm.prank(alice);
        eventFactory.buyYes{value: 1 ether}(eventId);

        vm.prank(alice);
        vm.expectRevert(bytes("EVENT_NOT_RESOLVED"));
        eventFactory.redeemToETH(eventId, 1 ether, 0);
    }

    function test_Redeem_RevertWhenNoPosition() public {
        uint256 eventId = createDefaultEvent();

        vm.warp(defaultCloseTime + 1);
        eventFactory.proposeResolution(eventId, PolymarketTypes.Outcome.Yes);
        vm.warp(defaultCloseTime + 1 + oracle.LIVENESS());
        eventFactory.finalizeResolution(eventId);

        vm.prank(alice);
        vm.expectRevert(bytes("NO_POSITION"));
        eventFactory.redeemToETH(eventId, 0, 0);
    }

    function test_Redeem_PayoutByParimutuelWhenOutcomeYes() public {
        uint256 eventId = createDefaultEvent();

        vm.prank(alice);
        eventFactory.buyYes{value: 2 ether}(eventId);

        vm.prank(bob);
        eventFactory.buyYes{value: 1 ether}(eventId);

        vm.prank(bob);
        eventFactory.buyNo{value: 3 ether}(eventId);

        vm.warp(defaultCloseTime + 1);
        eventFactory.proposeResolution(eventId, PolymarketTypes.Outcome.Yes);
        vm.warp(defaultCloseTime + 1 + oracle.LIVENESS());
        eventFactory.finalizeResolution(eventId);

        // totalPool = 6, winningYesPool = 3, alice 持仓 2 => payout = 4
        uint256 before = alice.balance;

        vm.prank(alice);
        eventFactory.redeemToETH(eventId, 2 ether, 0);

        uint256 afterBal = alice.balance;
        assertEq(afterBal - before, 4 ether);
    }

    function test_Redeem_PayoutByParimutuelWhenOutcomeNo() public {
        uint256 eventId = createDefaultEvent();

        vm.prank(alice);
        eventFactory.buyNo{value: 1 ether}(eventId);

        vm.prank(bob);
        eventFactory.buyNo{value: 1 ether}(eventId);

        vm.prank(bob);
        eventFactory.buyYes{value: 2 ether}(eventId);

        vm.warp(defaultCloseTime + 1);
        eventFactory.proposeResolution(eventId, PolymarketTypes.Outcome.No);
        vm.warp(defaultCloseTime + 1 + oracle.LIVENESS());
        eventFactory.finalizeResolution(eventId);

        // totalPool = 4, winningNoPool = 2, alice 持仓 1 => payout = 2
        uint256 before = alice.balance;

        vm.prank(alice);
        eventFactory.redeemToETH(eventId, 0, 1 ether);

        uint256 afterBal = alice.balance;
        assertEq(afterBal - before, 2 ether);
    }

    function test_Redeem_PayoutWhenOutcomeInvalid() public {
        uint256 eventId = createDefaultEvent();

        vm.prank(alice);
        eventFactory.buyYes{value: 1.2 ether}(eventId);

        vm.prank(alice);
        eventFactory.buyNo{value: 0.8 ether}(eventId);

        vm.warp(defaultCloseTime + 1);
        eventFactory.proposeResolution(eventId, PolymarketTypes.Outcome.Invalid);
        vm.warp(defaultCloseTime + 1 + oracle.LIVENESS());
        eventFactory.finalizeResolution(eventId);

        uint256 before = alice.balance;

        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit Redeemed(eventId, alice, 1.2 ether, 0.8 ether, 2 ether, PolymarketTypes.Outcome.Invalid);
        eventFactory.redeemToETH(eventId, 1.2 ether, 0.8 ether);

        uint256 afterBal = alice.balance;
        assertEq(afterBal - before, 2 ether);
    }
}
