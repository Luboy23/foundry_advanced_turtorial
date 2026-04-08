// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { BraveManGame } from "../src/BraveManGame.sol";

interface Vm {
    struct Log {
        bytes32[] topics;
        bytes data;
        address emitter;
    }

    function prank(address newSender) external;
    function expectRevert(bytes calldata reason) external;
    function expectRevert(bytes4 reason) external;
    function recordLogs() external;
    function getRecordedLogs() external returns (Log[] memory entries);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function addr(uint256 privateKey) external returns (address);
}

contract BraveManGameTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant SETTLEMENT_TYPEHASH = keccak256(
        "Settlement(bytes32 sessionId,address player,uint32 kills,uint32 survivalMs,uint32 goldEarned,uint64 endedAt,uint32 rulesetVersion,bytes32 configHash)"
    );

    uint256 private constant SIGNER_KEY = 0xA11CE;
    address private signer;
    BraveManGame private game;

    /// 测试初始化：部署合约并固定签名私钥，保证验签路径可复现。
    function setUp() public {
        signer = vm.addr(SIGNER_KEY);
        game = new BraveManGame(address(this), signer);
    }

    /// 场景：正常 claim 后应铸造 GOLD，并写入个人 best/history。
    function testClaimSettlementMintsGoldAndWritesPersonalHistory() public {
        address player = address(0xBEEF);
        BraveManGame.Settlement memory settlement = _settlement(player, bytes32(uint256(1)), 12, 43000, 15, 1700000000);
        bytes memory signature = _signSettlement(settlement);

        vm.prank(player);
        game.claimSettlement(settlement, signature);

        _assertEq(game.balanceOf(player, game.GOLD_TOKEN_ID()), 15, "gold minted");
        _assertEq(uint256(game.bestKillsOf(player)), 12, "best kills");
        _assertEq(game.getUserHistoryCount(player), 1, "history count");

        BraveManGame.RunRecord[] memory latest = game.getUserHistory(player, 0, 1);
        _assertEq(latest.length, 1, "history length");
        _assertEq(uint256(latest[0].kills), 12, "history kills");
        _assertEq(uint256(latest[0].goldEarned), 15, "history gold");
    }

    /// 场景：同一 sessionId 重复 claim 必须触发防重放。
    function testDuplicateClaimReverts() public {
        address player = address(0xABCD);
        BraveManGame.Settlement memory settlement = _settlement(player, bytes32(uint256(2)), 4, 10000, 4, 1700000001);
        bytes memory signature = _signSettlement(settlement);

        vm.prank(player);
        game.claimSettlement(settlement, signature);

        vm.expectRevert(BraveManGame.SessionAlreadyClaimed.selector);
        vm.prank(player);
        game.claimSettlement(settlement, signature);
    }

    /// 场景：签名者不匹配时应拒绝结算，保护链上资产不被伪造领取。
    function testClaimWithWrongSignerReverts() public {
        address player = address(0xDDDD);
        BraveManGame.Settlement memory settlement = _settlement(player, bytes32(uint256(3)), 8, 22000, 8, 1700000002);
        bytes memory signature = _signSettlementWithKey(settlement, 0x123456);

        vm.expectRevert(BraveManGame.InvalidSigner.selector);
        vm.prank(player);
        game.claimSettlement(settlement, signature);
    }

    /// 场景：购买弓时需先销毁 GOLD，再铸造 BOW_UNLOCK。
    function testPurchaseBowBurnsGoldAndMintsUnlock() public {
        address player = address(0x1111);
        BraveManGame.Settlement memory settlement = _settlement(player, bytes32(uint256(4)), 10, 32000, 10, 1700000003);
        bytes memory signature = _signSettlement(settlement);

        vm.prank(player);
        game.claimSettlement(settlement, signature);

        vm.prank(player);
        game.purchaseBow();

        _assertEq(game.balanceOf(player, game.GOLD_TOKEN_ID()), 0, "gold burned");
        _assertEq(game.balanceOf(player, game.BOW_UNLOCK_TOKEN_ID()), 1, "bow minted");
    }

    /// 场景：GOLD 不足时购买弓应回滚。
    function testPurchaseBowRequiresEnoughGold() public {
        address player = address(0x2222);
        BraveManGame.Settlement memory settlement = _settlement(player, bytes32(uint256(5)), 3, 12000, 3, 1700000004);
        bytes memory signature = _signSettlement(settlement);

        vm.prank(player);
        game.claimSettlement(settlement, signature);

        vm.expectRevert(BraveManGame.InsufficientGold.selector);
        vm.prank(player);
        game.purchaseBow();
    }

    /// 场景：弓解锁资产为一次性购买，不允许重复购买。
    function testPurchaseBowOnlyOnce() public {
        address player = address(0x3333);
        BraveManGame.Settlement memory settlement = _settlement(player, bytes32(uint256(6)), 20, 12000, 20, 1700000005);
        bytes memory signature = _signSettlement(settlement);

        vm.prank(player);
        game.claimSettlement(settlement, signature);
        vm.prank(player);
        game.purchaseBow();

        vm.expectRevert(BraveManGame.AlreadyOwnsBow.selector);
        vm.prank(player);
        game.purchaseBow();
    }

    /// 场景：仅 owner 可更新 signer，且需正确发出事件。
    function testUpdateSignerOnlyOwnerAndEmitsEvent() public {
        address nextSigner = address(0x4444);
        vm.recordLogs();
        game.updateSigner(nextSigner);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        _assertEq(logs.length, 1, "event count");
        _assertEq(game.settlementSigner(), nextSigner, "signer updated");

        bytes memory expected =
            abi.encodeWithSelector(bytes4(keccak256("OwnableUnauthorizedAccount(address)")), address(0x9999));
        vm.expectRevert(expected);
        vm.prank(address(0x9999));
        game.updateSigner(address(0x7777));
    }

    /// 场景：验证历史环形缓冲（50 条）与倒序分页边界行为。
    function testHistoryRingBufferAndPagination() public {
        address player = address(0x5151);
        for (uint256 i = 1; i <= 53; i++) {
            _claim(player, bytes32(i + 100), uint32(i), uint32(1000 + i), uint32(i % 3), uint64(1000 + i));
        }

        _assertEq(game.getUserHistoryCount(player), 50, "history count");
        BraveManGame.RunRecord[] memory latest = game.getUserHistory(player, 0, 3);
        _assertEq(latest.length, 3, "latest size");
        _assertEq(uint256(latest[0].kills), 53, "latest 1");
        _assertEq(uint256(latest[2].kills), 51, "latest 3");

        BraveManGame.RunRecord[] memory oldest = game.getUserHistory(player, 49, 1);
        _assertEq(oldest.length, 1, "oldest size");
        _assertEq(uint256(oldest[0].kills), 4, "oldest retained");
    }

    /// 工具：签名 claim 封装，减少测试样板并统一路径。
    function _claim(
        address player,
        bytes32 sessionId,
        uint32 kills,
        uint32 survivalMs,
        uint32 goldEarned,
        uint64 endedAt
    ) private {
        BraveManGame.Settlement memory settlement =
            _settlement(player, sessionId, kills, survivalMs, goldEarned, endedAt);
        bytes memory signature = _signSettlement(settlement);
        vm.prank(player);
        game.claimSettlement(settlement, signature);
    }

    /// 工具：构造标准 settlement，固定 rulesetVersion/configHash 方便断言。
    function _settlement(
        address player,
        bytes32 sessionId,
        uint32 kills,
        uint32 survivalMs,
        uint32 goldEarned,
        uint64 endedAt
    ) private pure returns (BraveManGame.Settlement memory) {
        return BraveManGame.Settlement({
            sessionId: sessionId,
            player: player,
            kills: kills,
            survivalMs: survivalMs,
            goldEarned: goldEarned,
            endedAt: endedAt,
            rulesetVersion: 1,
            configHash: keccak256("braveman-ruleset-v1")
        });
    }

    /// 工具：使用测试 signer 私钥签名 settlement。
    function _signSettlement(BraveManGame.Settlement memory settlement) private returns (bytes memory) {
        return _signSettlementWithKey(settlement, SIGNER_KEY);
    }

    /// 工具：可指定私钥签名，用于覆盖“错误 signer”失败路径。
    function _signSettlementWithKey(BraveManGame.Settlement memory settlement, uint256 key)
        private
        returns (bytes memory)
    {
        bytes32 digest = _settlementDigest(settlement);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    /// 工具：按合约 EIP-712 规范计算 settlement digest。
    function _settlementDigest(BraveManGame.Settlement memory settlement) private view returns (bytes32) {
        bytes32 domainSeparator = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes("BraveManGame")),
                keccak256(bytes("1")),
                block.chainid,
                address(game)
            )
        );
        bytes32 structHash = keccak256(
            abi.encode(
                SETTLEMENT_TYPEHASH,
                settlement.sessionId,
                settlement.player,
                settlement.kills,
                settlement.survivalMs,
                settlement.goldEarned,
                settlement.endedAt,
                settlement.rulesetVersion,
                settlement.configHash
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    }

    /// 简化断言：uint256 比较失败时带 message 直接 revert。
    function _assertEq(uint256 left, uint256 right, string memory message) private pure {
        require(left == right, message);
    }

    /// 简化断言：address 比较失败时带 message 直接 revert。
    function _assertEq(address left, address right, string memory message) private pure {
        require(left == right, message);
    }
}
