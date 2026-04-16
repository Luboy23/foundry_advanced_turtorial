// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/// @dev 仅声明当前测试文件需要用到的最小 hevm cheatcode 接口。
interface Vm {
    function prank(address msgSender) external;
    function startPrank(address msgSender) external;
    function stopPrank() external;
    function deal(address who, uint256 newBalance) external;
    function warp(uint256 newTimestamp) external;
    function expectRevert(bytes4 revertData) external;
    function expectRevert(bytes calldata revertData) external;
    function expectEmit(bool checkTopic1, bool checkTopic2, bool checkTopic3, bool checkData) external;
}

/// @title 16 项目测试基础能力
/// @notice 提供不依赖 forge-std 的最小断言与 cheatcode 包装，方便教学项目保持依赖最轻。
abstract contract TestBase {
    address internal constant VM_ADDRESS = address(uint160(uint256(keccak256("hevm cheat code"))));
    Vm internal constant vm = Vm(VM_ADDRESS);

    /// @dev 断言布尔条件成立，否则直接回退测试。
    function assertTrue(bool condition, string memory message) internal pure {
        if (!condition) {
            revert(message);
        }
    }

    /// @dev 断言两个 uint256 完全相等。
    function assertEqUint256(uint256 left, uint256 right, string memory message) internal pure {
        if (left != right) {
            revert(message);
        }
    }

    /// @dev 断言两个 uint32 完全相等。
    function assertEqUint32(uint32 left, uint32 right, string memory message) internal pure {
        if (left != right) {
            revert(message);
        }
    }

    /// @dev 断言两个 bytes32 完全相等。
    function assertEqBytes32(bytes32 left, bytes32 right, string memory message) internal pure {
        if (left != right) {
            revert(message);
        }
    }

    /// @dev 断言两个地址完全相等。
    function assertEqAddress(address left, address right, string memory message) internal pure {
        if (left != right) {
            revert(message);
        }
    }

    /// @dev 断言两个字符串在字节层完全一致。
    function assertEqString(string memory left, string memory right, string memory message) internal pure {
        if (keccak256(bytes(left)) != keccak256(bytes(right))) {
            revert(message);
        }
    }

    /// @dev 断言两个布尔值完全一致。
    function assertEqBool(bool left, bool right, string memory message) internal pure {
        if (left != right) {
            revert(message);
        }
    }
}
