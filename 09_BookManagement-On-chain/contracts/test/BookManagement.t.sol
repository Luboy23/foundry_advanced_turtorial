// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../src/BookManagement.sol";

/// @dev Foundry cheatcode 最小接口：本测试仅使用 expectEmit。
interface Vm {
    function expectEmit(bool, bool, bool, bool) external;
}

/// @dev 通过代理合约发起外部调用，模拟“非 owner / 非 operator”身份场景。
contract CallProxy {
    /// @dev 代理调用 setOperator。
    function callSetOperator(address registry, address operator, bool allowed)
        external
        returns (bool, bytes memory)
    {
        return registry.call(abi.encodeWithSelector(BookManagement.setOperator.selector, operator, allowed));
    }

    /// @dev 代理调用 transferOwnership。
    function callTransferOwnership(address registry, address newOwner) external returns (bool, bytes memory) {
        return registry.call(abi.encodeWithSelector(BookManagement.transferOwnership.selector, newOwner));
    }

    /// @dev 代理调用 registerReader。
    function callRegisterReader(address registry) external returns (bool, bytes memory) {
        return registry.call(abi.encodeWithSelector(BookManagement.registerReader.selector));
    }

    /// @dev 代理调用 setReaderActive。
    function callSetReaderActive(address registry, address reader, bool active)
        external
        returns (bool, bytes memory)
    {
        return registry.call(abi.encodeWithSelector(BookManagement.setReaderActive.selector, reader, active));
    }

    /// @dev 代理调用 registerBook。
    function callRegisterBook(
        address registry,
        bytes32 contentHash,
        bytes32 metaHash,
        bytes32 policyHash,
        uint32 totalCopies
    ) external returns (bool, bytes memory) {
        return registry.call(
            abi.encodeWithSelector(
                BookManagement.registerBook.selector,
                contentHash,
                metaHash,
                policyHash,
                totalCopies
            )
        );
    }

    /// @dev 代理调用 registerBooks（批量上架）。
    function callRegisterBooks(
        address registry,
        bytes32[] calldata contentHashes,
        bytes32[] calldata metaHashes,
        bytes32[] calldata policyHashes,
        uint32[] calldata totalCopiesList
    ) external returns (bool, bytes memory) {
        return registry.call(
            abi.encodeWithSelector(
                BookManagement.registerBooks.selector,
                contentHashes,
                metaHashes,
                policyHashes,
                totalCopiesList
            )
        );
    }

    /// @dev 代理调用 setBookActive。
    function callSetBookActive(address registry, uint256 bookId, bool active)
        external
        returns (bool, bytes memory)
    {
        return registry.call(abi.encodeWithSelector(BookManagement.setBookActive.selector, bookId, active));
    }

    /// @dev 代理调用 setBookTotalCopies。
    function callSetBookTotalCopies(address registry, uint256 bookId, uint32 totalCopies)
        external
        returns (bool, bytes memory)
    {
        return registry.call(
            abi.encodeWithSelector(BookManagement.setBookTotalCopies.selector, bookId, totalCopies)
        );
    }

    /// @dev 代理调用 borrowBook。
    function callBorrowBook(address registry, address reader, uint256 bookId)
        external
        returns (bool, bytes memory)
    {
        return registry.call(abi.encodeWithSelector(BookManagement.borrowBook.selector, reader, bookId));
    }

    /// @dev 代理调用 returnBook。
    function callReturnBook(address registry, address reader, uint256 bookId)
        external
        returns (bool, bytes memory)
    {
        return registry.call(abi.encodeWithSelector(BookManagement.returnBook.selector, reader, bookId));
    }
}

