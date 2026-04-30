// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "../src/RevenueBatchRegistry.sol";
import "../src/CreatorRevenueDistributor.sol";

interface Vm {
    function envOr(string calldata key, uint256 defaultValue) external returns (uint256 value);
    function envOr(string calldata key, address defaultValue) external returns (address value);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
    function addr(uint256 privateKey) external returns (address);
    function projectRoot() external view returns (string memory);
    function serializeAddress(string calldata objectKey, string calldata valueKey, address value)
        external
        returns (string memory json);
    function serializeBytes32(string calldata objectKey, string calldata valueKey, bytes32 value)
        external
        returns (string memory json);
    function serializeUint(string calldata objectKey, string calldata valueKey, uint256 value)
        external
        returns (string memory json);
    function serializeString(string calldata objectKey, string calldata valueKey, string calldata value)
        external
        returns (string memory json);
    function writeJson(string calldata json, string calldata path) external;
}

contract Deploy {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 internal constant DEFAULT_DEPLOYER_KEY =
        0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    uint256 internal constant DEFAULT_CREATOR_KEY =
        0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
    address internal constant DEFAULT_COLLABORATOR_A = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;
    address internal constant DEFAULT_COLLABORATOR_B = 0x90F79bf6EB2c4f870365E785982E1f101E93b906;

    uint256 internal constant CURRENT_GROSS_AMOUNT = 80 ether;
    uint256 internal constant PREVIOUS_MONTH_GROSS_AMOUNT = 50 ether;
    uint256 internal constant TWO_MONTHS_AGO_GROSS_AMOUNT = 100 ether;
    uint256 internal constant THREE_MONTHS_AGO_GROSS_AMOUNT = 200 ether;

    uint256 internal constant SECONDS_PER_DAY = 24 * 60 * 60;
    int256 internal constant OFFSET19700101 = 2440588;

    struct BatchClaim {
        string label;
        string billId;
        bytes32 batchId;
        bytes32 claimId;
        uint256 grossAmount;
        bytes32 root;
        bytes32 metadataHash;
        address[] recipients;
        uint16[] bps;
    }

    function run() external {
        uint256 deployerKey = vm.envOr("PRIVATE_KEY", DEFAULT_DEPLOYER_KEY);
        uint256 creatorKey = vm.envOr("CREATOR_PRIVATE_KEY", DEFAULT_CREATOR_KEY);
        address collaboratorA = vm.envOr("COLLABORATOR_A_ADDRESS", DEFAULT_COLLABORATOR_A);
        address collaboratorB = vm.envOr("COLLABORATOR_B_ADDRESS", DEFAULT_COLLABORATOR_B);
        address creator = vm.addr(creatorKey);
        address owner = vm.addr(deployerKey);
        uint256 startBlock = block.number + 1;
        (uint256 currentYear, uint256 currentMonth) = _timestampToYearMonth(block.timestamp);

        BatchClaim memory currentBatch = _buildBatchAtOffset(
            currentYear,
            currentMonth,
            0,
            creator,
            collaboratorA,
            collaboratorB,
            CURRENT_GROSS_AMOUNT
        );
        BatchClaim memory previousMonth = _buildBatchAtOffset(
            currentYear,
            currentMonth,
            1,
            creator,
            collaboratorA,
            collaboratorB,
            PREVIOUS_MONTH_GROSS_AMOUNT
        );
        BatchClaim memory twoMonthsAgo = _buildBatchAtOffset(
            currentYear,
            currentMonth,
            2,
            creator,
            collaboratorA,
            collaboratorB,
            TWO_MONTHS_AGO_GROSS_AMOUNT
        );
        BatchClaim memory threeMonthsAgo = _buildBatchAtOffset(
            currentYear,
            currentMonth,
            3,
            creator,
            collaboratorA,
            collaboratorB,
            THREE_MONTHS_AGO_GROSS_AMOUNT
        );

        vm.startBroadcast(deployerKey);

        RevenueBatchRegistry registry = new RevenueBatchRegistry(owner);
        CreatorRevenueDistributor distributor = new CreatorRevenueDistributor(owner, address(registry));
        registry.setPublishOperator(address(distributor));

        distributor.activateBatchWithFunding{value: currentBatch.grossAmount}(
            currentBatch.batchId,
            currentBatch.root,
            currentBatch.metadataHash,
            currentBatch.claimId,
            currentBatch.label,
            currentBatch.billId,
            currentBatch.grossAmount,
            creator
        );
        distributor.activateBatchWithFunding{value: previousMonth.grossAmount}(
            previousMonth.batchId,
            previousMonth.root,
            previousMonth.metadataHash,
            previousMonth.claimId,
            previousMonth.label,
            previousMonth.billId,
            previousMonth.grossAmount,
            creator
        );
        distributor.activateBatchWithFunding{value: twoMonthsAgo.grossAmount}(
            twoMonthsAgo.batchId,
            twoMonthsAgo.root,
            twoMonthsAgo.metadataHash,
            twoMonthsAgo.claimId,
            twoMonthsAgo.label,
            twoMonthsAgo.billId,
            twoMonthsAgo.grossAmount,
            creator
        );
        distributor.activateBatchWithFunding{value: threeMonthsAgo.grossAmount}(
            threeMonthsAgo.batchId,
            threeMonthsAgo.root,
            threeMonthsAgo.metadataHash,
            threeMonthsAgo.claimId,
            threeMonthsAgo.label,
            threeMonthsAgo.billId,
            threeMonthsAgo.grossAmount,
            creator
        );

        vm.stopBroadcast();

        vm.startBroadcast(creatorKey);
        distributor.claim(
            threeMonthsAgo.batchId,
            threeMonthsAgo.claimId,
            creator,
            threeMonthsAgo.grossAmount,
            threeMonthsAgo.recipients,
            threeMonthsAgo.bps,
            new bytes32[](0)
        );
        distributor.claim(
            twoMonthsAgo.batchId,
            twoMonthsAgo.claimId,
            creator,
            twoMonthsAgo.grossAmount,
            twoMonthsAgo.recipients,
            twoMonthsAgo.bps,
            new bytes32[](0)
        );
        distributor.claim(
            previousMonth.batchId,
            previousMonth.claimId,
            creator,
            previousMonth.grossAmount,
            previousMonth.recipients,
            previousMonth.bps,
            new bytes32[](0)
        );
        vm.stopBroadcast();

        vm.startBroadcast(deployerKey);
        registry.closeBatch(previousMonth.batchId);
        registry.closeBatch(twoMonthsAgo.batchId);
        registry.closeBatch(threeMonthsAgo.batchId);
        vm.stopBroadcast();

        _writeDeploymentManifest(
            owner,
            creator,
            collaboratorA,
            collaboratorB,
            address(registry),
            address(distributor),
            currentBatch,
            startBlock
        );
    }

    function _buildBatchAtOffset(
        uint256 currentYear,
        uint256 currentMonth,
        uint256 offset,
        address creator,
        address collaboratorA,
        address collaboratorB,
        uint256 grossAmount
    ) internal pure returns (BatchClaim memory batchClaim) {
        (uint256 year, uint256 month) = _subtractMonths(currentYear, currentMonth, offset);
        string memory label = _monthLabel(year, month);
        string memory billId = _billId(year, month);
        return _buildBatch(label, billId, creator, collaboratorA, collaboratorB, grossAmount);
    }

    function _buildBatch(
        string memory label,
        string memory billId,
        address creator,
        address collaboratorA,
        address collaboratorB,
        uint256 grossAmount
    ) internal pure returns (BatchClaim memory batchClaim) {
        address[] memory recipients = new address[](3);
        recipients[0] = creator;
        recipients[1] = collaboratorA;
        recipients[2] = collaboratorB;

        uint16[] memory bps = new uint16[](3);
        bps[0] = 6000;
        bps[1] = 2000;
        bps[2] = 2000;

        bytes32 batchId = keccak256(bytes(label));
        bytes32 claimId = keccak256(bytes(billId));

        batchClaim = BatchClaim({
            label: label,
            billId: billId,
            batchId: batchId,
            claimId: claimId,
            grossAmount: grossAmount,
            root: keccak256(abi.encode(batchId, claimId, creator, grossAmount, recipients, bps)),
            metadataHash: keccak256(abi.encodePacked(label, billId, "creator-revenue-center")),
            recipients: recipients,
            bps: bps
        });
    }

    function _subtractMonths(uint256 year, uint256 month, uint256 offset) internal pure returns (uint256, uint256) {
        uint256 absoluteMonth = year * 12 + (month - 1);
        uint256 targetAbsoluteMonth = absoluteMonth - offset;
        return (targetAbsoluteMonth / 12, (targetAbsoluteMonth % 12) + 1);
    }

    function _monthLabel(uint256 year, uint256 month) internal pure returns (string memory) {
        return string.concat(_uintToString(year), "-", _twoDigits(month));
    }

    function _billId(uint256 year, uint256 month) internal pure returns (string memory) {
        return string.concat("BILL-", _uintToString(year), _twoDigits(month), "-CREATOR");
    }

    function _twoDigits(uint256 value) internal pure returns (string memory) {
        if (value >= 10) {
            return _uintToString(value);
        }
        return string.concat("0", _uintToString(value));
    }

    function _uintToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }

        uint256 digits;
        uint256 temp = value;
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

    function _timestampToYearMonth(uint256 timestamp) internal pure returns (uint256 year, uint256 month) {
        (year, month,) = _daysToDate(timestamp / SECONDS_PER_DAY);
    }

    function _daysToDate(uint256 _days) internal pure returns (uint256 year, uint256 month, uint256 day) {
        int256 __days = int256(_days);

        int256 L = __days + 68569 + OFFSET19700101;
        int256 N = (4 * L) / 146097;
        L = L - (146097 * N + 3) / 4;
        int256 _year = (4000 * (L + 1)) / 1461001;
        L = L - (1461 * _year) / 4 + 31;
        int256 _month = (80 * L) / 2447;
        int256 _day = L - (2447 * _month) / 80;
        L = _month / 11;
        _month = _month + 2 - 12 * L;
        _year = 100 * (N - 49) + _year + L;

        year = uint256(_year);
        month = uint256(_month);
        day = uint256(_day);
    }

    function _writeDeploymentManifest(
        address owner,
        address creator,
        address collaboratorA,
        address collaboratorB,
        address registry,
        address distributor,
        BatchClaim memory currentBatch,
        uint256 startBlock
    ) internal {
        string memory path = string.concat(vm.projectRoot(), "/deployments/local.json");

        vm.serializeAddress("deployment", "owner", owner);
        vm.serializeAddress("deployment", "creator", creator);
        vm.serializeAddress("deployment", "collaboratorA", collaboratorA);
        vm.serializeAddress("deployment", "collaboratorB", collaboratorB);
        vm.serializeAddress("deployment", "batchRegistryAddress", registry);
        vm.serializeAddress("deployment", "distributorAddress", distributor);
        vm.serializeString("deployment", "activeBatchLabel", currentBatch.label);
        vm.serializeString("deployment", "activeBillId", currentBatch.billId);
        vm.serializeBytes32("deployment", "activeBatchId", currentBatch.batchId);
        vm.serializeBytes32("deployment", "activeClaimId", currentBatch.claimId);
        vm.serializeBytes32("deployment", "activeBatchRoot", currentBatch.root);
        vm.serializeBytes32("deployment", "activeMetadataHash", currentBatch.metadataHash);
        vm.serializeUint("deployment", "activeGrossAmount", currentBatch.grossAmount);
        vm.serializeUint("deployment", "startBlock", startBlock);

        string memory json = vm.serializeUint("deployment", "activeCreatorNetAmount", (currentBatch.grossAmount * 6000) / 10_000);
        vm.writeJson(json, path);
    }
}
