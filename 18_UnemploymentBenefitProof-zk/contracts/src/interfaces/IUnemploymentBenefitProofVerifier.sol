// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/// @title 失业补助零知识证明验证器接口
/// @notice 发放合约通过该接口验证申请人提交的 Groth16 证明是否合法。
interface IUnemploymentBenefitProofVerifier {
    /// @notice 校验一笔资格证明是否满足当前电路约束。
    /// @param pA Groth16 证明的 A 点。
    /// @param pB Groth16 证明的 B 点。
    /// @param pC Groth16 证明的 C 点。
    /// @param publicSignals 电路公开输入，包含名单摘要、项目标识、领取地址和 nullifier。
    /// @return 是否通过验证。
    function verifyProof(
        uint256[2] calldata pA,
        uint256[2][2] calldata pB,
        uint256[2] calldata pC,
        uint256[4] calldata publicSignals
    ) external view returns (bool);
}
