// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/// @title 资格名单根登记接口
/// @notice 对外暴露当前生效资格名单的结构，供发放合约和服务端共享读取。
interface IUnemploymentCredentialRootRegistry {
    /// @notice 当前资格名单在链上的完整结构。
    /// @dev 这里保存的是名单摘要与版本元信息，不保存申请人的明文材料。
    struct UnemploymentCredentialSet {
        bytes32 setId;
        uint256 merkleRoot;
        uint32 version;
        uint64 referenceDate;
        uint32 eligibleCount;
        address issuer;
        uint64 updatedAt;
        bool active;
    }

    /// @notice 读取当前生效的资格名单。
    /// @return 当前链上正在使用的资格名单结构。
    function getCurrentCredentialSet() external view returns (UnemploymentCredentialSet memory);
}