/// @dev 轻量断言与回退解析工具，避免依赖 forge-std，保持测试模板可移植。
contract BookManagementTestBase {
    Vm internal constant vm =
        Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    /// @dev 断言 condition 为 true。
    function assertTrue(bool condition, string memory message) internal pure {
        if (!condition) revert(message);
    }

    /// @dev 断言 condition 为 false。
    function assertFalse(bool condition, string memory message) internal pure {
        if (condition) revert(message);
    }

    /// @dev uint256 相等断言。
    function assertEq(uint256 a, uint256 b, string memory message) internal pure {
        if (a != b) revert(message);
    }

    /// @dev address 相等断言。
    function assertEq(address a, address b, string memory message) internal pure {
        if (a != b) revert(message);
    }

    /// @dev bytes32 相等断言。
    function assertEq(bytes32 a, bytes32 b, string memory message) internal pure {
        if (a != b) revert(message);
    }

    /// @dev bytes4 相等断言。
    function assertEq(bytes4 a, bytes4 b, string memory message) internal pure {
        if (a != b) revert(message);
    }

    /// @dev bool 相等断言。
    function assertEq(bool a, bool b, string memory message) internal pure {
        if (a != b) revert(message);
    }

    /// @dev 解析 Error(string) 回退消息，便于调试失败原因。
    function decodeRevertReason(bytes memory data) internal pure returns (string memory) {
        if (data.length < 4) return "";
        bytes4 selector;
        assembly {
            selector := mload(add(data, 32))
        }
        if (selector != 0x08c379a0) return "";
        if (data.length < 68) return "";
        bytes memory sliced = new bytes(data.length - 4);
        for (uint256 i = 4; i < data.length; i++) {
            sliced[i - 4] = data[i];
        }
        return abi.decode(sliced, (string));
    }

    /// @dev 提取自定义错误 selector（前 4 字节）。
    function decodeRevertSelector(bytes memory data) internal pure returns (bytes4 selector) {
        if (data.length < 4) return bytes4(0);
        assembly {
            selector := mload(add(data, 32))
        }
    }

    /// @dev 断言调用必须回退且 selector 与预期一致。
    function assertRevertSelector(bool ok, bytes memory data, bytes4 expected, string memory context)
        internal
        pure
    {
        assertFalse(ok, context);
        if (decodeRevertSelector(data) != expected) revert(context);
    }
}

