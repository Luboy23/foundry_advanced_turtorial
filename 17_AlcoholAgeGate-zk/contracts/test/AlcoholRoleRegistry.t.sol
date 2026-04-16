// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { TestBase } from "./helpers/TestBase.sol";
import { AlcoholRoleRegistry } from "../src/AlcoholRoleRegistry.sol";

contract AlcoholRoleRegistryTest is TestBase {
    address internal constant ISSUER = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
    address internal constant BUYER = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    address internal constant SELLER = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;
    address internal constant OTHER = address(0xBEEF);

    AlcoholRoleRegistry internal registry;

    function setUp() public {
        registry = new AlcoholRoleRegistry(ISSUER);
    }

    function test_issuerConfiguredOnDeploy() public view {
        assertEqAddress(registry.getIssuer(), ISSUER, "issuer mismatch");
        assertEqBool(registry.isIssuer(ISSUER), true, "issuer should be recognized");
    }

    function test_setBuyerAndSeller_updatesWhitelist() public {
        vm.prank(ISSUER);
        registry.setBuyer(BUYER, true);

        vm.prank(ISSUER);
        registry.setSeller(SELLER, true);

        assertEqBool(registry.isBuyer(BUYER), true, "buyer should be whitelisted");
        assertEqBool(registry.isSeller(SELLER), true, "seller should be whitelisted");
        assertEqBool(registry.isWhitelisted(BUYER), true, "buyer should be globally whitelisted");
        assertEqBool(registry.isWhitelisted(SELLER), true, "seller should be globally whitelisted");
        assertEqAddress(registry.getSeller(), SELLER, "seller mismatch");
    }

    function test_setBuyers_updatesWhitelistInBatch() public {
        address[] memory buyers = new address[](2);
        buyers[0] = BUYER;
        buyers[1] = OTHER;

        vm.prank(ISSUER);
        registry.setBuyers(buyers, true);

        assertEqBool(registry.isBuyer(BUYER), true, "first buyer should be whitelisted");
        assertEqBool(registry.isBuyer(OTHER), true, "second buyer should be whitelisted");
        assertEqBool(registry.isWhitelisted(BUYER), true, "first buyer should be globally whitelisted");
        assertEqBool(registry.isWhitelisted(OTHER), true, "second buyer should be globally whitelisted");
    }

    function test_nonIssuerCannotManageRegistry() public {
        vm.prank(OTHER);
        vm.expectRevert(abi.encodeWithSelector(AlcoholRoleRegistry.Unauthorized.selector, OTHER));
        registry.setBuyer(BUYER, true);
    }
}
