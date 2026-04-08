// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {SessionAccount} from "src/SessionAccount.sol";
import {SessionAccountFactory} from "src/SessionAccountFactory.sol";
import {TicTacToe} from "src/TicTacToe.sol";

/// @dev 用于测试会话调用与回滚透传行为的模拟目标合约。
contract MockSessionTarget {
    uint256 public pingCount;

    /// @notice 每次调用递增计数，用于验证会话执行成功路径。
    function ping() external returns (uint256) {
        pingCount += 1;
        return pingCount;
    }

    /// @notice 固定回滚函数，用于验证错误透传路径。
    function willRevert() external pure {
        revert("MOCK_REVERT");
    }
}

/// @dev 用于测试预充值失败路径的拒收 ETH 合约。
contract RejectEtherReceiver {
    /// @notice 拒收所有 ETH 转账，用于触发预充值失败分支。
    receive() external payable {
        revert("NO_ETHER");
    }
}

/// @title SessionAccountFactoryTest
/// @notice 覆盖工厂与会话账户在创建、刷新、调用与错误分支下的行为。
contract SessionAccountFactoryTest is Test {
    SessionAccountFactory factory;
    TicTacToe ttt;
    MockSessionTarget mockTarget;
    RejectEtherReceiver rejectReceiver;

    address owner = address(0xA11CE);
    address opponent = address(0xB0B);
    address sessionKey = address(0xC0FFEE);
    address anotherSessionKey = address(0xD00D);
    address badActor = address(0xBAD);

    /// @notice 每个用例前部署全新依赖并准备测试账户余额。
    function setUp() public {
        factory = new SessionAccountFactory();
        ttt = new TicTacToe();
        mockTarget = new MockSessionTarget();
        rejectReceiver = new RejectEtherReceiver();

        vm.deal(owner, 100 ether);
        vm.deal(opponent, 100 ether);
        vm.deal(sessionKey, 0);
        vm.deal(anotherSessionKey, 0);
    }

    /// @dev 生成仅包含单个 selector 的会话白名单数组。
    function _singleSelector(
        bytes4 selector
    ) internal pure returns (bytes4[] memory selectors) {
        selectors = new bytes4[](1);
        selectors[0] = selector;
    }

    /// @dev 默认白名单：允许落子、认输、超时判胜。
    function _defaultSelectors() internal pure returns (bytes4[] memory selectors) {
        selectors = new bytes4[](3);
        selectors[0] = TicTacToe.makeMove.selector;
        selectors[1] = TicTacToe.resign.selector;
        selectors[2] = TicTacToe.claimTimeoutWin.selector;
    }

    /// @dev 构建会话配置结构，减少重复样板代码。
    function _config(
        address key,
        uint64 expiresAt,
        uint32 maxCalls,
        bytes4[] memory selectors,
        uint96 prefundAmount
    ) internal pure returns (SessionAccount.SessionConfigInput memory cfg) {
        cfg = SessionAccount.SessionConfigInput({
            sessionKey: key,
            expiresAt: expiresAt,
            maxCalls: maxCalls,
            allowedSelectors: selectors,
            prefundAmount: prefundAmount
        });
    }

    /// @dev 生成标准测试会话配置。
    function _defaultConfig()
        internal
        view
        returns (SessionAccount.SessionConfigInput memory cfg)
    {
        cfg = _config(
            sessionKey,
            uint64(block.timestamp + 30 minutes),
            12,
            _defaultSelectors(),
            0.01 ether
        );
    }

    /// @dev 一步完成默认 round setup，返回账户、会话实例和 gameId。
    function _setupDefaultRound()
        internal
        returns (address account, SessionAccount sessionAccount, uint256 gameId)
    {
        SessionAccount.SessionConfigInput memory cfg = _defaultConfig();
        bytes memory opening = abi.encodeWithSelector(TicTacToe.createGame.selector);
        vm.prank(owner);
        (account, ) = factory.setupRound{value: cfg.prefundAmount}(
            address(ttt),
            opening,
            cfg
        );
        sessionAccount = SessionAccount(payable(account));
        gameId = ttt.gameCounter() - 1;
    }

    /// @notice 用例：一次 owner 交易应完成账户创建、开局与预充值。
    function testSetupRoundCreatesAccountAndGameWithOneOwnerTx() public {
        SessionAccount.SessionConfigInput memory cfg = _defaultConfig();
        bytes memory opening = abi.encodeWithSelector(TicTacToe.createGame.selector);

        vm.prank(owner);
        (address account, ) = factory.setupRound{value: 0.01 ether}(
            address(ttt),
            opening,
            cfg
        );

        assertEq(factory.accountOf(owner), account);
        assertEq(factory.ownerOfAccount(account), owner);
        assertEq(sessionKey.balance, 0.01 ether);

        uint256 gameId = ttt.gameCounter() - 1;
        (address p1, , , , TicTacToe.GameState state, ) = ttt.getGameState(gameId);
        assertEq(p1, account);
        assertEq(uint8(state), uint8(TicTacToe.GameState.WAITING));
    }

    /// @notice 用例：重复 setupRound 时应复用同一会话账户。
    function testSetupRoundReusesExistingAccount() public {
        (address firstAccount, , ) = _setupDefaultRound();

        SessionAccount.SessionConfigInput memory secondCfg = _config(
            anotherSessionKey,
            uint64(block.timestamp + 45 minutes),
            4,
            _singleSelector(TicTacToe.resign.selector),
            0
        );
        bytes memory opening = abi.encodeWithSelector(TicTacToe.getLeaderboardCount.selector);

        vm.prank(owner);
        (address secondAccount, ) = factory.setupRound(
            address(ttt),
            opening,
            secondCfg
        );

        assertEq(secondAccount, firstAccount);
        assertEq(factory.accountOf(owner), firstAccount);
    }

    /// @notice 用例：refreshSession 在账户不存在时应先创建账户再刷新会话。
    function testFactoryRefreshSessionCreatesAccountWhenMissing() public {
        SessionAccount.SessionConfigInput memory cfg = _config(
            sessionKey,
            uint64(block.timestamp + 30 minutes),
            5,
            _singleSelector(TicTacToe.makeMove.selector),
            0.01 ether
        );

        vm.prank(owner);
        address account = factory.refreshSession{value: cfg.prefundAmount}(address(ttt), cfg);
        SessionAccount sessionAccount = SessionAccount(payable(account));

        assertEq(factory.accountOf(owner), account);
        assertEq(factory.ownerOfAccount(account), owner);
        assertEq(sessionAccount.sessionKey(), sessionKey);
        assertEq(sessionAccount.sessionTarget(), address(ttt));
        assertTrue(sessionAccount.sessionActive());
    }

    /// @notice 用例：refreshSession 应覆盖旧会话参数并重置调用计数。
    function testFactoryRefreshSessionUpdatesExistingSession() public {
        (address account, SessionAccount sessionAccount, ) = _setupDefaultRound();

        SessionAccount.SessionConfigInput memory refreshedCfg = _config(
            anotherSessionKey,
            uint64(block.timestamp + 1 hours),
            2,
            _singleSelector(TicTacToe.resign.selector),
            0
        );

        vm.prank(owner);
        address returnedAccount = factory.refreshSession(address(ttt), refreshedCfg);
        assertEq(returnedAccount, account);

        assertEq(sessionAccount.sessionKey(), anotherSessionKey);
        assertEq(sessionAccount.sessionTarget(), address(ttt));
        assertEq(sessionAccount.sessionMaxCalls(), 2);
        assertEq(sessionAccount.sessionCallsUsed(), 0);
        assertTrue(sessionAccount.sessionSelectorAllowed(TicTacToe.resign.selector));
        assertFalse(sessionAccount.sessionSelectorAllowed(TicTacToe.makeMove.selector));
        assertEq(sessionAccount.getAllowedSelectors().length, 1);
    }

    /// @notice 用例：会话 key 执行落子无需 owner 再次签名。
    function testSessionKeyCanMakeMoveWithoutOwnerSignature() public {
        (, SessionAccount sessionAccount, uint256 gameId) = _setupDefaultRound();

        vm.prank(opponent);
        ttt.joinGame(gameId);

        bytes memory moveData = abi.encodeWithSelector(
            TicTacToe.makeMove.selector,
            gameId,
            uint8(0)
        );

        vm.prank(sessionKey);
        sessionAccount.executeWithSession(address(ttt), moveData);

        (, , , uint8[9] memory board, , ) = ttt.getGameState(gameId);
        assertEq(board[0], 1);
    }

    /// @notice 用例：调用未授权 selector 应回滚。
    function testDisallowedSelectorReverts() public {
        (, SessionAccount sessionAccount, uint256 gameId) = _setupDefaultRound();
        bytes memory joinData = abi.encodeWithSelector(TicTacToe.joinGame.selector, gameId);

        vm.prank(sessionKey);
        vm.expectRevert(SessionAccount.SelectorNotAllowed.selector);
        sessionAccount.executeWithSession(address(ttt), joinData);
    }

    /// @notice 用例：会话调用次数达到上限后应自动失效。
    function testSessionMaxCallsIsEnforced() public {
        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = TicTacToe.resign.selector;

        SessionAccount.SessionConfigInput memory cfg = _config(
            sessionKey,
            uint64(block.timestamp + 30 minutes),
            1,
            selectors,
            0
        );

        bytes memory opening = abi.encodeWithSelector(TicTacToe.createGame.selector);
        vm.prank(owner);
        (address account, ) = factory.setupRound(address(ttt), opening, cfg);

        uint256 gameId = ttt.gameCounter() - 1;
        vm.prank(opponent);
        ttt.joinGame(gameId);

        SessionAccount sessionAccount = SessionAccount(payable(account));
        bytes memory resignData = abi.encodeWithSelector(TicTacToe.resign.selector, gameId);

        vm.prank(sessionKey);
        sessionAccount.executeWithSession(address(ttt), resignData);

        vm.prank(sessionKey);
        vm.expectRevert(SessionAccount.SessionInactive.selector);
        sessionAccount.executeWithSession(address(ttt), resignData);
    }

    /// @notice 用例：非会话 key 地址调用 executeWithSession 应回滚。
    function testExecuteWithSessionRevertsWhenWrongSessionKey() public {
        (, SessionAccount sessionAccount, uint256 gameId) = _setupDefaultRound();
        vm.prank(opponent);
        ttt.joinGame(gameId);

        bytes memory moveData = abi.encodeWithSelector(
            TicTacToe.makeMove.selector,
            gameId,
            uint8(0)
        );
        vm.prank(badActor);
        vm.expectRevert(SessionAccount.WrongSessionKey.selector);
        sessionAccount.executeWithSession(address(ttt), moveData);
    }

    /// @notice 用例：会话过期后调用 executeWithSession 应回滚。
    function testExecuteWithSessionRevertsWhenSessionExpired() public {
        (, SessionAccount sessionAccount, uint256 gameId) = _setupDefaultRound();
        vm.prank(opponent);
        ttt.joinGame(gameId);

        vm.warp(sessionAccount.sessionExpiresAt() + 1);
        bytes memory moveData = abi.encodeWithSelector(
            TicTacToe.makeMove.selector,
            gameId,
            uint8(0)
        );
        vm.prank(sessionKey);
        vm.expectRevert(SessionAccount.SessionExpired.selector);
        sessionAccount.executeWithSession(address(ttt), moveData);
    }

    /// @notice 用例：会话目标地址不匹配时应回滚。
    function testExecuteWithSessionRevertsWhenInvalidTarget() public {
        (, SessionAccount sessionAccount, uint256 gameId) = _setupDefaultRound();
        vm.prank(opponent);
        ttt.joinGame(gameId);

        bytes memory moveData = abi.encodeWithSelector(
            TicTacToe.makeMove.selector,
            gameId,
            uint8(0)
        );
        vm.prank(sessionKey);
        vm.expectRevert(SessionAccount.InvalidTarget.selector);
        sessionAccount.executeWithSession(address(mockTarget), moveData);
    }

    /// @notice 用例：calldata 长度不足 4 字节时应回滚。
    function testExecuteWithSessionRevertsWhenInvalidCalldata() public {
        (, SessionAccount sessionAccount, ) = _setupDefaultRound();

        vm.prank(sessionKey);
        vm.expectRevert(SessionAccount.InvalidCalldata.selector);
        sessionAccount.executeWithSession(address(ttt), hex"0102");
    }

    /// @notice 用例：会话被 owner 失效后调用应回滚 SessionInactive。
    function testExecuteWithSessionRevertsWhenSessionInactive() public {
        (, SessionAccount sessionAccount, ) = _setupDefaultRound();

        vm.prank(owner);
        sessionAccount.invalidateSession();

        vm.prank(sessionKey);
        vm.expectRevert(SessionAccount.SessionInactive.selector);
        sessionAccount.executeWithSession(
            address(ttt),
            abi.encodeWithSelector(TicTacToe.getLeaderboardCount.selector)
        );
    }

    /// @notice 用例：目标合约回滚原因应被原样透传。
    function testExecuteWithSessionBubblesTargetRevert() public {
        bytes4[] memory selectors = _singleSelector(MockSessionTarget.willRevert.selector);
        SessionAccount.SessionConfigInput memory cfg = _config(
            sessionKey,
            uint64(block.timestamp + 30 minutes),
            3,
            selectors,
            0
        );
        bytes memory opening = abi.encodeWithSelector(MockSessionTarget.ping.selector);

        vm.prank(owner);
        (address account, ) = factory.setupRound(address(mockTarget), opening, cfg);
        SessionAccount sessionAccount = SessionAccount(payable(account));

        vm.prank(sessionKey);
        vm.expectRevert(bytes("MOCK_REVERT"));
        sessionAccount.executeWithSession(
            address(mockTarget),
            abi.encodeWithSelector(MockSessionTarget.willRevert.selector)
        );
    }

    /// @notice 用例：仅 owner 可主动失效会话。
    function testInvalidateSessionRevertsWhenNotOwner() public {
        (, SessionAccount sessionAccount, ) = _setupDefaultRound();

        vm.prank(opponent);
        vm.expectRevert(SessionAccount.NotOwner.selector);
        sessionAccount.invalidateSession();
    }

    /// @notice 用例：重复调用 invalidateSession 应保持幂等。
    function testInvalidateSessionIsIdempotent() public {
        (, SessionAccount sessionAccount, ) = _setupDefaultRound();

        vm.prank(owner);
        sessionAccount.invalidateSession();
        assertFalse(sessionAccount.sessionActive());

        vm.prank(owner);
        sessionAccount.invalidateSession();
        assertFalse(sessionAccount.sessionActive());
    }

    /// @notice 用例：重复 selector 在启用时应自动去重。
    function testSelectorListDeduplicatesOnEnable() public {
        bytes4[] memory selectors = new bytes4[](3);
        selectors[0] = TicTacToe.makeMove.selector;
        selectors[1] = TicTacToe.makeMove.selector;
        selectors[2] = TicTacToe.resign.selector;

        SessionAccount.SessionConfigInput memory cfg = _config(
            sessionKey,
            uint64(block.timestamp + 30 minutes),
            8,
            selectors,
            0
        );

        vm.prank(owner);
        (address account, ) = factory.setupRound(
            address(ttt),
            abi.encodeWithSelector(TicTacToe.createGame.selector),
            cfg
        );
        SessionAccount sessionAccount = SessionAccount(payable(account));

        bytes4[] memory deduped = sessionAccount.getAllowedSelectors();
        assertEq(deduped.length, 2);
        assertTrue(sessionAccount.sessionSelectorAllowed(TicTacToe.makeMove.selector));
        assertTrue(sessionAccount.sessionSelectorAllowed(TicTacToe.resign.selector));
    }

    /// @notice 用例：开局目标调用失败时 setupRound 应整体回滚。
    function testSetupRoundRevertsWhenTargetCallReverts() public {
        SessionAccount.SessionConfigInput memory cfg = _config(
            sessionKey,
            uint64(block.timestamp + 30 minutes),
            2,
            _singleSelector(MockSessionTarget.ping.selector),
            0
        );

        vm.prank(owner);
        vm.expectRevert(bytes("MOCK_REVERT"));
        factory.setupRound(
            address(mockTarget),
            abi.encodeWithSelector(MockSessionTarget.willRevert.selector),
            cfg
        );
    }

    /// @notice 用例：预充值转账失败时 setupRound 应回滚 PrefundTransferFailed。
    function testSetupRoundRevertsWhenPrefundTransferFails() public {
        SessionAccount.SessionConfigInput memory cfg = _config(
            address(rejectReceiver),
            uint64(block.timestamp + 30 minutes),
            2,
            _singleSelector(TicTacToe.makeMove.selector),
            1 wei
        );

        vm.prank(owner);
        vm.expectRevert(SessionAccount.PrefundTransferFailed.selector);
        factory.setupRound{value: 1 wei}(
            address(ttt),
            abi.encodeWithSelector(TicTacToe.createGame.selector),
            cfg
        );
    }

    /// @notice 用例：target 为零地址时 setupRound 应回滚。
    function testSetupRoundRevertsWhenTargetIsZero() public {
        SessionAccount.SessionConfigInput memory cfg = _defaultConfig();

        vm.prank(owner);
        vm.expectRevert(SessionAccount.InvalidTarget.selector);
        factory.setupRound(
            address(0),
            abi.encodeWithSelector(TicTacToe.createGame.selector),
            cfg
        );
    }

    /// @notice 用例：sessionKey 为零地址时 setupRound 应回滚。
    function testSetupRoundRevertsWhenSessionKeyIsZero() public {
        SessionAccount.SessionConfigInput memory cfg = _config(
            address(0),
            uint64(block.timestamp + 30 minutes),
            2,
            _singleSelector(TicTacToe.makeMove.selector),
            0
        );

        vm.prank(owner);
        vm.expectRevert(SessionAccount.InvalidSessionKey.selector);
        factory.setupRound(
            address(ttt),
            abi.encodeWithSelector(TicTacToe.createGame.selector),
            cfg
        );
    }

    /// @notice 用例：过期时间非法（<= 当前时间）时 setupRound 应回滚。
    function testSetupRoundRevertsWhenExpiryInvalid() public {
        SessionAccount.SessionConfigInput memory cfg = _config(
            sessionKey,
            uint64(block.timestamp),
            2,
            _singleSelector(TicTacToe.makeMove.selector),
            0
        );

        vm.prank(owner);
        vm.expectRevert(SessionAccount.InvalidExpiry.selector);
        factory.setupRound(
            address(ttt),
            abi.encodeWithSelector(TicTacToe.createGame.selector),
            cfg
        );
    }

    /// @notice 用例：maxCalls 为 0 时 setupRound 应回滚。
    function testSetupRoundRevertsWhenMaxCallsIsZero() public {
        SessionAccount.SessionConfigInput memory cfg = _config(
            sessionKey,
            uint64(block.timestamp + 30 minutes),
            0,
            _singleSelector(TicTacToe.makeMove.selector),
            0
        );

        vm.prank(owner);
        vm.expectRevert(SessionAccount.InvalidMaxCalls.selector);
        factory.setupRound(
            address(ttt),
            abi.encodeWithSelector(TicTacToe.createGame.selector),
            cfg
        );
    }

    /// @notice 用例：selector 白名单为空时 setupRound 应回滚。
    function testSetupRoundRevertsWhenSelectorListEmpty() public {
        bytes4[] memory emptySelectors = new bytes4[](0);
        SessionAccount.SessionConfigInput memory cfg = _config(
            sessionKey,
            uint64(block.timestamp + 30 minutes),
            2,
            emptySelectors,
            0
        );

        vm.prank(owner);
        vm.expectRevert(SessionAccount.EmptySelectorList.selector);
        factory.setupRound(
            address(ttt),
            abi.encodeWithSelector(TicTacToe.createGame.selector),
            cfg
        );
    }

    /// @notice 用例：会话账户的工厂入口函数必须受 onlyFactory 保护。
    function testSessionAccountOnlyFactoryGuardsExternalFactoryMethods() public {
        (, SessionAccount sessionAccount, ) = _setupDefaultRound();
        SessionAccount.SessionConfigInput memory cfg = _defaultConfig();
        bytes memory opening = abi.encodeWithSelector(TicTacToe.createGame.selector);

        vm.prank(owner);
        vm.expectRevert(SessionAccount.NotFactory.selector);
        sessionAccount.setupRoundFromFactory(owner, address(ttt), opening, cfg);

        vm.prank(owner);
        vm.expectRevert(SessionAccount.NotFactory.selector);
        sessionAccount.refreshSessionFromFactory(owner, address(ttt), cfg);
    }

    /// @notice 用例：独立部署 SessionAccount 时，零 owner 构造应回滚。
    function testStandaloneSessionAccountConstructorRevertsOnZeroOwner() public {
        vm.expectRevert(SessionAccount.InvalidOwner.selector);
        new SessionAccount(address(0), address(this));
    }

    /// @notice 用例：工厂入口调用 owner 参数不匹配时应回滚 InvalidOwner。
    function testStandaloneSessionAccountFactoryCallsValidateOwner() public {
        SessionAccount standalone = new SessionAccount(owner, address(this));
        SessionAccount.SessionConfigInput memory cfg = _config(
            sessionKey,
            uint64(block.timestamp + 30 minutes),
            2,
            _singleSelector(MockSessionTarget.ping.selector),
            0
        );

        vm.expectRevert(SessionAccount.InvalidOwner.selector);
        standalone.setupRoundFromFactory(
            opponent,
            address(mockTarget),
            abi.encodeWithSelector(MockSessionTarget.ping.selector),
            cfg
        );

        vm.expectRevert(SessionAccount.InvalidOwner.selector);
        standalone.refreshSessionFromFactory(opponent, address(mockTarget), cfg);
    }
}