contract BookManagementTest is BookManagementTestBase {
    event BorrowRecorded(
        uint256 indexed recordId,
        address indexed reader,
        uint256 indexed bookId,
        bool isBorrow,
        address operator,
        uint64 timestamp
    );

    BookManagement private registry;
    CallProxy private proxy;

    bytes32 private constant CONTENT_HASH = keccak256(abi.encodePacked("content"));
    bytes32 private constant META_HASH = keccak256(abi.encodePacked("meta"));
    bytes32 private constant POLICY_HASH = keccak256(abi.encodePacked("policy"));

    // Arrange：每个测试用例都重新部署 registry 与 proxy，避免状态污染。
    function setUp() public {
        registry = new BookManagement();
        proxy = new CallProxy();
    }

    // 场景：部署后 owner/operator/在借数量应初始化正确。
    function testConstructorInitializesState() public view {
        assertEq(registry.owner(), address(this), "owner should be deployer");
        assertTrue(registry.operators(address(this)), "owner should be operator");
        assertEq(registry.activeBorrowCount(), 0, "active borrow count should be zero");
    }

    // 场景：owner 可正常授予与撤销 operator。
    function testSetOperatorByOwner() public {
        registry.setOperator(address(proxy), true);
        assertTrue(registry.operators(address(proxy)), "operator should be enabled");
        registry.setOperator(address(proxy), false);
        assertFalse(registry.operators(address(proxy)), "operator should be disabled");
    }

    // 场景：零地址与非 owner 调用 setOperator 必须回退。
    function testSetOperatorValidation() public {
        (bool ok, bytes memory data) = address(registry).call(
            abi.encodeWithSelector(BookManagement.setOperator.selector, address(0), true)
        );
        assertRevertSelector(ok, data, BookManagement.ZeroAddress.selector, "zero operator should revert");

        (ok, data) = proxy.callSetOperator(address(registry), address(proxy), true);
        assertRevertSelector(ok, data, BookManagement.NotOwner.selector, "non-owner should revert");
    }

    // 场景：仅 owner 可转移所有权，成功后 owner 地址应更新。
    function testTransferOwnershipValidation() public {
        (bool ok, bytes memory data) = proxy.callTransferOwnership(address(registry), address(proxy));
        assertRevertSelector(ok, data, BookManagement.NotOwner.selector, "non-owner transfer should revert");

        registry.transferOwnership(address(proxy));
        assertEq(registry.owner(), address(proxy), "owner should update");
    }

    // 场景：读者注册后默认启用，且 operator 可停用。
    function testReaderRegistrationAndToggle() public {
        registry.registerReader();
        (bool registered, bool active, uint64 registeredAt) = registry.getReader(address(this));
        assertTrue(registered, "registered true");
        assertTrue(active, "active true");
        assertTrue(registeredAt > 0, "registeredAt set");

        registry.setReaderActive(address(this), false);
        (, bool disabled,) = registry.getReader(address(this));
        assertFalse(disabled, "reader should be disabled");
    }

    // 场景：重复注册、未注册读者停用、非 operator 停用均应回退。
    function testReaderRegistrationValidation() public {
        registry.registerReader();
        (bool ok, bytes memory data) = address(registry).call(
            abi.encodeWithSelector(BookManagement.registerReader.selector)
        );
        assertRevertSelector(ok, data, BookManagement.ReaderAlreadyRegistered.selector, "duplicate register should revert");

        (ok, data) = address(registry).call(
            abi.encodeWithSelector(BookManagement.setReaderActive.selector, address(proxy), true)
        );
        assertRevertSelector(ok, data, BookManagement.ReaderNotRegistered.selector, "unregistered reader should revert");

        (ok, data) = proxy.callSetReaderActive(address(registry), address(this), false);
        assertRevertSelector(ok, data, BookManagement.NotOperator.selector, "non-operator toggle should revert");
    }

    // 场景：上架单本图书后库存字段应正确初始化。
    function testRegisterBookSuccess() public {
        uint256 bookId = registry.registerBook(CONTENT_HASH, META_HASH, POLICY_HASH, 3);
        assertEq(bookId, 1, "book id");
        BookManagement.Book memory book = registry.getBook(1);
        assertEq(book.totalCopies, 3, "total copies");
        assertEq(book.availableCopies, 3, "available copies");
        assertTrue(book.active, "book active");
    }

    // 场景：上架图书参数缺失或非 operator 调用必须回退。
    function testRegisterBookValidation() public {
        (bool ok, bytes memory data) = address(registry).call(
            abi.encodeWithSelector(
                BookManagement.registerBook.selector,
                bytes32(0),
                META_HASH,
                POLICY_HASH,
                uint32(1)
            )
        );
        assertRevertSelector(ok, data, BookManagement.ContentHashRequired.selector, "content hash required");

        (ok, data) = address(registry).call(
            abi.encodeWithSelector(
                BookManagement.registerBook.selector,
                CONTENT_HASH,
                bytes32(0),
                POLICY_HASH,
                uint32(1)
            )
        );
        assertRevertSelector(ok, data, BookManagement.MetaHashRequired.selector, "meta hash required");

        (ok, data) = address(registry).call(
            abi.encodeWithSelector(
                BookManagement.registerBook.selector,
                CONTENT_HASH,
                META_HASH,
                POLICY_HASH,
                uint32(0)
            )
        );
        assertRevertSelector(ok, data, BookManagement.TotalCopiesRequired.selector, "copies required");

        (ok, data) = proxy.callRegisterBook(address(registry), CONTENT_HASH, META_HASH, POLICY_HASH, 1);
        assertRevertSelector(ok, data, BookManagement.NotOperator.selector, "non-operator register should revert");
    }

    // 场景：批量上架成功后应返回 ID 列表，长度不匹配或非 operator 必须回退。
    function testRegisterBooksSuccessAndValidation() public {
        bytes32[] memory contentHashes = new bytes32[](2);
        bytes32[] memory metaHashes = new bytes32[](2);
        bytes32[] memory policyHashes = new bytes32[](2);
        uint32[] memory totalCopiesList = new uint32[](2);

        contentHashes[0] = bytes32(uint256(1));
        contentHashes[1] = bytes32(uint256(2));
        metaHashes[0] = bytes32(uint256(3));
        metaHashes[1] = bytes32(uint256(4));
        policyHashes[0] = bytes32(uint256(5));
        policyHashes[1] = bytes32(uint256(6));
        totalCopiesList[0] = 2;
        totalCopiesList[1] = 5;

        uint256[] memory ids = registry.registerBooks(
            contentHashes,
            metaHashes,
            policyHashes,
            totalCopiesList
        );
        assertEq(ids.length, 2, "ids length");
        assertEq(registry.getBookCount(), 2, "book count");

        BookManagement.Book memory book2 = registry.getBook(2);
        assertEq(book2.totalCopies, 5, "book2 copies");
        assertEq(book2.availableCopies, 5, "book2 available");

        uint32[] memory badCopies = new uint32[](1);
        badCopies[0] = 1;
        (bool ok, bytes memory data) = address(registry).call(
            abi.encodeWithSelector(
                BookManagement.registerBooks.selector,
                contentHashes,
                metaHashes,
                policyHashes,
                badCopies
            )
        );
        assertRevertSelector(ok, data, BookManagement.CopiesLengthMismatch.selector, "copies length mismatch");

        (ok, data) = proxy.callRegisterBooks(
            address(registry),
            contentHashes,
            metaHashes,
            policyHashes,
            totalCopiesList
        );
        assertRevertSelector(ok, data, BookManagement.NotOperator.selector, "non-operator registerBooks");
    }

    // 场景：可切换图书启用状态并调整库存，非 operator 必须回退。
    function testSetBookActiveAndInventory() public {
        uint256 bookId = registry.registerBook(CONTENT_HASH, META_HASH, POLICY_HASH, 4);
        registry.setBookActive(bookId, false);
        BookManagement.Book memory book = registry.getBook(bookId);
        assertFalse(book.active, "book inactive");

        registry.setBookTotalCopies(bookId, 6);
        book = registry.getBook(bookId);
        assertEq(book.totalCopies, 6, "total updated");
        assertEq(book.availableCopies, 6, "available updated");

        (bool ok, bytes memory data) = proxy.callSetBookActive(address(registry), bookId, true);
        assertRevertSelector(ok, data, BookManagement.NotOperator.selector, "non-operator setBookActive");

        (ok, data) = proxy.callSetBookTotalCopies(address(registry), bookId, 8);
        assertRevertSelector(ok, data, BookManagement.NotOperator.selector, "non-operator setBookTotalCopies");
    }

    // 场景：完整借还路径应正确更新库存、在借状态与借还流水顺序。
    function testBorrowAndReturnHappyPath() public {
        registry.registerBook(CONTENT_HASH, META_HASH, POLICY_HASH, 2);
        (bool ok, bytes memory data) = proxy.callRegisterReader(address(registry));
        assertTrue(ok, decodeRevertReason(data));

        registry.borrowBook(address(proxy), 1);

        BookManagement.Book memory book = registry.getBook(1);
        assertEq(book.availableCopies, 1, "available decremented");
        assertEq(registry.activeBorrowCount(), 1, "active borrow count");
        assertTrue(registry.isBorrowing(address(proxy), 1), "loan active");

        registry.returnBook(address(proxy), 1);
        book = registry.getBook(1);
        assertEq(book.availableCopies, 2, "available restored");
        assertEq(registry.activeBorrowCount(), 0, "active borrow count reset");
        assertFalse(registry.isBorrowing(address(proxy), 1), "loan inactive");

        assertEq(registry.getBorrowRecordCount(), 2, "two records");
        BookManagement.BorrowRecord memory r0 = registry.getBorrowRecordAt(0);
        BookManagement.BorrowRecord memory r1 = registry.getBorrowRecordAt(1);
        assertTrue(r0.isBorrow, "first is borrow");
        assertFalse(r1.isBorrow, "second is return");
        assertEq(r0.reader, address(proxy), "reader matched");
    }

    // 场景：借阅前置校验（读者/图书/库存/权限）失败时应按预期回退。
    function testBorrowValidation() public {
        registry.registerBook(CONTENT_HASH, META_HASH, POLICY_HASH, 1);

        (bool ok, bytes memory data) = address(registry).call(
            abi.encodeWithSelector(BookManagement.borrowBook.selector, address(proxy), 1)
        );
        assertRevertSelector(ok, data, BookManagement.ReaderNotRegistered.selector, "unregistered reader borrow");

        (ok, data) = proxy.callRegisterReader(address(registry));
        assertTrue(ok, decodeRevertReason(data));

        registry.setReaderActive(address(proxy), false);
        (ok, data) = address(registry).call(
            abi.encodeWithSelector(BookManagement.borrowBook.selector, address(proxy), 1)
        );
        assertRevertSelector(ok, data, BookManagement.ReaderNotActive.selector, "inactive reader borrow");

        registry.setReaderActive(address(proxy), true);
        registry.setBookActive(1, false);
        (ok, data) = address(registry).call(
            abi.encodeWithSelector(BookManagement.borrowBook.selector, address(proxy), 1)
        );
        assertRevertSelector(ok, data, BookManagement.BookInactive.selector, "inactive book borrow");

        registry.setBookActive(1, true);
        registry.borrowBook(address(proxy), 1);

        (ok, data) = address(registry).call(
            abi.encodeWithSelector(BookManagement.borrowBook.selector, address(proxy), 1)
        );
        assertRevertSelector(ok, data, BookManagement.BookUnavailable.selector, "no copies borrow");

        (ok, data) = proxy.callBorrowBook(address(registry), address(proxy), 1);
        assertRevertSelector(ok, data, BookManagement.NotOperator.selector, "non-operator borrow");
    }

    // 场景：同一读者重复借同一本书时，即使库存充足也必须回退。
    function testBorrowRejectsDuplicateLoanEvenWithInventory() public {
        registry.registerBook(CONTENT_HASH, META_HASH, POLICY_HASH, 3);
        (bool ok, bytes memory data) = proxy.callRegisterReader(address(registry));
        assertTrue(ok, decodeRevertReason(data));

        registry.borrowBook(address(proxy), 1);

        (ok, data) = address(registry).call(
            abi.encodeWithSelector(BookManagement.borrowBook.selector, address(proxy), 1)
        );
        assertRevertSelector(ok, data, BookManagement.LoanAlreadyActive.selector, "duplicate loan should revert");
    }

    // 场景：无在借记录不可归还，但停用读者仍可执行归还结清。
    function testReturnValidationAndDisabledReaderCanReturn() public {
        registry.registerBook(CONTENT_HASH, META_HASH, POLICY_HASH, 1);
        (bool ok, bytes memory data) = proxy.callRegisterReader(address(registry));
        assertTrue(ok, decodeRevertReason(data));

        (ok, data) = address(registry).call(
            abi.encodeWithSelector(BookManagement.returnBook.selector, address(proxy), 1)
        );
        assertRevertSelector(ok, data, BookManagement.LoanNotActive.selector, "return without active loan");

        registry.borrowBook(address(proxy), 1);
        registry.setReaderActive(address(proxy), false);
        registry.returnBook(address(proxy), 1);

        (ok, data) = proxy.callReturnBook(address(registry), address(proxy), 1);
        assertRevertSelector(ok, data, BookManagement.NotOperator.selector, "non-operator return");
    }

    // 场景：库存调整不能低于当前在借数量。
    function testInventoryCannotDropBelowBorrowed() public {
        registry.registerBook(CONTENT_HASH, META_HASH, POLICY_HASH, 3);
        (bool ok, bytes memory data) = proxy.callRegisterReader(address(registry));
        assertTrue(ok, decodeRevertReason(data));

        registry.borrowBook(address(proxy), 1);

        (ok, data) = address(registry).call(
            abi.encodeWithSelector(BookManagement.setBookTotalCopies.selector, 1, uint32(0))
        );
        assertRevertSelector(ok, data, BookManagement.BelowBorrowedCopies.selector, "copies below borrowed");
    }

    // 场景：借还流水越界读取必须回退。
    function testGetBorrowRecordBounds() public {
        (bool ok, bytes memory data) = address(registry).call(
            abi.encodeWithSelector(BookManagement.getBorrowRecordAt.selector, 0)
        );
        assertRevertSelector(ok, data, BookManagement.BorrowIndexOutOfBounds.selector, "missing borrow record");
    }

    // 场景：借阅成功后应触发 BorrowRecorded 事件并携带正确字段。
    function testBorrowRecordedEvent() public {
        registry.registerBook(CONTENT_HASH, META_HASH, POLICY_HASH, 1);
        (bool ok, bytes memory data) = proxy.callRegisterReader(address(registry));
        assertTrue(ok, decodeRevertReason(data));

        uint64 ts = uint64(block.timestamp);
        vm.expectEmit(true, true, true, true);
        emit BorrowRecorded(1, address(proxy), 1, true, address(this), ts);
        registry.borrowBook(address(proxy), 1);
    }
}
