// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { TestBase } from "./helpers/TestBase.sol";
import { AlcoholRoleRegistry } from "../src/AlcoholRoleRegistry.sol";
import { AgeCredentialRootRegistry } from "../src/AgeCredentialRootRegistry.sol";
import { AlcoholAgeEligibilityVerifier } from "../src/AlcoholAgeEligibilityVerifier.sol";
import { AlcoholAgeProofVerifier } from "../src/AlcoholAgeProofVerifier.sol";
import { AlcoholMarketplace } from "../src/AlcoholMarketplace.sol";
import { SampleAlcoholAgeFixture } from "./generated/SampleAlcoholAgeFixture.sol";

contract AlcoholMarketplaceTest is TestBase {
    address internal constant ISSUER = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
    address internal constant SELLER = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;
    address internal buyer;

    AlcoholRoleRegistry internal roleRegistry;
    AgeCredentialRootRegistry internal rootRegistry;
    AlcoholAgeProofVerifier internal verifier;
    AlcoholAgeEligibilityVerifier internal eligibilityVerifier;
    AlcoholMarketplace internal marketplace;

    function setUp() public {
        buyer = SampleAlcoholAgeFixture.sampleRecipient();
        vm.warp(SampleAlcoholAgeFixture.referenceDate());
        roleRegistry = new AlcoholRoleRegistry(ISSUER);
        rootRegistry = new AgeCredentialRootRegistry(address(roleRegistry));
        verifier = new AlcoholAgeProofVerifier();
        eligibilityVerifier = new AlcoholAgeEligibilityVerifier(address(rootRegistry), address(verifier), address(roleRegistry));
        marketplace = new AlcoholMarketplace(address(roleRegistry), address(eligibilityVerifier));

        vm.startPrank(ISSUER);
        roleRegistry.setBuyer(buyer, true);
        roleRegistry.setSeller(SELLER, true);
        rootRegistry.publishCredentialSet(
            SampleAlcoholAgeFixture.credentialSetId(),
            SampleAlcoholAgeFixture.merkleRoot(),
            SampleAlcoholAgeFixture.version(),
            SampleAlcoholAgeFixture.referenceDate()
        );
        vm.stopPrank();

        vm.prank(SELLER);
        marketplace.setProduct(
            SampleAlcoholAgeFixture.firstProductId(),
            SampleAlcoholAgeFixture.firstProductPriceWei(),
            SampleAlcoholAgeFixture.firstProductStock(),
            true,
            "demo://products/vodka"
        );

        vm.deal(buyer, 10 ether);
        vm.deal(SELLER, 0);
    }

    function test_purchaseProduct_revertsWithoutEligibility() public {
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(AlcoholMarketplace.BuyerNotEligible.selector, buyer));
        marketplace.purchaseProduct{ value: SampleAlcoholAgeFixture.firstProductPriceWei() }(
            SampleAlcoholAgeFixture.firstProductId(),
            1
        );
    }

    function test_purchaseProduct_succeedsAndWithdrawClearsBalance() public {
        uint32 quantity = 2;
        uint256 totalPrice = SampleAlcoholAgeFixture.firstProductPriceWei() * quantity;

        vm.prank(buyer);
        eligibilityVerifier.verifyEligibility(
            SampleAlcoholAgeFixture.credentialSetId(),
            SampleAlcoholAgeFixture.sampleVerificationDateYmd(),
            SampleAlcoholAgeFixture.proofA(),
            SampleAlcoholAgeFixture.proofB(),
            SampleAlcoholAgeFixture.proofC()
        );

        vm.prank(buyer);
        bytes32 orderId =
            marketplace.purchaseProduct{ value: totalPrice }(SampleAlcoholAgeFixture.firstProductId(), quantity);

        AlcoholMarketplace.Product memory product = marketplace.getProduct(SampleAlcoholAgeFixture.firstProductId());
        AlcoholMarketplace.Order memory order = marketplace.getOrder(orderId);
        assertEqUint32(product.stock, SampleAlcoholAgeFixture.firstProductStock() - quantity, "stock should decrement");
        assertEqUint256(marketplace.pendingBalanceOf(SELLER), totalPrice, "seller escrow mismatch");
        assertTrue(orderId != bytes32(0), "order should be created");
        assertEqUint32(order.quantity, quantity, "order quantity mismatch");
        assertEqUint256(order.totalPriceWei, totalPrice, "order total mismatch");

        vm.prank(SELLER);
        marketplace.withdraw();

        assertEqUint256(marketplace.pendingBalanceOf(SELLER), 0, "withdraw should clear balance");
        assertEqUint256(SELLER.balance, totalPrice, "seller should receive ETH");
    }

    function test_purchaseProduct_revertsWhenQuantityIsZero() public {
        vm.prank(buyer);
        eligibilityVerifier.verifyEligibility(
            SampleAlcoholAgeFixture.credentialSetId(),
            SampleAlcoholAgeFixture.sampleVerificationDateYmd(),
            SampleAlcoholAgeFixture.proofA(),
            SampleAlcoholAgeFixture.proofB(),
            SampleAlcoholAgeFixture.proofC()
        );

        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(AlcoholMarketplace.InvalidQuantity.selector, uint32(0)));
        marketplace.purchaseProduct{ value: 0 }(SampleAlcoholAgeFixture.firstProductId(), 0);
    }

    function test_purchaseProduct_revertsWhenQuantityExceedsStock() public {
        uint32 requested = SampleAlcoholAgeFixture.firstProductStock() + 1;
        vm.deal(buyer, SampleAlcoholAgeFixture.firstProductPriceWei() * requested);

        vm.prank(buyer);
        eligibilityVerifier.verifyEligibility(
            SampleAlcoholAgeFixture.credentialSetId(),
            SampleAlcoholAgeFixture.sampleVerificationDateYmd(),
            SampleAlcoholAgeFixture.proofA(),
            SampleAlcoholAgeFixture.proofB(),
            SampleAlcoholAgeFixture.proofC()
        );

        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(
                AlcoholMarketplace.OutOfStock.selector,
                SampleAlcoholAgeFixture.firstProductId(),
                requested,
                SampleAlcoholAgeFixture.firstProductStock()
            )
        );
        marketplace.purchaseProduct{ value: SampleAlcoholAgeFixture.firstProductPriceWei() * requested }(
            SampleAlcoholAgeFixture.firstProductId(),
            requested
        );
    }

    function test_purchaseProduct_revertsWhenVersionChanges() public {
        vm.prank(buyer);
        eligibilityVerifier.verifyEligibility(
            SampleAlcoholAgeFixture.credentialSetId(),
            SampleAlcoholAgeFixture.sampleVerificationDateYmd(),
            SampleAlcoholAgeFixture.proofA(),
            SampleAlcoholAgeFixture.proofB(),
            SampleAlcoholAgeFixture.proofC()
        );

        vm.prank(ISSUER);
        rootRegistry.publishCredentialSet(
            SampleAlcoholAgeFixture.credentialSetId(),
            SampleAlcoholAgeFixture.merkleRoot(),
            SampleAlcoholAgeFixture.version() + 1,
            SampleAlcoholAgeFixture.referenceDate()
        );

        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(AlcoholMarketplace.BuyerNotEligible.selector, buyer));
        marketplace.purchaseProduct{ value: SampleAlcoholAgeFixture.firstProductPriceWei() }(
            SampleAlcoholAgeFixture.firstProductId(),
            1
        );
    }

    function test_purchaseProduct_revertsWhenInactiveOrOutOfStock() public {
        vm.prank(buyer);
        eligibilityVerifier.verifyEligibility(
            SampleAlcoholAgeFixture.credentialSetId(),
            SampleAlcoholAgeFixture.sampleVerificationDateYmd(),
            SampleAlcoholAgeFixture.proofA(),
            SampleAlcoholAgeFixture.proofB(),
            SampleAlcoholAgeFixture.proofC()
        );

        vm.prank(SELLER);
        marketplace.setProductStatus(SampleAlcoholAgeFixture.firstProductId(), false);

        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(AlcoholMarketplace.ProductInactive.selector, SampleAlcoholAgeFixture.firstProductId())
        );
        marketplace.purchaseProduct{ value: SampleAlcoholAgeFixture.firstProductPriceWei() }(
            SampleAlcoholAgeFixture.firstProductId(),
            1
        );

        vm.prank(SELLER);
        marketplace.setProductStatus(SampleAlcoholAgeFixture.firstProductId(), true);
        vm.prank(SELLER);
        marketplace.updateProductStock(SampleAlcoholAgeFixture.firstProductId(), 0);

        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(
                AlcoholMarketplace.OutOfStock.selector,
                SampleAlcoholAgeFixture.firstProductId(),
                uint32(1),
                uint32(0)
            )
        );
        marketplace.purchaseProduct{ value: SampleAlcoholAgeFixture.firstProductPriceWei() }(
            SampleAlcoholAgeFixture.firstProductId(),
            1
        );
    }
}
