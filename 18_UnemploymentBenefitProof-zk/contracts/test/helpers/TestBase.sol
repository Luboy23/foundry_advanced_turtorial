// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface Vm {
    function prank(address msgSender) external;
    function startPrank(address msgSender) external;
    function stopPrank() external;
    function deal(address who, uint256 newBalance) external;
    function expectRevert(bytes4 revertData) external;
    function expectRevert(bytes calldata revertData) external;
}

abstract contract TestBase {
    address internal constant VM_ADDRESS = address(uint160(uint256(keccak256("hevm cheat code"))));
    Vm internal constant vm = Vm(VM_ADDRESS);

    function assertTrue(bool condition, string memory message) internal pure {
        if (!condition) {
            revert(message);
        }
    }

    function assertEqUint256(uint256 left, uint256 right, string memory message) internal pure {
        if (left != right) {
            revert(message);
        }
    }

    function assertEqUint32(uint32 left, uint32 right, string memory message) internal pure {
        if (left != right) {
            revert(message);
        }
    }

    function assertEqUint64(uint64 left, uint64 right, string memory message) internal pure {
        if (left != right) {
            revert(message);
        }
    }

    function assertEqBytes32(bytes32 left, bytes32 right, string memory message) internal pure {
        if (left != right) {
            revert(message);
        }
    }

    function assertEqAddress(address left, address right, string memory message) internal pure {
        if (left != right) {
            revert(message);
        }
    }

    function assertEqBool(bool left, bool right, string memory message) internal pure {
        if (left != right) {
            revert(message);
        }
    }
}
