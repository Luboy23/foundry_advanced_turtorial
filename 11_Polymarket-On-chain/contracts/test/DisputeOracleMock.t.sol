// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PolymarketTypes} from "../src/PolymarketTypes.sol";
import {OracleAdapterDisputeMock} from "../src/OracleAdapterDisputeMock.sol";
import {TestBase} from "./TestBase.sol";

contract DisputeOracleMockTest is TestBase {
    OracleAdapterDisputeMock internal oracleDispute;

    function setUp() public virtual override {
        super.setUp();
        oracleDispute = new OracleAdapterDisputeMock();
        oracleDispute.setOperator(address(this));
        vm.deal(address(this), 10 ether);
    }

    function test_Propose_SetsDisputeWindow() public {
        oracleDispute.proposeResolution(1, resolver, PolymarketTypes.Outcome.Yes);

        OracleAdapterDisputeMock.DisputeState memory state = oracleDispute.getDisputeState(1);
        assertEq(state.proposed, true);
        assertEq(state.disputed, false);
        assertEq(state.finalized, false);
        assertEq(state.proposer, resolver);
        assertEq(state.proposedOutcome, PolymarketTypes.Outcome.Yes);
        require(state.disputeDeadline > state.proposedAt, "BAD_DISPUTE_WINDOW");
    }

    function test_Dispute_RevertWhenWindowPassed() public {
        oracleDispute.proposeResolution(1, resolver, PolymarketTypes.Outcome.No);

        vm.warp(block.timestamp + oracleDispute.DISPUTE_WINDOW() + 1);
        vm.expectRevert(bytes("DISPUTE_WINDOW_PASSED"));
        oracleDispute.disputeResolution{value: 1 ether}(1, alice);
    }

    function test_Finalize_UndisputedReturnsProposedOutcome() public {
        oracleDispute.proposeResolution(1, resolver, PolymarketTypes.Outcome.No);

        vm.warp(block.timestamp + oracleDispute.LIVENESS());
        PolymarketTypes.Outcome outcome = oracleDispute.finalizeResolution(1);

        assertEq(outcome, PolymarketTypes.Outcome.No);

        OracleAdapterDisputeMock.DisputeState memory state = oracleDispute.getDisputeState(1);
        assertEq(state.finalized, true);
        assertEq(state.disputed, false);
    }

    function test_Finalize_DisputedReturnsInvalid() public {
        oracleDispute.proposeResolution(1, resolver, PolymarketTypes.Outcome.Yes);

        oracleDispute.disputeResolution{value: 2 ether}(1, bob);

        vm.warp(block.timestamp + oracleDispute.LIVENESS());
        PolymarketTypes.Outcome outcome = oracleDispute.finalizeResolution(1);

        assertEq(outcome, PolymarketTypes.Outcome.Invalid);

        OracleAdapterDisputeMock.DisputeState memory state = oracleDispute.getDisputeState(1);
        assertEq(state.finalized, true);
        assertEq(state.disputed, true);
        assertEq(state.challenger, bob);
        assertEq(state.challengeBond, 2 ether);
    }
}
