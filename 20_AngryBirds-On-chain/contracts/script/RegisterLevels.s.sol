// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { AngryBirdsLevelCatalog } from "../src/AngryBirdsLevelCatalog.sol";

interface Vm {
    function readFile(string calldata path) external view returns (string memory);
    function parseJson(string calldata json, string calldata key) external pure returns (bytes memory);
    function projectRoot() external view returns (string memory);
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract RegisterLevels {
    Vm private constant vm =
        Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    struct ManifestLevel {
        bytes32 levelId;
        uint256 version;
        bytes32 contentHash;
        uint256 order;
        bool enabled;
    }

    function run(address catalogAddress) external returns (AngryBirdsLevelCatalog catalog) {
        require(catalogAddress != address(0), "catalog address required");

        catalog = AngryBirdsLevelCatalog(catalogAddress);
        ManifestLevel[] memory levels = _readManifest();

        vm.startBroadcast();
        for (uint256 i = 0; i < levels.length; i++) {
            ManifestLevel memory level = levels[i];
            catalog.upsertLevel(
                AngryBirdsLevelCatalog.LevelConfig({
                    levelId: level.levelId,
                    version: uint32(level.version),
                    contentHash: level.contentHash,
                    order: uint32(level.order),
                    enabled: level.enabled
                })
            );
        }
        vm.stopBroadcast();
    }

    function _readManifest() private view returns (ManifestLevel[] memory) {
        string memory rootDir = vm.projectRoot();
        string memory filePath = string.concat(rootDir, "/script/level-manifest.json");
        string memory json = vm.readFile(filePath);
        uint256 levelCount = abi.decode(vm.parseJson(json, ".levelCount"), (uint256));
        ManifestLevel[] memory levels = new ManifestLevel[](levelCount);

        for (uint256 i = 0; i < levelCount; i++) {
            string memory baseKey = string.concat(".levels[", _uintToString(i), "]");
            levels[i] = ManifestLevel({
                levelId: abi.decode(vm.parseJson(json, string.concat(baseKey, ".levelId")), (bytes32)),
                version: abi.decode(vm.parseJson(json, string.concat(baseKey, ".version")), (uint256)),
                contentHash: abi.decode(vm.parseJson(json, string.concat(baseKey, ".contentHash")), (bytes32)),
                order: abi.decode(vm.parseJson(json, string.concat(baseKey, ".order")), (uint256)),
                enabled: abi.decode(vm.parseJson(json, string.concat(baseKey, ".enabled")), (bool))
            });
        }

        return levels;
    }

    function _uintToString(uint256 value) private pure returns (string memory) {
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
}
