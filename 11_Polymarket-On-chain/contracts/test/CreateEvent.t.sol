// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PolymarketTypes} from "../src/PolymarketTypes.sol";
import {TestBase} from "./TestBase.sol";

contract CreateEventTest is TestBase {
    event EventCreated(
        uint256 indexed eventId,
        address indexed creator,
        string question,
        uint64 closeTime,
        string resolutionSourceURI,
        string metadataURI
    );

    // 场景：仅 owner 可创建事件
    function test_CreateEvent_RevertWhenNotOwner() public {
        vm.prank(alice);
        vm.expectRevert(bytes("ONLY_OWNER"));
        eventFactory.createEvent("Q", block.timestamp + 1 days, "source", "metadata");
    }

    // 场景：问题为空时拒绝创建
    function test_CreateEvent_RevertWhenQuestionEmpty() public {
        vm.expectRevert(bytes("QUESTION_EMPTY"));
        eventFactory.createEvent("", block.timestamp + 1 days, "source", "metadata");
    }

    // 场景：截止时间非法时拒绝创建
    function test_CreateEvent_RevertWhenEndTimeInPast() public {
        vm.expectRevert(bytes("ENDTIME_IN_PAST"));
        eventFactory.createEvent("Q", block.timestamp, "source", "metadata");
    }

    // 场景：仅 owner 可按相对时长创建事件
    function test_CreateEventWithDuration_RevertWhenNotOwner() public {
        vm.prank(alice);
        vm.expectRevert(bytes("ONLY_OWNER"));
        eventFactory.createEventWithDuration("Q", 30, "source", "metadata");
    }

    // 场景：相对时长过短时拒绝创建
    function test_CreateEventWithDuration_RevertWhenDurationTooShort() public {
        uint256 tooShort = eventFactory.MIN_CLOSE_DURATION_SEC() - 1;
        vm.expectRevert(bytes("CLOSE_DURATION_TOO_SHORT"));
        eventFactory.createEventWithDuration("Q", tooShort, "source", "metadata");
    }

    // 场景：相对时长过长时拒绝创建
    function test_CreateEventWithDuration_RevertWhenDurationTooLong() public {
        uint256 tooLong = eventFactory.MAX_CLOSE_DURATION_SEC() + 1;
        vm.expectRevert(bytes("CLOSE_DURATION_TOO_LONG"));
        eventFactory.createEventWithDuration("Q", tooLong, "source", "metadata");
    }

    // 场景：相对时长创建成功并按当前区块时间计算 closeTime
    function test_CreateEventWithDuration_SuccessStoresDerivedCloseTime() public {
        uint256 duration = 120;
        uint256 expectedCloseTime = block.timestamp + duration;
        uint256 eventId = eventFactory.createEventWithDuration("Duration Event", duration, "source", "meta");

        (, uint256 storedCloseTime,,,,,,,,,) = eventFactory.getEvent(eventId);
        assertEq(storedCloseTime, expectedCloseTime);
    }

    // 场景：创建成功后状态写入正确
    function test_CreateEvent_SuccessStoresOpenState() public {
        uint256 closeTime = block.timestamp + 2 days;
        uint256 eventId = eventFactory.createEvent("Will BTC > 100k?", closeTime, "source", "meta");

        (
            string memory question,
            uint256 storedCloseTime,
            PolymarketTypes.EventState state,
            PolymarketTypes.Outcome outcome,
            uint256 totalCollateral,
            uint256 yesPool,
            uint256 noPool,
            uint256 totalPoolSnapshot,
            uint256 winningPoolSnapshot,
            string memory resolutionSource,
            string memory metadata
        ) = eventFactory.getEvent(eventId);

        assertEq(question, "Will BTC > 100k?");
        assertEq(storedCloseTime, closeTime);
        assertEq(state, PolymarketTypes.EventState.Open);
        assertEq(outcome, PolymarketTypes.Outcome.Unresolved);
        assertEq(totalCollateral, 0);
        assertEq(yesPool, 0);
        assertEq(noPool, 0);
        assertEq(totalPoolSnapshot, 0);
        assertEq(winningPoolSnapshot, 0);
        assertEq(resolutionSource, "source");
        assertEq(metadata, "meta");
    }

    // 场景：创建事件触发日志
    function test_CreateEvent_EmitEvent() public {
        uint64 closeTime = uint64(block.timestamp + 1 days);

        vm.expectEmit(true, true, false, true);
        emit EventCreated(1, address(this), "Q", closeTime, "source", "meta");
        eventFactory.createEvent("Q", closeTime, "source", "meta");
    }

    // 场景：fuzz 输入下合法创建均成功
    function testFuzz_CreateEvent_Success(uint40 delta, string memory question) public {
        vm.assume(bytes(question).length > 0);
        vm.assume(bytes(question).length < 100);
        vm.assume(delta > 60 && delta < 365 days);

        uint256 eventId = eventFactory.createEvent(question, block.timestamp + uint256(delta), "source", "metadata");
        (string memory storedQuestion,,,,,,,,,,) = eventFactory.getEvent(eventId);

        assertEq(storedQuestion, question);
    }
}
