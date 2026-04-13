// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { ScriptBase } from "./ScriptBase.sol";
import { AdmissionRoleRegistry } from "../src/AdmissionRoleRegistry.sol";
import { ScoreRootRegistry } from "../src/ScoreRootRegistry.sol";
import { UniversityAdmissionVerifier } from "../src/UniversityAdmissionVerifier.sol";
import { UniversityCutoffProofVerifier } from "../src/UniversityCutoffProofVerifier.sol";

/// @title 本地教学链一键部署脚本
/// @notice 在固定演示账户下部署角色白名单和业务合约。
/// @dev 该脚本默认面向 Anvil 教学环境，因此直接内置了本地测试账户与私钥。
contract Deploy is ScriptBase {
    bytes32 internal constant PKU_KEY = bytes32("pku");
    bytes32 internal constant JIATINGDUN_KEY = bytes32("jiatingdun");

    address internal constant AUTHORITY = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
    address internal constant STUDENT = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    address internal constant PKU_ADMIN = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;
    address internal constant JIATINGDUN_ADMIN = 0x90F79bf6EB2c4f870365E785982E1f101E93b906;

    /// @notice 在本地教学链上部署全部主合约并初始化三方角色。
    /// @dev 该脚本故意只做“部署 + 白名单初始化”，把成绩源发布、规则设置和学生申请留给前端手动演示。
    function run() external {
        // 默认只部署合约并初始化三方白名单，
        // 成绩源发布、学生凭证发放和学校录取线设置都留给前端手动演示。
        vm.startBroadcast(AUTHORITY);

        AdmissionRoleRegistry roleRegistry = new AdmissionRoleRegistry(AUTHORITY);
        ScoreRootRegistry scoreRootRegistry = new ScoreRootRegistry(address(roleRegistry));
        UniversityCutoffProofVerifier verifier = new UniversityCutoffProofVerifier();
        UniversityAdmissionVerifier universityAdmissionVerifier =
            new UniversityAdmissionVerifier(address(scoreRootRegistry), address(verifier), address(roleRegistry));

        roleRegistry.setStudent(STUDENT, true);
        roleRegistry.setUniversityAdmin(PKU_KEY, unicode"北京大学", PKU_ADMIN, true);
        roleRegistry.setUniversityAdmin(JIATINGDUN_KEY, unicode"家里蹲大学", JIATINGDUN_ADMIN, true);

        vm.stopBroadcast();

        address(roleRegistry);
        address(scoreRootRegistry);
        address(verifier);
        address(universityAdmissionVerifier);
    }
}
