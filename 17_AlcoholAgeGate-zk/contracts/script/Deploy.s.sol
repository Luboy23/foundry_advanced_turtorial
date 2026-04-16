// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { ScriptBase } from "./ScriptBase.sol";
import { AlcoholRoleRegistry } from "../src/AlcoholRoleRegistry.sol";
import { AgeCredentialRootRegistry } from "../src/AgeCredentialRootRegistry.sol";
import { AlcoholAgeEligibilityVerifier } from "../src/AlcoholAgeEligibilityVerifier.sol";
import { AlcoholMarketplace } from "../src/AlcoholMarketplace.sol";
import { AlcoholAgeProofVerifier } from "../src/AlcoholAgeProofVerifier.sol";

/// @title 本地教学链一键部署脚本
/// @notice 在固定演示账户下部署酒水年龄验证平台的角色、年龄凭证根和商城。
contract Deploy is ScriptBase {
    string internal constant SAMPLE_CREDENTIAL_SET_FILE = "../zk/data/generated/alcohol-age/sample-credential-set.json";
    string internal constant SAMPLE_PRODUCTS_FILE = "../zk/data/generated/alcohol-age/sample-products.json";

    address internal constant ISSUER = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
    address internal constant SELLER = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;
    uint256 internal constant SELLER_PRIVATE_KEY =
        0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a;

    function run() external {
        string memory credentialSetJson = vm.readFile(SAMPLE_CREDENTIAL_SET_FILE);
        string memory productsJson = vm.readFile(SAMPLE_PRODUCTS_FILE);

        bytes32 setId = vm.parseJsonBytes32(credentialSetJson, ".setIdBytes32");

        vm.startBroadcast(ISSUER);

        AlcoholRoleRegistry roleRegistry = new AlcoholRoleRegistry(ISSUER);
        AgeCredentialRootRegistry rootRegistry = new AgeCredentialRootRegistry(address(roleRegistry));
        AlcoholAgeProofVerifier verifier = new AlcoholAgeProofVerifier();
        AlcoholAgeEligibilityVerifier eligibilityVerifier =
            new AlcoholAgeEligibilityVerifier(address(rootRegistry), address(verifier), address(roleRegistry));
        AlcoholMarketplace marketplace = new AlcoholMarketplace(address(roleRegistry), address(eligibilityVerifier));

        bytes memory buyersRaw = vm.parseJson(credentialSetJson, ".buyerAddresses");
        address[] memory buyers = abi.decode(buyersRaw, (address[]));
        roleRegistry.setBuyers(buyers, true);
        roleRegistry.setSeller(SELLER, true);
        _publishCredentialSet(rootRegistry, credentialSetJson);
        vm.stopBroadcast();

        vm.startBroadcast(SELLER_PRIVATE_KEY);
        _seedProduct(marketplace, productsJson, 0);
        _seedProduct(marketplace, productsJson, 1);
        vm.stopBroadcast();

        address(roleRegistry);
        address(rootRegistry);
        address(verifier);
        address(eligibilityVerifier);
        address(marketplace);
        setId;
    }

    function _publishCredentialSet(AgeCredentialRootRegistry rootRegistry, string memory json) internal {
        bytes32 setId = vm.parseJsonBytes32(json, ".setIdBytes32");
        uint256 merkleRoot = uint256(vm.parseJsonBytes32(json, ".merkleRootHex"));
        uint32 version = uint32(vm.parseJsonUint(json, ".version"));
        uint64 referenceDate = uint64(vm.parseJsonUint(json, ".referenceDate"));
        rootRegistry.publishCredentialSet(setId, merkleRoot, version, referenceDate);
    }

    function _seedProduct(AlcoholMarketplace marketplace, string memory productsJson, uint256 index) internal {
        string memory prefix = string.concat(".[", _toString(index), "]");
        bytes32 productId = vm.parseJsonBytes32(productsJson, string.concat(prefix, ".productIdBytes32"));
        uint256 priceWei = vm.parseJsonUint(productsJson, string.concat(prefix, ".priceWei"));
        uint32 stock = uint32(vm.parseJsonUint(productsJson, string.concat(prefix, ".stock")));
        string memory metadataURI = vm.parseJsonString(productsJson, string.concat(prefix, ".metadataURI"));
        marketplace.setProduct(productId, priceWei, stock, true, metadataURI);
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }

        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }

        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
