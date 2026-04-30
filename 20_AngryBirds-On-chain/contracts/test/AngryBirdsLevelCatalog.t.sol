// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { AngryBirdsLevelCatalog } from "../src/AngryBirdsLevelCatalog.sol";

contract AngryBirdsLevelCatalogTest {
    function testUpsertAndGetCatalogSortedByOrder() public {
        AngryBirdsLevelCatalog catalog = new AngryBirdsLevelCatalog();

        catalog.upsertLevel(
            AngryBirdsLevelCatalog.LevelConfig({
                levelId: bytes32("level-b"),
                version: 1,
                contentHash: keccak256("level-b"),
                order: 2,
                enabled: true
            })
        );

        catalog.upsertLevel(
            AngryBirdsLevelCatalog.LevelConfig({
                levelId: bytes32("level-a"),
                version: 1,
                contentHash: keccak256("level-a"),
                order: 1,
                enabled: true
            })
        );

        AngryBirdsLevelCatalog.LevelConfig[] memory levels = catalog.getCatalog();
        assert(levels.length == 2);
        assert(levels[0].order == 1);
        assert(levels[1].order == 2);
        assert(levels[0].levelId == bytes32("level-a"));
    }

    function testSetLevelEnabledUpdatesExistingEntry() public {
        AngryBirdsLevelCatalog catalog = new AngryBirdsLevelCatalog();
        catalog.upsertLevel(
            AngryBirdsLevelCatalog.LevelConfig({
                levelId: bytes32("level-0"),
                version: 1,
                contentHash: keccak256("level-0"),
                order: 1,
                enabled: true
            })
        );

        catalog.setLevelEnabled(bytes32("level-0"), 1, false);
        assert(!catalog.isLevelEnabled(bytes32("level-0"), 1));
    }
}
