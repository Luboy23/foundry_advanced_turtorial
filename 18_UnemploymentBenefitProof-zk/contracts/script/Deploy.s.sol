// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { ScriptBase } from "./ScriptBase.sol";
import { BenefitRoleRegistry } from "../src/BenefitRoleRegistry.sol";
import { UnemploymentCredentialRootRegistry } from "../src/UnemploymentCredentialRootRegistry.sol";
import { UnemploymentBenefitDistributor } from "../src/UnemploymentBenefitDistributor.sol";
import { UnemploymentBenefitProofVerifier } from "../src/UnemploymentBenefitProofVerifier.sol";

/// @title 18 项目一键部署脚本
/// @notice 部署角色登记、资格根登记、zk verifier 和固定的一次性补助项目。
contract Deploy is ScriptBase {
    string internal constant SAMPLE_V1_SET_FILE = "../zk/data/generated/unemployment-benefit/current-credential-set-v1.json";
    string internal constant SAMPLE_PROGRAM_FILE = "../zk/data/generated/unemployment-benefit/sample-program.json";

    address internal constant GOVERNMENT = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
    address internal constant APPLICANT = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    address internal constant AGENCY = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;

    function run() external {
        string memory currentSetJson = vm.readFile(SAMPLE_V1_SET_FILE);
        string memory programJson = vm.readFile(SAMPLE_PROGRAM_FILE);

        vm.startBroadcast(GOVERNMENT);

        BenefitRoleRegistry roleRegistry = new BenefitRoleRegistry(GOVERNMENT);
        UnemploymentCredentialRootRegistry rootRegistry = new UnemploymentCredentialRootRegistry(address(roleRegistry));
        UnemploymentBenefitProofVerifier verifier = new UnemploymentBenefitProofVerifier();
        UnemploymentBenefitDistributor distributor = new UnemploymentBenefitDistributor(
            address(roleRegistry),
            address(rootRegistry),
            address(verifier),
            vm.parseJsonBytes32(programJson, ".programIdBytes32"),
            vm.parseJsonUint(programJson, ".programIdField"),
            vm.parseJsonUint(programJson, ".benefitAmountWei")
        );

        roleRegistry.setApplicant(APPLICANT, true);
        roleRegistry.setAgency(AGENCY, true);
        _publishCurrentSet(rootRegistry, currentSetJson);

        vm.stopBroadcast();

        address(roleRegistry);
        address(rootRegistry);
        address(verifier);
        address(distributor);
    }

    function _publishCurrentSet(UnemploymentCredentialRootRegistry rootRegistry, string memory json) internal {
        rootRegistry.publishCredentialSet(
            vm.parseJsonBytes32(json, ".setIdBytes32"),
            uint256(vm.parseJsonBytes32(json, ".merkleRootHex")),
            uint32(vm.parseJsonUint(json, ".version")),
            uint64(vm.parseJsonUint(json, ".referenceDate")),
            uint32(vm.parseJsonUint(json, ".eligibleCount"))
        );
    }
}
