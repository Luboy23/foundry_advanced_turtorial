// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {EventFactory} from "../src/EventFactory.sol";
import {PositionToken} from "../src/PositionToken.sol";
import {ETHCollateralVault} from "../src/ETHCollateralVault.sol";
import {OracleAdapterMock} from "../src/OracleAdapterMock.sol";
import {PolymarketTypes} from "../src/PolymarketTypes.sol";

interface Vm {
    function warp(uint256) external;
    function deal(address, uint256) external;
    function prank(address) external;
    function expectRevert(bytes calldata) external;
    function expectEmit(bool, bool, bool, bool) external;
    function expectEmit(bool, bool, bool, bool, address) external;
    function assume(bool) external;
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
}

contract TestBase {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    EventFactory internal eventFactory;
    PositionToken internal positionToken;
    ETHCollateralVault internal collateralVault;
    OracleAdapterMock internal oracle;

    address internal alice;
    address internal bob;
    address internal resolver;

    uint256 internal defaultCloseTime;

    function setUp() public virtual {
        positionToken = new PositionToken("ipfs://polymarket/{id}.json");
        collateralVault = new ETHCollateralVault();
        oracle = new OracleAdapterMock();

        eventFactory = new EventFactory(positionToken, collateralVault, oracle);

        positionToken.setCore(address(eventFactory));
        collateralVault.setOperator(address(eventFactory));
        oracle.setOperator(address(eventFactory));

        alice = makeAddr("alice");
        bob = makeAddr("bob");
        resolver = makeAddr("resolver");

        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);

        defaultCloseTime = block.timestamp + 1 days;
    }

    function createDefaultEvent() internal returns (uint256 eventId) {
        eventId = eventFactory.createEvent(
            "Will ETH close above 5000 this week?",
            defaultCloseTime,
            "https://example.com/resolution-source",
            "ipfs://event-metadata"
        );
    }

    function makeAddr(string memory name) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(name)))));
    }

    function assertEq(uint256 a, uint256 b) internal pure {
        require(a == b, "ASSERT_EQ_UINT");
    }

    function assertEq(address a, address b) internal pure {
        require(a == b, "ASSERT_EQ_ADDRESS");
    }

    function assertEq(bytes32 a, bytes32 b) internal pure {
        require(a == b, "ASSERT_EQ_BYTES32");
    }

    function assertEq(bool a, bool b) internal pure {
        require(a == b, "ASSERT_EQ_BOOL");
    }

    function assertEq(string memory a, string memory b) internal pure {
        require(keccak256(bytes(a)) == keccak256(bytes(b)), "ASSERT_EQ_STRING");
    }

    function assertEq(PolymarketTypes.Outcome a, PolymarketTypes.Outcome b) internal pure {
        require(a == b, "ASSERT_EQ_OUTCOME");
    }

    function assertEq(PolymarketTypes.EventState a, PolymarketTypes.EventState b) internal pure {
        require(a == b, "ASSERT_EQ_STATE");
    }

    function boundAmount(uint256 raw, uint256 max) internal pure returns (uint256) {
        return (raw % max) + 1;
    }
}
