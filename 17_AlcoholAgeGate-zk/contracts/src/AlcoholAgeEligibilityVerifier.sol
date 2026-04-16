// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { IAlcoholRoleRegistry } from "./interfaces/IAlcoholRoleRegistry.sol";
import { IAgeCredentialRootRegistry } from "./interfaces/IAgeCredentialRootRegistry.sol";
import { IAlcoholAgeProofVerifier } from "./interfaces/IAlcoholAgeProofVerifier.sol";
import { IAlcoholAgeEligibilityVerifier } from "./interfaces/IAlcoholAgeEligibilityVerifier.sol";
import { DateYmdLib } from "./libraries/DateYmdLib.sol";

/// @title 年龄资格验证合约
/// @notice 接收 ZK proof，并把买家的当前年龄资格写成链上状态。
contract AlcoholAgeEligibilityVerifier is IAlcoholAgeEligibilityVerifier {
    error ZeroAddress();
    error Unauthorized(address caller);
    error CredentialSetMismatch(bytes32 expectedSetId, bytes32 actualSetId);
    error CredentialSetInactive(bytes32 setId);
    error InvalidVerificationDate(uint32 verificationDateYmd, uint32 currentDateYmd);
    error InvalidProof();

    IAlcoholRoleRegistry public immutable roleRegistry;
    IAgeCredentialRootRegistry public immutable rootRegistry;
    IAlcoholAgeProofVerifier public immutable verifier;

    mapping(address => EligibilityStatus) private s_statuses;

    event EligibilityVerified(
        address indexed buyer,
        bytes32 indexed setId,
        uint32 indexed version,
        uint32 verificationDateYmd
    );

    constructor(address rootRegistryAddress, address verifierAddress, address roleRegistryAddress) {
        if (rootRegistryAddress == address(0) || verifierAddress == address(0) || roleRegistryAddress == address(0)) {
            revert ZeroAddress();
        }

        rootRegistry = IAgeCredentialRootRegistry(rootRegistryAddress);
        verifier = IAlcoholAgeProofVerifier(verifierAddress);
        roleRegistry = IAlcoholRoleRegistry(roleRegistryAddress);
    }

    function verifyEligibility(
        bytes32 setId,
        uint32 verificationDateYmd,
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c
    ) external {
        // 资格验证只对 buyer 开放；是否能进入买家流程与是否已经验证成功是两层不同的权限。
        if (!roleRegistry.isBuyer(msg.sender)) {
            revert Unauthorized(msg.sender);
        }

        IAgeCredentialRootRegistry.AgeCredentialSet memory currentSet = rootRegistry.getCurrentCredentialSet();
        // proof 必须针对“当前系统认可的 active 集合”生成，旧集合或其他集合都不能复用。
        if (currentSet.setId != setId) {
            revert CredentialSetMismatch(setId, currentSet.setId);
        }
        if (!currentSet.active) {
            revert CredentialSetInactive(setId);
        }

        uint32 currentDateYmd = DateYmdLib.timestampToUtcDateYmd(block.timestamp);
        // 合约只接受不晚于当前 UTC 日期的 verificationDate，避免用户为未来日期提前生成资格。
        if (verificationDateYmd == 0 || verificationDateYmd > currentDateYmd) {
            revert InvalidVerificationDate(verificationDateYmd, currentDateYmd);
        }

        // 公共输入只包含当前 root、版本、验证日期和调用者地址。
        // 合约不接触生日原文，也不接触私有 Merkle path。
        uint256[4] memory publicSignals = [
            currentSet.merkleRoot,
            uint256(currentSet.version),
            uint256(verificationDateYmd),
            uint256(uint160(msg.sender))
        ];

        bool verified = verifier.verifyProof(a, b, c, publicSignals);
        if (!verified) {
            revert InvalidProof();
        }

        // 链上真正的业务真值是 EligibilityStatus：
        // 后续商城和页面都只消费这份状态，而不会重新理解 proof 细节。
        s_statuses[msg.sender] = EligibilityStatus({
            verifiedRootVersion: currentSet.version,
            verifiedAt: uint64(block.timestamp),
            active: true
        });

        emit EligibilityVerified(msg.sender, setId, currentSet.version, verificationDateYmd);
    }

    function getEligibility(address buyer) external view returns (EligibilityStatus memory) {
        return s_statuses[buyer];
    }

    function hasValidEligibility(address buyer) public view returns (bool) {
        EligibilityStatus memory status = s_statuses[buyer];
        if (!status.active) {
            return false;
        }

        IAgeCredentialRootRegistry.AgeCredentialSet memory currentSet = rootRegistry.getCurrentCredentialSet();
        // 已验证成功不代表永远有效；只要当前 active 集合版本变了，旧资格就会自动失效。
        return currentSet.active && status.verifiedRootVersion == currentSet.version;
    }
}
