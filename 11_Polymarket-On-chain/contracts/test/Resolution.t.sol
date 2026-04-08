// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { PolymarketTypes } from "../src/PolymarketTypes.sol";
import { TestBase } from "./TestBase.sol";

contract ResolutionTest is TestBase {
    event ResolutionProposed(
        uint256 indexed eventId,
        address indexed proposer,
        PolymarketTypes.Outcome outcome,
        uint64 proposedAt,
        uint64 canFinalizeAt
    );

    event ResolutionFinalized(uint256 indexed eventId, PolymarketTypes.Outcome outcome, uint64 finalizedAt);

    // 场景：非 resolver 不能提案
    function test_Propose_RevertWhenNotResolver() public {
        uint256 eventId = createDefaultEvent();

        vm.warp(defaultCloseTime + 1);
        vm.prank(alice);
        vm.expectRevert(bytes("ONLY_RESOLVER"));
        eventFactory.proposeResolution(eventId, PolymarketTypes.Outcome.Yes);
    }

    // 场景：未到截止时间不能提案
    function test_Propose_RevertWhenEventNotClosed() public {
        uint256 eventId = createDefaultEvent();

        vm.expectRevert(bytes("EVENT_NOT_CLOSED"));
        eventFactory.proposeResolution(eventId, PolymarketTypes.Outcome.Yes);
    }

    // 场景：提案结果不能为 Unresolved
    function test_Propose_RevertWhenInvalidOutcome() public {
        uint256 eventId = createDefaultEvent();

        vm.warp(defaultCloseTime + 1);
        vm.expectRevert(bytes("INVALID_OUTCOME"));
        eventFactory.proposeResolution(eventId, PolymarketTypes.Outcome.Unresolved);
    }

    // 场景：进入 Proposed 后不可再次提案
    function test_Propose_RevertWhenAlreadyProposed() public {
        uint256 eventId = createDefaultEvent();

        vm.warp(defaultCloseTime + 1);
        eventFactory.proposeResolution(eventId, PolymarketTypes.Outcome.Yes);

        vm.expectRevert(bytes("EVENT_NOT_OPEN"));
        eventFactory.proposeResolution(eventId, PolymarketTypes.Outcome.No);
    }

    // 场景：成功提案应进入 Proposed 状态
    function test_Propose_Success() public {
        uint256 eventId = createDefaultEvent();
        vm.warp(defaultCloseTime + 1);

        vm.expectEmit(true, true, false, false);
        emit ResolutionProposed(eventId, address(this), PolymarketTypes.Outcome.Yes, 0, 0);
        eventFactory.proposeResolution(eventId, PolymarketTypes.Outcome.Yes);

        (, uint256 closeTime, PolymarketTypes.EventState state,,,,,,,,) = eventFactory.getEvent(eventId);
        closeTime;
        assertEq(state, PolymarketTypes.EventState.Proposed);
    }

    // 场景：未提案不能 finalize
    function test_Finalize_RevertWhenNotProposed() public {
        uint256 eventId = createDefaultEvent();
        vm.warp(defaultCloseTime + 1);

        vm.expectRevert(bytes("NOT_PROPOSED"));
        eventFactory.finalizeResolution(eventId);
    }

    // 场景：liveness 未到不能 finalize
    function test_Finalize_RevertWhenLivenessNotPassed() public {
        uint256 eventId = createDefaultEvent();

        vm.warp(defaultCloseTime + 1);
        eventFactory.proposeResolution(eventId, PolymarketTypes.Outcome.Yes);

        vm.expectRevert(bytes("LIVENESS_NOT_PASSED"));
        eventFactory.finalizeResolution(eventId);
    }

    // 场景：liveness 到期后可 finalize
    function test_Finalize_SetsResolvedState() public {
        uint256 eventId = createDefaultEvent();

        vm.prank(alice);
        eventFactory.buyNo{ value: 1 ether }(eventId);

        vm.warp(defaultCloseTime + 1);
        eventFactory.proposeResolution(eventId, PolymarketTypes.Outcome.No);

        vm.warp(defaultCloseTime + 1 + oracle.LIVENESS());
        eventFactory.finalizeResolution(eventId);

        (,, PolymarketTypes.EventState state, PolymarketTypes.Outcome outcome,,,,,,,) = eventFactory.getEvent(eventId);
        assertEq(state, PolymarketTypes.EventState.Resolved);
        assertEq(outcome, PolymarketTypes.Outcome.No);
    }

    // 场景：冷静期 30 秒，29 秒时仍不可 finalize
    function test_Finalize_RevertWhenLivenessAt29Seconds() public {
        uint256 eventId = createDefaultEvent();

        vm.warp(defaultCloseTime + 1);
        eventFactory.proposeResolution(eventId, PolymarketTypes.Outcome.Yes);

        vm.warp(defaultCloseTime + 1 + 29);
        vm.expectRevert(bytes("LIVENESS_NOT_PASSED"));
        eventFactory.finalizeResolution(eventId);
    }

    // 场景：冷静期 30 秒，30 秒时可 finalize
    function test_Finalize_SuccessWhenLivenessAt30Seconds() public {
        uint256 eventId = createDefaultEvent();

        vm.prank(alice);
        eventFactory.buyYes{ value: 1 ether }(eventId);

        vm.warp(defaultCloseTime + 1);
        eventFactory.proposeResolution(eventId, PolymarketTypes.Outcome.Yes);

        vm.warp(defaultCloseTime + 1 + 30);
        eventFactory.finalizeResolution(eventId);

        (,, PolymarketTypes.EventState state, PolymarketTypes.Outcome outcome,,,,,,,) = eventFactory.getEvent(eventId);
        assertEq(state, PolymarketTypes.EventState.Resolved);
        assertEq(outcome, PolymarketTypes.Outcome.Yes);
    }

    // 场景：非 resolver 不能 finalize
    function test_Finalize_RevertWhenNotResolver() public {
        uint256 eventId = createDefaultEvent();

        vm.warp(defaultCloseTime + 1);
        eventFactory.proposeResolution(eventId, PolymarketTypes.Outcome.Yes);
        vm.warp(defaultCloseTime + 1 + oracle.LIVENESS());

        vm.prank(alice);
        vm.expectRevert(bytes("ONLY_RESOLVER"));
        eventFactory.finalizeResolution(eventId);
    }

    // 场景：closeTime 到达后，若 resolver 未提案，事件状态仍为 Open
    function test_State_StaysOpenAfterCloseTimeBeforeProposal() public {
        uint256 eventId = createDefaultEvent();

        vm.warp(defaultCloseTime + 1);
        (,, PolymarketTypes.EventState state,,,,,,,,) = eventFactory.getEvent(eventId);
        assertEq(state, PolymarketTypes.EventState.Open);
    }

    // 场景：未提案时即使等待超过冷静期，事件也不会自动进入 Resolved
    function test_State_DoesNotAutoResolveWithoutProposal() public {
        uint256 eventId = createDefaultEvent();

        vm.warp(defaultCloseTime + 1 + oracle.LIVENESS() + 5);
        (,, PolymarketTypes.EventState state, PolymarketTypes.Outcome outcome,,,,,,,) = eventFactory.getEvent(eventId);
        assertEq(state, PolymarketTypes.EventState.Open);
        assertEq(outcome, PolymarketTypes.Outcome.Unresolved);

        vm.expectRevert(bytes("NOT_PROPOSED"));
        eventFactory.finalizeResolution(eventId);
    }

    // 场景：若赢家池为 0，最终结果自动降级为 Invalid
    function test_Finalize_AutoInvalidWhenWinningPoolZero() public {
        uint256 eventId = createDefaultEvent();

        vm.prank(alice);
        eventFactory.buyNo{ value: 1 ether }(eventId);

        vm.warp(defaultCloseTime + 1);
        eventFactory.proposeResolution(eventId, PolymarketTypes.Outcome.Yes);
        vm.warp(defaultCloseTime + 1 + oracle.LIVENESS());
        eventFactory.finalizeResolution(eventId);

        (
            ,
            ,
            PolymarketTypes.EventState state,
            PolymarketTypes.Outcome outcome,
            ,
            uint256 yesPool,
            uint256 noPool,
            uint256 totalSnapshot,
            uint256 winningSnapshot,
            ,
        ) = eventFactory.getEvent(eventId);

        assertEq(state, PolymarketTypes.EventState.Resolved);
        assertEq(outcome, PolymarketTypes.Outcome.Invalid);
        assertEq(yesPool, 0);
        assertEq(noPool, 1 ether);
        assertEq(totalSnapshot, 1 ether);
        assertEq(winningSnapshot, 0);
    }
}
