// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "../src/RevenueBatchRegistry.sol";
import "../src/CreatorRevenueDistributor.sol";

interface Vm {
    function deal(address who, uint256 newBalance) external;
    function assume(bool condition) external;
    function expectEmit(bool checkTopic1, bool checkTopic2, bool checkTopic3, bool checkData, address emitter)
        external;
}

contract Actor {
    function claim(
        CreatorRevenueDistributor distributor,
        bytes32 batchId,
        bytes32 claimId,
        address creator,
        uint256 grossAmount,
        address[] calldata recipients,
        uint16[] calldata bps,
        bytes32[] calldata proof
    ) external {
        distributor.claim(batchId, claimId, creator, grossAmount, recipients, bps, proof);
    }

    receive() external payable virtual {}
}

contract ReenteringCreator is Actor {
    CreatorRevenueDistributor private targetDistributor;
    bytes32 private targetBatchId;
    bytes32 private targetClaimId;
    uint256 private targetGrossAmount;
    address[] private targetRecipients;
    uint16[] private targetBps;
    bool private armed;
    bool private triggered;
    bool public lastAttackSucceeded;

    function arm(
        CreatorRevenueDistributor distributor,
        bytes32 batchId,
        bytes32 claimId,
        uint256 grossAmount,
        address[] memory recipients,
        uint16[] memory bps
    ) external {
        targetDistributor = distributor;
        targetBatchId = batchId;
        targetClaimId = claimId;
        targetGrossAmount = grossAmount;
        delete targetRecipients;
        delete targetBps;
        for (uint256 index = 0; index < recipients.length; index++) {
            targetRecipients.push(recipients[index]);
            targetBps.push(bps[index]);
        }
        armed = true;
        triggered = false;
        lastAttackSucceeded = false;
    }

    receive() external payable override {
        if (!armed || triggered) {
            return;
        }

        triggered = true;
        (bool ok,) = address(targetDistributor).call(
            abi.encodeWithSignature(
                "claim(bytes32,bytes32,address,uint256,address[],uint16[],bytes32[])",
                targetBatchId,
                targetClaimId,
                address(this),
                targetGrossAmount,
                targetRecipients,
                targetBps,
                new bytes32[](0)
            )
        );
        lastAttackSucceeded = ok;
    }
}

contract CreatorRevenueDistributorTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    RevenueBatchRegistry private registry;
    CreatorRevenueDistributor private distributor;
    Actor private creator;
    Actor private collaboratorA;
    Actor private collaboratorB;

    bytes32 private batchId;
    bytes32 private claimId;
    address[] private recipients;
    uint16[] private bps;
    uint256 private grossAmount;

    event BatchPublished(
        bytes32 indexed batchId,
        address indexed token,
        bytes32 merkleRoot,
        bytes32 metadataHash,
        uint64 publishedAt
    );
    event BatchContextCommitted(
        bytes32 indexed batchId,
        bytes32 indexed claimId,
        string monthLabel,
        string billId,
        uint256 grossAmount,
        address creator,
        uint64 committedAt
    );
    event BatchResumed(bytes32 indexed batchId, uint64 updatedAt);

    function setUp() public {
        creator = new Actor();
        collaboratorA = new Actor();
        collaboratorB = new Actor();

        registry = new RevenueBatchRegistry(address(this));
        distributor = new CreatorRevenueDistributor(address(this), address(registry));
        registry.setPublishOperator(address(distributor));

        vm.deal(address(this), 1_000 ether);

        batchId = keccak256(bytes("2026-04"));
        claimId = keccak256(bytes("BILL-202604-CREATOR"));
        grossAmount = 50 ether;

        recipients = new address[](3);
        recipients[0] = address(creator);
        recipients[1] = address(collaboratorA);
        recipients[2] = address(collaboratorB);

        bps = new uint16[](3);
        bps[0] = 6000;
        bps[1] = 2000;
        bps[2] = 2000;

        _activateBatch(batchId, claimId, "2026-04", "BILL-202604-CREATOR", address(creator), grossAmount, recipients, bps);
    }

    function testClaimDistributesFunds() public {
        uint256 creatorBalanceBefore = address(creator).balance;
        uint256 collaboratorABalanceBefore = address(collaboratorA).balance;
        uint256 collaboratorBBalanceBefore = address(collaboratorB).balance;

        creator.claim(distributor, batchId, claimId, address(creator), grossAmount, recipients, bps, new bytes32[](0));

        assertEq(address(creator).balance - creatorBalanceBefore, 30 ether, "creator should receive net amount");
        assertEq(address(collaboratorA).balance - collaboratorABalanceBefore, 10 ether, "collaborator A should receive split");
        assertEq(address(collaboratorB).balance - collaboratorBBalanceBefore, 10 ether, "collaborator B should receive split");
        assertTrue(distributor.isClaimed(batchId, claimId), "claim should be marked");
    }

    function testCannotClaimTwice() public {
        creator.claim(distributor, batchId, claimId, address(creator), grossAmount, recipients, bps, new bytes32[](0));

        (bool ok,) = address(creator).call(
            abi.encodeWithSignature(
                "claim(address,bytes32,bytes32,address,uint256,address[],uint16[],bytes32[])",
                address(distributor),
                batchId,
                claimId,
                address(creator),
                grossAmount,
                recipients,
                bps,
                new bytes32[](0)
            )
        );

        assertTrue(!ok, "duplicate claim must revert");
    }

    function testPausedBatchBlocksClaimUntilResume() public {
        registry.pauseBatch(batchId);

        (bool pausedClaimOk,) = address(creator).call(
            abi.encodeWithSignature(
                "claim(address,bytes32,bytes32,address,uint256,address[],uint16[],bytes32[])",
                address(distributor),
                batchId,
                claimId,
                address(creator),
                grossAmount,
                recipients,
                bps,
                new bytes32[](0)
            )
        );
        assertTrue(!pausedClaimOk, "paused batch must reject claim");

        uint64 resumeTimestamp = uint64(block.timestamp);
        vm.expectEmit(true, false, false, true, address(registry));
        emit BatchResumed(batchId, resumeTimestamp);
        registry.resumeBatch(batchId);

        creator.claim(distributor, batchId, claimId, address(creator), grossAmount, recipients, bps, new bytes32[](0));
        assertTrue(distributor.isClaimed(batchId, claimId), "claim should succeed after resume");
    }

    function testWrongLeafDataFails() public {
        (bool ok,) = address(creator).call(
            abi.encodeWithSignature(
                "claim(address,bytes32,bytes32,address,uint256,address[],uint16[],bytes32[])",
                address(distributor),
                batchId,
                claimId,
                address(creator),
                grossAmount + 1,
                recipients,
                bps,
                new bytes32[](0)
            )
        );

        assertTrue(!ok, "wrong amount should fail proof verification");
    }

    function testInsufficientLiquidityFails() public {
        RevenueBatchRegistry emptyRegistry = new RevenueBatchRegistry(address(this));
        CreatorRevenueDistributor emptyDistributor = new CreatorRevenueDistributor(address(this), address(emptyRegistry));

        bytes32 emptyBatchId = keccak256(bytes("EMPTY-BATCH"));
        bytes32 emptyClaimId = keccak256(bytes("EMPTY-CLAIM"));
        bytes32 root = keccak256(abi.encode(emptyBatchId, emptyClaimId, address(creator), grossAmount, recipients, bps));
        emptyRegistry.publishBatch(emptyBatchId, address(0), root, keccak256("meta"));

        (bool ok,) = address(creator).call(
            abi.encodeWithSignature(
                "claim(address,bytes32,bytes32,address,uint256,address[],uint16[],bytes32[])",
                address(emptyDistributor),
                emptyBatchId,
                emptyClaimId,
                address(creator),
                grossAmount,
                recipients,
                bps,
                new bytes32[](0)
            )
        );

        assertTrue(!ok, "claim should fail without enough ETH");
    }

    function testPublishBatchRejectsNonNativeToken() public {
        bytes32 freshBatchId = keccak256(bytes("2026-05"));
        (bool ok,) = address(registry).call(
            abi.encodeWithSignature("publishBatch(bytes32,address,bytes32,bytes32)", freshBatchId, address(1), keccak256("root"), keccak256("meta"))
        );

        assertTrue(!ok, "registry should reject non-native token address");
    }

    function testActivateBatchWithFundingEmitsRegistryEventsAndLocksBatch() public {
        bytes32 nextBatchId = keccak256(bytes("2026-05"));
        bytes32 nextClaimId = keccak256(bytes("BILL-202605-CREATOR"));
        uint256 nextGrossAmount = 75 ether;
        bytes32 contextRoot = keccak256(abi.encode(nextBatchId, nextClaimId, address(creator), nextGrossAmount, recipients, bps));
        bytes32 contextMetadataHash = keccak256("context-meta");
        uint64 contextTimestamp = uint64(block.timestamp);
        uint256 balanceBefore = address(distributor).balance;

        vm.expectEmit(true, true, false, true, address(registry));
        emit BatchPublished(nextBatchId, address(0), contextRoot, contextMetadataHash, contextTimestamp);

        vm.expectEmit(true, true, false, true, address(registry));
        emit BatchContextCommitted(
            nextBatchId,
            nextClaimId,
            "2026-05",
            "BILL-202605-CREATOR",
            nextGrossAmount,
            address(creator),
            contextTimestamp
        );

        distributor.activateBatchWithFunding{value: nextGrossAmount}(
            nextBatchId,
            contextRoot,
            contextMetadataHash,
            nextClaimId,
            "2026-05",
            "BILL-202605-CREATOR",
            nextGrossAmount,
            address(creator)
        );

        assertEq(address(distributor).balance, balanceBefore + nextGrossAmount, "activation should increase distributor balance");
        assertTrue(distributor.isBatchActivated(nextBatchId), "batch should be locked after activation");
        assertTrue(registry.isBatchClaimable(nextBatchId), "activated batch should be claimable");
    }

    function testActivateBatchWithFundingRejectsWrongValue() public {
        bytes32 nextBatchId = keccak256(bytes("2026-06"));
        bytes32 nextClaimId = keccak256(bytes("BILL-202606-CREATOR"));
        uint256 nextGrossAmount = 80 ether;
        bytes32 root = keccak256(abi.encode(nextBatchId, nextClaimId, address(creator), nextGrossAmount, recipients, bps));

        (bool ok,) = address(distributor).call{value: nextGrossAmount - 1}(
            abi.encodeWithSignature(
                "activateBatchWithFunding(bytes32,bytes32,bytes32,bytes32,string,string,uint256,address)",
                nextBatchId,
                root,
                keccak256("meta"),
                nextClaimId,
                "2026-06",
                "BILL-202606-CREATOR",
                nextGrossAmount,
                address(creator)
            )
        );

        assertTrue(!ok, "activation with mismatched funding must revert");
    }

    function testActivateBatchWithFundingOnlyOwner() public {
        bytes32 nextBatchId = keccak256(bytes("2026-07"));
        bytes32 nextClaimId = keccak256(bytes("BILL-202607-CREATOR"));
        uint256 nextGrossAmount = 90 ether;
        bytes32 root = keccak256(abi.encode(nextBatchId, nextClaimId, address(creator), nextGrossAmount, recipients, bps));

        (bool ok,) = address(creator).call{value: nextGrossAmount}(
            abi.encodeWithSignature(
                "activateBatchWithFunding(address,bytes32,bytes32,bytes32,bytes32,string,string,uint256,address)",
                address(distributor),
                nextBatchId,
                root,
                keccak256("meta"),
                nextClaimId,
                "2026-07",
                "BILL-202607-CREATOR",
                nextGrossAmount,
                address(creator)
            )
        );

        assertTrue(!ok, "non-owner should not be able to activate batch");
    }

    function testDuplicateBatchActivationReverts() public {
        bytes32 nextBatchId = keccak256(bytes("2026-08"));
        bytes32 nextClaimId = keccak256(bytes("BILL-202608-CREATOR"));
        uint256 nextGrossAmount = 100 ether;
        bytes32 root = keccak256(abi.encode(nextBatchId, nextClaimId, address(creator), nextGrossAmount, recipients, bps));
        bytes32 metadataHash = keccak256("duplicate-meta");

        distributor.activateBatchWithFunding{value: nextGrossAmount}(
            nextBatchId,
            root,
            metadataHash,
            nextClaimId,
            "2026-08",
            "BILL-202608-CREATOR",
            nextGrossAmount,
            address(creator)
        );

        (bool ok,) = address(distributor).call{value: nextGrossAmount}(
            abi.encodeWithSignature(
                "activateBatchWithFunding(bytes32,bytes32,bytes32,bytes32,string,string,uint256,address)",
                nextBatchId,
                root,
                metadataHash,
                nextClaimId,
                "2026-08",
                "BILL-202608-CREATOR",
                nextGrossAmount,
                address(creator)
            )
        );

        assertTrue(!ok, "same batch must not activate twice");
    }

    function testDirectFundingDisabled() public {
        (bool ok,) = address(distributor).call{value: 1 ether}("");
        assertTrue(!ok, "direct funding must revert");
    }

    function testReentrancyDuringClaimFails() public {
        ReenteringCreator attacker = new ReenteringCreator();
        address[] memory attackRecipients = new address[](3);
        attackRecipients[0] = address(attacker);
        attackRecipients[1] = address(collaboratorA);
        attackRecipients[2] = address(collaboratorB);

        uint16[] memory attackBps = new uint16[](3);
        attackBps[0] = 6000;
        attackBps[1] = 2000;
        attackBps[2] = 2000;

        bytes32 attackBatchId = keccak256(bytes("2026-09"));
        bytes32 attackClaimId = keccak256(bytes("BILL-202609-ATTACK"));
        _activateBatch(
            attackBatchId,
            attackClaimId,
            "2026-09",
            "BILL-202609-ATTACK",
            address(attacker),
            grossAmount,
            attackRecipients,
            attackBps
        );

        attacker.arm(distributor, attackBatchId, attackClaimId, grossAmount, attackRecipients, attackBps);
        attacker.claim(distributor, attackBatchId, attackClaimId, address(attacker), grossAmount, attackRecipients, attackBps, new bytes32[](0));

        assertTrue(distributor.isClaimed(attackBatchId, attackClaimId), "attack claim should still be marked");
        assertTrue(!attacker.lastAttackSucceeded(), "reentrant claim should fail");
    }

    function testFuzzRejectsInvalidBpsTotal(uint16 creatorBps, uint16 collaboratorABps, uint16 collaboratorBBps) public {
        uint256 totalBps = uint256(creatorBps) + uint256(collaboratorABps) + uint256(collaboratorBBps);
        vm.assume(totalBps > 0 && totalBps != 10_000);

        address[] memory fuzzRecipients = new address[](3);
        fuzzRecipients[0] = address(creator);
        fuzzRecipients[1] = address(collaboratorA);
        fuzzRecipients[2] = address(collaboratorB);

        uint16[] memory fuzzBps = new uint16[](3);
        fuzzBps[0] = creatorBps;
        fuzzBps[1] = collaboratorABps;
        fuzzBps[2] = collaboratorBBps;

        bytes32 fuzzBatchId = keccak256(abi.encodePacked("FUZZ-INVALID-BPS-BATCH", creatorBps, collaboratorABps, collaboratorBBps));
        bytes32 fuzzClaimId = keccak256(abi.encodePacked("FUZZ-INVALID-BPS-CLAIM", creatorBps, collaboratorABps, collaboratorBBps));
        uint256 fuzzGrossAmount = 20 ether;
        _activateBatch(fuzzBatchId, fuzzClaimId, "fuzz-invalid-bps", "FUZZ-BILL-INVALID-BPS", address(creator), fuzzGrossAmount, fuzzRecipients, fuzzBps);

        (bool ok,) = address(creator).call(
            abi.encodeWithSignature(
                "claim(address,bytes32,bytes32,address,uint256,address[],uint16[],bytes32[])",
                address(distributor),
                fuzzBatchId,
                fuzzClaimId,
                address(creator),
                fuzzGrossAmount,
                fuzzRecipients,
                fuzzBps,
                new bytes32[](0)
            )
        );

        assertTrue(!ok, "invalid bps total must revert");
    }

    function testFuzzClaimCannotRepeat(uint96 grossAmountSeed) public {
        uint256 fuzzGrossAmount = (uint256(grossAmountSeed) % 50 ether) + 1;
        bytes32 fuzzBatchId = keccak256(abi.encodePacked("FUZZ-REPEAT-BATCH", fuzzGrossAmount));
        bytes32 fuzzClaimId = keccak256(abi.encodePacked("FUZZ-REPEAT-CLAIM", fuzzGrossAmount));
        _activateBatch(fuzzBatchId, fuzzClaimId, "fuzz-repeat", "FUZZ-BILL-REPEAT", address(creator), fuzzGrossAmount, recipients, bps);

        creator.claim(distributor, fuzzBatchId, fuzzClaimId, address(creator), fuzzGrossAmount, recipients, bps, new bytes32[](0));

        (bool ok,) = address(creator).call(
            abi.encodeWithSignature(
                "claim(address,bytes32,bytes32,address,uint256,address[],uint16[],bytes32[])",
                address(distributor),
                fuzzBatchId,
                fuzzClaimId,
                address(creator),
                fuzzGrossAmount,
                recipients,
                bps,
                new bytes32[](0)
            )
        );

        assertTrue(!ok, "fuzzed duplicate claim must revert");
    }

    function testFuzzTailDistributionMatchesGross(uint96 grossAmountSeed, uint16 creatorBps, uint16 collaboratorABps) public {
        vm.assume(uint256(creatorBps) + uint256(collaboratorABps) <= 10_000);

        uint16 collaboratorBBps = uint16(10_000 - uint256(creatorBps) - uint256(collaboratorABps));
        uint256 fuzzGrossAmount = (uint256(grossAmountSeed) % 50 ether) + 1;

        address[] memory fuzzRecipients = new address[](3);
        fuzzRecipients[0] = address(creator);
        fuzzRecipients[1] = address(collaboratorA);
        fuzzRecipients[2] = address(collaboratorB);

        uint16[] memory fuzzBps = new uint16[](3);
        fuzzBps[0] = creatorBps;
        fuzzBps[1] = collaboratorABps;
        fuzzBps[2] = collaboratorBBps;

        bytes32 fuzzBatchId = keccak256(abi.encodePacked("FUZZ-TAIL-BATCH", fuzzGrossAmount, creatorBps, collaboratorABps));
        bytes32 fuzzClaimId = keccak256(abi.encodePacked("FUZZ-TAIL-CLAIM", fuzzGrossAmount, creatorBps, collaboratorABps));
        _activateBatch(fuzzBatchId, fuzzClaimId, "fuzz-tail", "FUZZ-BILL-TAIL", address(creator), fuzzGrossAmount, fuzzRecipients, fuzzBps);

        uint256 creatorBalanceBefore = address(creator).balance;
        uint256 collaboratorABalanceBefore = address(collaboratorA).balance;
        uint256 collaboratorBBalanceBefore = address(collaboratorB).balance;

        creator.claim(distributor, fuzzBatchId, fuzzClaimId, address(creator), fuzzGrossAmount, fuzzRecipients, fuzzBps, new bytes32[](0));

        uint256 creatorReceived = address(creator).balance - creatorBalanceBefore;
        uint256 collaboratorAReceived = address(collaboratorA).balance - collaboratorABalanceBefore;
        uint256 collaboratorBReceived = address(collaboratorB).balance - collaboratorBBalanceBefore;
        uint256 expectedCreatorReceived = (fuzzGrossAmount * creatorBps) / 10_000;
        uint256 expectedCollaboratorAReceived = (fuzzGrossAmount * collaboratorABps) / 10_000;
        uint256 expectedCollaboratorBReceived = fuzzGrossAmount - expectedCreatorReceived - expectedCollaboratorAReceived;

        assertEq(creatorReceived, expectedCreatorReceived, "creator split should match calculated amount");
        assertEq(collaboratorAReceived, expectedCollaboratorAReceived, "collaborator A split should match calculated amount");
        assertEq(collaboratorBReceived, expectedCollaboratorBReceived, "tail split should absorb rounding remainder");
        assertEq(
            creatorReceived + collaboratorAReceived + collaboratorBReceived,
            fuzzGrossAmount,
            "distributed total should always equal gross amount"
        );
    }

    function _activateBatch(
        bytes32 targetBatchId,
        bytes32 targetClaimId,
        string memory monthLabel,
        string memory billId,
        address targetCreator,
        uint256 targetGrossAmount,
        address[] memory targetRecipients,
        uint16[] memory targetBps
    ) internal {
        bytes32 root = keccak256(abi.encode(targetBatchId, targetClaimId, targetCreator, targetGrossAmount, targetRecipients, targetBps));
        distributor.activateBatchWithFunding{value: targetGrossAmount}(
            targetBatchId,
            root,
            keccak256(abi.encodePacked(monthLabel, billId, "meta")),
            targetClaimId,
            monthLabel,
            billId,
            targetGrossAmount,
            targetCreator
        );
    }

    function assertEq(uint256 left, uint256 right, string memory message) internal pure {
        require(left == right, message);
    }

    function assertTrue(bool value, string memory message) internal pure {
        require(value, message);
    }
}
