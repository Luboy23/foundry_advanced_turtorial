// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { AngryBirdsLevelCatalog } from "../src/AngryBirdsLevelCatalog.sol";
import { AngryBirdsScoreboard } from "../src/AngryBirdsScoreboard.sol";

interface Vm {
    function addr(uint256 privateKey) external returns (address);
    function prank(address msgSender) external;
    function sign(uint256 privateKey, bytes32 digest)
        external
        returns (uint8 v, bytes32 r, bytes32 s);
    function warp(uint256 newTimestamp) external;
}

contract AngryBirdsScoreboardTest {
    Vm private constant vm =
        Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant PLAYER_ONE_PK = 0xA11CE;
    uint256 private constant PLAYER_TWO_PK = 0xB0B;
    uint256 private constant PLAYER_THREE_PK = 0xC0DE;
    uint256 private constant RELAYER_PK = 0xCAFE;
    uint256 private constant VERIFIER_PK = 0xD00D;
    uint256 private constant WRONG_VERIFIER_PK = 0xBAD;

    bytes32 private constant LEVEL_ZERO = bytes32("level-0");
    bytes32 private constant LEVEL_ONE = bytes32("level-1");
    bytes32 private constant DOMAIN_TYPEHASH =
        keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        );
    bytes32 private constant SESSION_PERMIT_TYPEHASH =
        keccak256(
            "SessionPermit(address player,address delegate,bytes32 sessionId,bytes32 deploymentIdHash,uint64 issuedAt,uint64 deadline,uint32 nonce,uint16 maxRuns)"
        );
    bytes32 private constant VERIFIED_RUN_TYPEHASH =
        keccak256(
            "VerifiedRun(bytes32 runId,bytes32 levelId,uint32 levelVersion,uint8 birdsUsed,uint16 destroyedPigs,uint32 durationMs,bytes32 evidenceHash)"
        );
    bytes32 private constant VERIFIED_BATCH_TYPEHASH =
        keccak256(
            "VerifierBatch(address player,address delegate,bytes32 sessionId,uint32 nonce,bytes32 batchId,bytes32 runsHash)"
        );
    bytes32 private constant SESSION_PERMIT_NAME_HASH =
        keccak256("AngryBirdsSessionPermit");
    bytes32 private constant VERIFIED_BATCH_NAME_HASH =
        keccak256("AngryBirdsVerifiedBatch");
    bytes32 private constant VERSION_HASH = keccak256("1");

    function testSubmitVerifiedBatchAddsLeaderboardAndHistory() public {
        (, AngryBirdsScoreboard scoreboard) = _deployContracts();
        bytes32 sessionId = keccak256("session-0");
        AngryBirdsScoreboard.SessionPermit memory permit =
            _buildPermit(scoreboard, PLAYER_ONE_PK, sessionId, 1, 2);

        AngryBirdsScoreboard.VerifiedRun[]
            memory runs = new AngryBirdsScoreboard.VerifiedRun[](2);
        runs[0] = _buildRun(sessionId, LEVEL_ZERO, 1, 2, 4, 18000, keccak256("evidence-0"));
        runs[1] = _buildRun(sessionId, LEVEL_ONE, 1, 1, 3, 12000, keccak256("evidence-1"));

        _submitVerifiedBatch(scoreboard, permit, runs, VERIFIER_PK, permit.delegate);

        AngryBirdsScoreboard.LeaderboardEntry[] memory leaderboard =
            scoreboard.getLeaderboard(LEVEL_ZERO, 1);
        assert(leaderboard.length == 1);
        assert(leaderboard[0].player == permit.player);
        assert(leaderboard[0].result.evidenceHash == keccak256("evidence-0"));

        AngryBirdsScoreboard.RunResult[] memory history =
            scoreboard.getUserHistory(permit.player, 0, 10);
        assert(history.length == 2);
        assert(history[0].levelId == LEVEL_ONE);
        assert(history[1].levelId == LEVEL_ZERO);

        AngryBirdsScoreboard.LeaderboardEntry[] memory globalLeaderboard =
            scoreboard.getGlobalLeaderboard();
        assert(globalLeaderboard.length == 1);
        assert(globalLeaderboard[0].player == permit.player);
        assert(globalLeaderboard[0].result.levelId == LEVEL_ONE);
        assert(globalLeaderboard[0].result.birdsUsed == 1);
        assert(globalLeaderboard[0].result.evidenceHash == keccak256("evidence-1"));

        (uint16 submittedRuns, bool revoked) =
            scoreboard.getSessionUsage(permit.player, permit.nonce);
        assert(submittedRuns == 2);
        assert(revoked);
        assert(scoreboard.isRunRecorded(runs[0].runId));
        assert(scoreboard.isRunRecorded(runs[1].runId));
    }

    function testSubmitVerifiedBatchRejectsExpiredPermit() public {
        (, AngryBirdsScoreboard scoreboard) = _deployContracts();
        bytes32 sessionId = keccak256("session-expired");
        AngryBirdsScoreboard.SessionPermit memory permit =
            _buildPermit(scoreboard, PLAYER_ONE_PK, sessionId, 2, 1);
        AngryBirdsScoreboard.VerifiedRun[]
            memory runs = new AngryBirdsScoreboard.VerifiedRun[](1);
        runs[0] = _buildRun(sessionId, LEVEL_ZERO, 1, 2, 4, 18000, keccak256("expired-run"));

        vm.warp(uint256(permit.deadline) + 1);
        _assertSubmitFails(scoreboard, permit, runs, VERIFIER_PK, permit.delegate);
    }

    function testSubmitVerifiedBatchRejectsDelegateMismatch() public {
        (, AngryBirdsScoreboard scoreboard) = _deployContracts();
        bytes32 sessionId = keccak256("session-delegate");
        AngryBirdsScoreboard.SessionPermit memory permit =
            _buildPermit(scoreboard, PLAYER_ONE_PK, sessionId, 3, 1);
        AngryBirdsScoreboard.VerifiedRun[]
            memory runs = new AngryBirdsScoreboard.VerifiedRun[](1);
        runs[0] = _buildRun(sessionId, LEVEL_ZERO, 1, 2, 4, 18000, keccak256("delegate-run"));

        address stranger = vm.addr(0x9999);
        _assertSubmitFails(scoreboard, permit, runs, VERIFIER_PK, stranger);
    }

    function testSubmitVerifiedBatchRejectsVerifierMismatch() public {
        (, AngryBirdsScoreboard scoreboard) = _deployContracts();
        bytes32 sessionId = keccak256("session-verifier");
        AngryBirdsScoreboard.SessionPermit memory permit =
            _buildPermit(scoreboard, PLAYER_ONE_PK, sessionId, 4, 1);
        AngryBirdsScoreboard.VerifiedRun[]
            memory runs = new AngryBirdsScoreboard.VerifiedRun[](1);
        runs[0] = _buildRun(sessionId, LEVEL_ZERO, 1, 2, 4, 18000, keccak256("verifier-run"));

        _assertSubmitFails(scoreboard, permit, runs, WRONG_VERIFIER_PK, permit.delegate);
    }

    function testSubmitVerifiedBatchRejectsDuplicateRunId() public {
        (, AngryBirdsScoreboard scoreboard) = _deployContracts();
        bytes32 sessionId = keccak256("session-duplicate-run");
        AngryBirdsScoreboard.SessionPermit memory permit =
            _buildPermit(scoreboard, PLAYER_ONE_PK, sessionId, 5, 2);
        AngryBirdsScoreboard.VerifiedRun[]
            memory runs = new AngryBirdsScoreboard.VerifiedRun[](1);
        runs[0] = _buildRun(sessionId, LEVEL_ZERO, 1, 2, 4, 18000, keccak256("duplicate-run"));

        _submitVerifiedBatch(scoreboard, permit, runs, VERIFIER_PK, permit.delegate);
        _assertSubmitFails(scoreboard, permit, runs, VERIFIER_PK, permit.delegate);
    }

    function testSubmitVerifiedBatchRejectsDuplicateBatchId() public {
        (, AngryBirdsScoreboard scoreboard) = _deployContracts();
        bytes32 sessionId = keccak256("session-duplicate-batch");
        AngryBirdsScoreboard.SessionPermit memory permit =
            _buildPermit(scoreboard, PLAYER_ONE_PK, sessionId, 6, 2);
        AngryBirdsScoreboard.VerifiedRun[]
            memory runs = new AngryBirdsScoreboard.VerifiedRun[](1);
        runs[0] = _buildRun(sessionId, LEVEL_ZERO, 1, 2, 4, 18000, keccak256("duplicate-batch"));

        _submitVerifiedBatch(scoreboard, permit, runs, VERIFIER_PK, permit.delegate);

        AngryBirdsScoreboard.VerifiedRun[]
            memory replacementRuns = new AngryBirdsScoreboard.VerifiedRun[](1);
        replacementRuns[0] = _buildRun(
            sessionId,
            LEVEL_ONE,
            1,
            1,
            2,
            15000,
            keccak256("duplicate-batch-replacement")
        );

        bytes32 duplicatedBatchId = _buildBatchId(permit, runs);
        _assertSubmitFailsWithBatchId(
            scoreboard,
            permit,
            replacementRuns,
            duplicatedBatchId,
            VERIFIER_PK,
            permit.delegate
        );
    }

    function testSubmitVerifiedBatchRejectsConsumedSessionNonce() public {
        (, AngryBirdsScoreboard scoreboard) = _deployContracts();
        bytes32 sessionId = keccak256("session-replay");
        AngryBirdsScoreboard.SessionPermit memory permit =
            _buildPermit(scoreboard, PLAYER_ONE_PK, sessionId, 7, 1);
        AngryBirdsScoreboard.VerifiedRun[]
            memory firstRuns = new AngryBirdsScoreboard.VerifiedRun[](1);
        firstRuns[0] = _buildRun(sessionId, LEVEL_ZERO, 1, 2, 4, 18000, keccak256("first-run"));

        _submitVerifiedBatch(scoreboard, permit, firstRuns, VERIFIER_PK, permit.delegate);

        AngryBirdsScoreboard.VerifiedRun[]
            memory secondRuns = new AngryBirdsScoreboard.VerifiedRun[](1);
        secondRuns[0] = _buildRun(sessionId, LEVEL_ONE, 1, 1, 3, 12000, keccak256("second-run"));

        _assertSubmitFails(scoreboard, permit, secondRuns, VERIFIER_PK, permit.delegate);
    }

    function testLeaderboardSortsAfterVerifiedBatches() public {
        (, AngryBirdsScoreboard scoreboard) = _deployContracts();

        bytes32 playerOneSessionId = keccak256("session-player-one");
        AngryBirdsScoreboard.SessionPermit memory playerOnePermit =
            _buildPermit(scoreboard, PLAYER_ONE_PK, playerOneSessionId, 8, 1);
        AngryBirdsScoreboard.VerifiedRun[]
            memory playerOneRuns = new AngryBirdsScoreboard.VerifiedRun[](1);
        playerOneRuns[0] = _buildRun(
            playerOneSessionId,
            LEVEL_ZERO,
            1,
            3,
            4,
            19000,
            keccak256("player-one-run")
        );
        _submitVerifiedBatch(
            scoreboard,
            playerOnePermit,
            playerOneRuns,
            VERIFIER_PK,
            playerOnePermit.delegate
        );

        bytes32 playerTwoSessionId = keccak256("session-player-two");
        AngryBirdsScoreboard.SessionPermit memory playerTwoPermit =
            _buildPermit(scoreboard, PLAYER_TWO_PK, playerTwoSessionId, 9, 1);
        AngryBirdsScoreboard.VerifiedRun[]
            memory playerTwoRuns = new AngryBirdsScoreboard.VerifiedRun[](1);
        playerTwoRuns[0] = _buildRun(
            playerTwoSessionId,
            LEVEL_ZERO,
            1,
            1,
            4,
            17000,
            keccak256("player-two-run")
        );
        _submitVerifiedBatch(
            scoreboard,
            playerTwoPermit,
            playerTwoRuns,
            VERIFIER_PK,
            playerTwoPermit.delegate
        );

        AngryBirdsScoreboard.LeaderboardEntry[] memory leaderboard =
            scoreboard.getLeaderboard(LEVEL_ZERO, 1);
        assert(leaderboard.length == 2);
        assert(leaderboard[0].player == playerTwoPermit.player);
        assert(leaderboard[0].result.birdsUsed == 1);
        assert(leaderboard[1].player == playerOnePermit.player);
        assert(leaderboard[1].result.birdsUsed == 3);

        AngryBirdsScoreboard.LeaderboardEntry[] memory globalLeaderboard =
            scoreboard.getGlobalLeaderboard();
        assert(globalLeaderboard.length == 2);
        assert(globalLeaderboard[0].player == playerTwoPermit.player);
        assert(globalLeaderboard[0].result.birdsUsed == 1);
        assert(globalLeaderboard[1].player == playerOnePermit.player);
        assert(globalLeaderboard[1].result.birdsUsed == 3);
    }

    function testGlobalLeaderboardPrefersHigherLevelProgressForSamePlayer() public {
        (, AngryBirdsScoreboard scoreboard) = _deployContracts();

        bytes32 firstSessionId = keccak256("session-global-best-first");
        AngryBirdsScoreboard.SessionPermit memory firstPermit =
            _buildPermit(scoreboard, PLAYER_ONE_PK, firstSessionId, 10, 1);
        AngryBirdsScoreboard.VerifiedRun[]
            memory firstRuns = new AngryBirdsScoreboard.VerifiedRun[](1);
        firstRuns[0] = _buildRun(
            firstSessionId,
            LEVEL_ZERO,
            1,
            1,
            4,
            9000,
            keccak256("global-best-first")
        );
        _submitVerifiedBatch(
            scoreboard,
            firstPermit,
            firstRuns,
            VERIFIER_PK,
            firstPermit.delegate
        );

        bytes32 secondSessionId = keccak256("session-global-best-second");
        AngryBirdsScoreboard.SessionPermit memory secondPermit =
            _buildPermit(scoreboard, PLAYER_ONE_PK, secondSessionId, 11, 1);
        AngryBirdsScoreboard.VerifiedRun[]
            memory secondRuns = new AngryBirdsScoreboard.VerifiedRun[](1);
        secondRuns[0] = _buildRun(
            secondSessionId,
            LEVEL_ONE,
            1,
            2,
            4,
            8000,
            keccak256("global-best-worse")
        );
        _submitVerifiedBatch(
            scoreboard,
            secondPermit,
            secondRuns,
            VERIFIER_PK,
            secondPermit.delegate
        );

        AngryBirdsScoreboard.LeaderboardEntry[] memory globalLeaderboard =
            scoreboard.getGlobalLeaderboard();
        assert(globalLeaderboard.length == 1);
        assert(globalLeaderboard[0].player == firstPermit.player);
        assert(globalLeaderboard[0].result.levelId == LEVEL_ONE);
        assert(globalLeaderboard[0].result.birdsUsed == 2);
        assert(globalLeaderboard[0].result.durationMs == 8000);

        AngryBirdsScoreboard.RunResult[] memory history =
            scoreboard.getUserHistory(firstPermit.player, 0, 10);
        assert(history.length == 2);
    }

    function testGlobalLeaderboardReplacesEntryWhenPlayerImproves() public {
        (, AngryBirdsScoreboard scoreboard) = _deployContracts();

        bytes32 firstSessionId = keccak256("session-global-upgrade-first");
        AngryBirdsScoreboard.SessionPermit memory firstPermit =
            _buildPermit(scoreboard, PLAYER_ONE_PK, firstSessionId, 12, 1);
        AngryBirdsScoreboard.VerifiedRun[]
            memory firstRuns = new AngryBirdsScoreboard.VerifiedRun[](1);
        firstRuns[0] = _buildRun(
            firstSessionId,
            LEVEL_ZERO,
            1,
            3,
            4,
            12000,
            keccak256("global-upgrade-first")
        );
        _submitVerifiedBatch(
            scoreboard,
            firstPermit,
            firstRuns,
            VERIFIER_PK,
            firstPermit.delegate
        );

        bytes32 secondSessionId = keccak256("session-global-upgrade-second");
        AngryBirdsScoreboard.SessionPermit memory secondPermit =
            _buildPermit(scoreboard, PLAYER_ONE_PK, secondSessionId, 13, 1);
        AngryBirdsScoreboard.VerifiedRun[]
            memory secondRuns = new AngryBirdsScoreboard.VerifiedRun[](1);
        secondRuns[0] = _buildRun(
            secondSessionId,
            LEVEL_ONE,
            1,
            2,
            4,
            11000,
            keccak256("global-upgrade-second")
        );
        _submitVerifiedBatch(
            scoreboard,
            secondPermit,
            secondRuns,
            VERIFIER_PK,
            secondPermit.delegate
        );

        AngryBirdsScoreboard.LeaderboardEntry[] memory globalLeaderboard =
            scoreboard.getGlobalLeaderboard();
        assert(globalLeaderboard.length == 1);
        assert(globalLeaderboard[0].player == secondPermit.player);
        assert(globalLeaderboard[0].result.levelId == LEVEL_ONE);
        assert(globalLeaderboard[0].result.birdsUsed == 2);
        assert(globalLeaderboard[0].result.durationMs == 11000);
    }

    function testPerLevelLeaderboardStillKeepsFullRunHistoryForSamePlayer() public {
        (, AngryBirdsScoreboard scoreboard) = _deployContracts();

        bytes32 firstSessionId = keccak256("session-per-level-first");
        AngryBirdsScoreboard.SessionPermit memory firstPermit =
            _buildPermit(scoreboard, PLAYER_ONE_PK, firstSessionId, 14, 1);
        AngryBirdsScoreboard.VerifiedRun[]
            memory firstRuns = new AngryBirdsScoreboard.VerifiedRun[](1);
        firstRuns[0] = _buildRun(
            firstSessionId,
            LEVEL_ZERO,
            1,
            3,
            4,
            14000,
            keccak256("per-level-first")
        );
        _submitVerifiedBatch(
            scoreboard,
            firstPermit,
            firstRuns,
            VERIFIER_PK,
            firstPermit.delegate
        );

        bytes32 secondSessionId = keccak256("session-per-level-second");
        AngryBirdsScoreboard.SessionPermit memory secondPermit =
            _buildPermit(scoreboard, PLAYER_ONE_PK, secondSessionId, 15, 1);
        AngryBirdsScoreboard.VerifiedRun[]
            memory secondRuns = new AngryBirdsScoreboard.VerifiedRun[](1);
        secondRuns[0] = _buildRun(
            secondSessionId,
            LEVEL_ZERO,
            1,
            2,
            4,
            12000,
            keccak256("per-level-second")
        );
        _submitVerifiedBatch(
            scoreboard,
            secondPermit,
            secondRuns,
            VERIFIER_PK,
            secondPermit.delegate
        );

        AngryBirdsScoreboard.LeaderboardEntry[] memory levelLeaderboard =
            scoreboard.getLeaderboard(LEVEL_ZERO, 1);
        assert(levelLeaderboard.length == 2);
        assert(levelLeaderboard[0].result.evidenceHash == keccak256("per-level-second"));
        assert(levelLeaderboard[1].result.evidenceHash == keccak256("per-level-first"));

        AngryBirdsScoreboard.LeaderboardEntry[] memory globalLeaderboard =
            scoreboard.getGlobalLeaderboard();
        assert(globalLeaderboard.length == 1);
        assert(globalLeaderboard[0].result.evidenceHash == keccak256("per-level-second"));
    }

    function testGlobalLeaderboardSortsMultiplePlayersByProgressBeforeEfficiency() public {
        (, AngryBirdsScoreboard scoreboard) = _deployContracts();

        bytes32 playerOneSessionId = keccak256("session-global-sort-one");
        AngryBirdsScoreboard.SessionPermit memory playerOnePermit =
            _buildPermit(scoreboard, PLAYER_ONE_PK, playerOneSessionId, 16, 1);
        AngryBirdsScoreboard.VerifiedRun[]
            memory playerOneRuns = new AngryBirdsScoreboard.VerifiedRun[](1);
        playerOneRuns[0] = _buildRun(
            playerOneSessionId,
            LEVEL_ZERO,
            1,
            1,
            4,
            11000,
            keccak256("global-sort-one")
        );
        _submitVerifiedBatch(
            scoreboard,
            playerOnePermit,
            playerOneRuns,
            VERIFIER_PK,
            playerOnePermit.delegate
        );

        bytes32 playerTwoSessionId = keccak256("session-global-sort-two");
        AngryBirdsScoreboard.SessionPermit memory playerTwoPermit =
            _buildPermit(scoreboard, PLAYER_TWO_PK, playerTwoSessionId, 17, 1);
        AngryBirdsScoreboard.VerifiedRun[]
            memory playerTwoRuns = new AngryBirdsScoreboard.VerifiedRun[](1);
        playerTwoRuns[0] = _buildRun(
            playerTwoSessionId,
            LEVEL_ONE,
            1,
            3,
            4,
            19000,
            keccak256("global-sort-two")
        );
        _submitVerifiedBatch(
            scoreboard,
            playerTwoPermit,
            playerTwoRuns,
            VERIFIER_PK,
            playerTwoPermit.delegate
        );

        bytes32 playerThreeSessionId = keccak256("session-global-sort-three");
        AngryBirdsScoreboard.SessionPermit memory playerThreePermit =
            _buildPermit(scoreboard, PLAYER_THREE_PK, playerThreeSessionId, 18, 1);
        AngryBirdsScoreboard.VerifiedRun[]
            memory playerThreeRuns = new AngryBirdsScoreboard.VerifiedRun[](1);
        playerThreeRuns[0] = _buildRun(
            playerThreeSessionId,
            LEVEL_ZERO,
            1,
            1,
            4,
            17000,
            keccak256("global-sort-three")
        );
        _submitVerifiedBatch(
            scoreboard,
            playerThreePermit,
            playerThreeRuns,
            VERIFIER_PK,
            playerThreePermit.delegate
        );

        AngryBirdsScoreboard.LeaderboardEntry[] memory globalLeaderboard =
            scoreboard.getGlobalLeaderboard();
        assert(globalLeaderboard.length == 3);
        assert(globalLeaderboard[0].player == playerTwoPermit.player);
        assert(globalLeaderboard[0].result.levelId == LEVEL_ONE);
        assert(globalLeaderboard[0].result.birdsUsed == 3);
        assert(globalLeaderboard[1].player == playerOnePermit.player);
        assert(globalLeaderboard[1].result.durationMs == 11000);
        assert(globalLeaderboard[2].player == playerThreePermit.player);
        assert(globalLeaderboard[2].result.durationMs == 17000);
    }

    function _deployContracts()
        private
        returns (AngryBirdsLevelCatalog catalog, AngryBirdsScoreboard scoreboard)
    {
        catalog = new AngryBirdsLevelCatalog();
        catalog.upsertLevel(
            AngryBirdsLevelCatalog.LevelConfig({
                levelId: LEVEL_ZERO,
                version: 1,
                contentHash: keccak256("level-0"),
                order: 1,
                enabled: true
            })
        );
        catalog.upsertLevel(
            AngryBirdsLevelCatalog.LevelConfig({
                levelId: LEVEL_ONE,
                version: 1,
                contentHash: keccak256("level-1"),
                order: 2,
                enabled: true
            })
        );

        scoreboard = new AngryBirdsScoreboard(
            address(catalog),
            vm.addr(VERIFIER_PK),
            "local-dev"
        );
    }

    function _buildPermit(
        AngryBirdsScoreboard scoreboard,
        uint256 playerPrivateKey,
        bytes32 sessionId,
        uint32 nonce,
        uint16 maxRuns
    ) private returns (AngryBirdsScoreboard.SessionPermit memory permit) {
        uint64 nowSeconds = uint64(block.timestamp);
        permit = AngryBirdsScoreboard.SessionPermit({
            player: vm.addr(playerPrivateKey),
            delegate: vm.addr(RELAYER_PK),
            sessionId: sessionId,
            deploymentIdHash: scoreboard.deploymentIdHash(),
            issuedAt: nowSeconds,
            deadline: nowSeconds + 1800,
            nonce: nonce,
            maxRuns: maxRuns
        });
    }

    function _buildRun(
        bytes32 sessionId,
        bytes32 levelId,
        uint32 levelVersion,
        uint8 birdsUsed,
        uint16 destroyedPigs,
        uint32 durationMs,
        bytes32 evidenceHash
    ) private pure returns (AngryBirdsScoreboard.VerifiedRun memory) {
        return AngryBirdsScoreboard.VerifiedRun({
            runId: keccak256(
                abi.encode(sessionId, levelId, levelVersion, evidenceHash)
            ),
            levelId: levelId,
            levelVersion: levelVersion,
            birdsUsed: birdsUsed,
            destroyedPigs: destroyedPigs,
            durationMs: durationMs,
            evidenceHash: evidenceHash
        });
    }

    function _submitVerifiedBatch(
        AngryBirdsScoreboard scoreboard,
        AngryBirdsScoreboard.SessionPermit memory permit,
        AngryBirdsScoreboard.VerifiedRun[] memory runs,
        uint256 verifierPrivateKey,
        address caller
    ) private {
        bytes32 batchId = _buildBatchId(permit, runs);
        bytes memory playerPermitSig =
            _signPermit(scoreboard, permit, _playerPrivateKey(permit.player));
        bytes memory verifierSig =
            _signBatch(scoreboard, permit, runs, batchId, verifierPrivateKey);

        vm.prank(caller);
        scoreboard.submitVerifiedBatch(
            permit,
            playerPermitSig,
            runs,
            batchId,
            verifierSig
        );
    }

    function _assertSubmitFails(
        AngryBirdsScoreboard scoreboard,
        AngryBirdsScoreboard.SessionPermit memory permit,
        AngryBirdsScoreboard.VerifiedRun[] memory runs,
        uint256 verifierPrivateKey,
        address caller
    ) private {
        _assertSubmitFailsWithBatchId(
            scoreboard,
            permit,
            runs,
            _buildBatchId(permit, runs),
            verifierPrivateKey,
            caller
        );
    }

    function _assertSubmitFailsWithBatchId(
        AngryBirdsScoreboard scoreboard,
        AngryBirdsScoreboard.SessionPermit memory permit,
        AngryBirdsScoreboard.VerifiedRun[] memory runs,
        bytes32 batchId,
        uint256 verifierPrivateKey,
        address caller
    ) private {
        bytes memory playerPermitSig =
            _signPermit(scoreboard, permit, _playerPrivateKey(permit.player));
        bytes memory verifierSig =
            _signBatch(scoreboard, permit, runs, batchId, verifierPrivateKey);

        vm.prank(caller);
        (bool ok,) = address(scoreboard).call(
            abi.encodeWithSelector(
                AngryBirdsScoreboard.submitVerifiedBatch.selector,
                permit,
                playerPermitSig,
                runs,
                batchId,
                verifierSig
            )
        );
        assert(!ok);
    }

    function _buildBatchId(
        AngryBirdsScoreboard.SessionPermit memory permit,
        AngryBirdsScoreboard.VerifiedRun[] memory runs
    ) private pure returns (bytes32) {
        return keccak256(
            abi.encode(permit.sessionId, permit.nonce, runs[0].runId, runs.length)
        );
    }

    function _signPermit(
        AngryBirdsScoreboard scoreboard,
        AngryBirdsScoreboard.SessionPermit memory permit,
        uint256 playerPrivateKey
    ) private returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(
                SESSION_PERMIT_TYPEHASH,
                permit.player,
                permit.delegate,
                permit.sessionId,
                permit.deploymentIdHash,
                permit.issuedAt,
                permit.deadline,
                permit.nonce,
                permit.maxRuns
            )
        );
        return _signDigest(
            playerPrivateKey,
            _hashTypedData(scoreboard, SESSION_PERMIT_NAME_HASH, structHash)
        );
    }

    function _signBatch(
        AngryBirdsScoreboard scoreboard,
        AngryBirdsScoreboard.SessionPermit memory permit,
        AngryBirdsScoreboard.VerifiedRun[] memory runs,
        bytes32 batchId,
        uint256 verifierPrivateKey
    ) private returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(
                VERIFIED_BATCH_TYPEHASH,
                permit.player,
                permit.delegate,
                permit.sessionId,
                permit.nonce,
                batchId,
                _hashRuns(runs)
            )
        );
        return _signDigest(
            verifierPrivateKey,
            _hashTypedData(scoreboard, VERIFIED_BATCH_NAME_HASH, structHash)
        );
    }

    function _hashRuns(
        AngryBirdsScoreboard.VerifiedRun[] memory runs
    ) private pure returns (bytes32) {
        bytes32[] memory runHashes = new bytes32[](runs.length);

        for (uint256 i = 0; i < runs.length; i++) {
            AngryBirdsScoreboard.VerifiedRun memory run = runs[i];
            runHashes[i] = keccak256(
                abi.encode(
                    VERIFIED_RUN_TYPEHASH,
                    run.runId,
                    run.levelId,
                    run.levelVersion,
                    run.birdsUsed,
                    run.destroyedPigs,
                    run.durationMs,
                    run.evidenceHash
                )
            );
        }

        return keccak256(abi.encode(runHashes));
    }

    function _hashTypedData(
        AngryBirdsScoreboard scoreboard,
        bytes32 nameHash,
        bytes32 structHash
    ) private view returns (bytes32) {
        bytes32 domainSeparator = keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                nameHash,
                VERSION_HASH,
                block.chainid,
                address(scoreboard)
            )
        );

        return keccak256(
            abi.encodePacked("\x19\x01", domainSeparator, structHash)
        );
    }

    function _signDigest(
        uint256 privateKey,
        bytes32 digest
    ) private returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _playerPrivateKey(
        address player
    ) private returns (uint256 privateKey) {
        if (player == vm.addr(PLAYER_ONE_PK)) {
            return PLAYER_ONE_PK;
        }
        if (player == vm.addr(PLAYER_TWO_PK)) {
            return PLAYER_TWO_PK;
        }
        if (player == vm.addr(PLAYER_THREE_PK)) {
            return PLAYER_THREE_PK;
        }
        revert("unknown-player");
    }
}
