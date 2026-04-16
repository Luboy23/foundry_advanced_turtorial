// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/// @dev 仅声明当前部署脚本需要用到的最小 Foundry cheatcode 接口。
interface Vm {
    function startBroadcast() external;
    function startBroadcast(address signer) external;
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
    function readFile(string calldata path) external view returns (string memory);
    function parseJson(string calldata json, string calldata key) external pure returns (bytes memory);
    function parseJsonBytes32(string calldata json, string calldata key) external pure returns (bytes32);
    function parseJsonString(string calldata json, string calldata key) external pure returns (string memory);
    function parseJsonUint(string calldata json, string calldata key) external pure returns (uint256);
}

/// @notice 16 项目脚本基础能力。
/// @dev 统一提供 vm 常量，避免每个脚本文件重复声明一次。
abstract contract ScriptBase {
    address internal constant VM_ADDRESS = address(uint160(uint256(keccak256("hevm cheat code"))));
    Vm internal constant vm = Vm(VM_ADDRESS);
}
