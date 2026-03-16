// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title BookManagement
/// @notice 链上图书借阅管理台账，支持馆藏、库存、读者与借还流水管理。
/// @dev 仅存储哈希摘要，不在链上保存图书明文信息。
contract BookManagement {
    // ---------- 核心数据结构 ----------
    struct Book {
        uint256 id;
        bytes32 contentHash;
        bytes32 metaHash;
        bytes32 policyHash;
        address registrar;
        bool active;
        uint32 totalCopies;
        uint32 availableCopies;
    }

    struct ReaderState {
        bool registered;
        bool active;
        uint64 registeredAt;
    }

    struct BorrowRecord {
        uint256 id;
        address reader;
        uint256 bookId;
        bool isBorrow;
        uint64 timestamp;
        address operator;
    }

    // ---------- 权限模型 ----------
    address public owner;
    mapping(address => bool) public operators;

    // ---------- 馆藏状态 ----------
    uint256 private nextBookId = 1;
    mapping(uint256 => Book) private books;

    // ---------- 读者状态 ----------
    mapping(address => ReaderState) private readers;
    address[] private readerIndex;

    // ---------- 借阅状态 ----------
    uint256 private nextBorrowRecordId = 1;
    mapping(uint256 => BorrowRecord) private borrowRecords;
    mapping(address => mapping(uint256 => bool)) private activeLoans;
    uint256 public activeBorrowCount;

    // ---------- 自定义错误 ----------
    error NotOwner();
    error NotOperator();
    error ZeroAddress();
    error ReaderAlreadyRegistered();
    error ReaderNotRegistered();
    error ReaderNotActive();
    error ReaderIndexOutOfBounds();
    error ContentHashRequired();
    error MetaHashRequired();
    error TotalCopiesRequired();
    error EmptyBatch();
    error MetaLengthMismatch();
    error PolicyLengthMismatch();
    error CopiesLengthMismatch();
    error BelowBorrowedCopies();
    error BookInactive();
    error BookUnavailable();
    error LoanAlreadyActive();
    error LoanNotActive();
    error BorrowIndexOutOfBounds();
    error BookNotFound();

    // ---------- 事件 ----------
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event OperatorUpdated(address indexed operator, bool allowed);

    event BookRegistered(
        uint256 indexed bookId,
        bytes32 contentHash,
        bytes32 metaHash,
        bytes32 policyHash,
        uint32 totalCopies,
        address indexed registrar
    );
    event BookActiveSet(uint256 indexed bookId, bool active);
    event BookInventoryUpdated(uint256 indexed bookId, uint32 totalCopies, uint32 availableCopies);

    event ReaderRegistered(address indexed reader, uint64 registeredAt);
    event ReaderStatusUpdated(address indexed reader, bool active);

    event BorrowRecorded(
        uint256 indexed recordId,
        address indexed reader,
        uint256 indexed bookId,
        bool isBorrow,
        address operator,
        uint64 timestamp
    );

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyOperator() {
        if (msg.sender != owner && !operators[msg.sender]) revert NotOperator();
        _;
    }

    constructor() {
        owner = msg.sender;
        operators[msg.sender] = true;
        emit OwnershipTransferred(address(0), msg.sender);
        emit OperatorUpdated(msg.sender, true);
    }

    /// @notice 设置或移除操作员权限（仅 owner）。
    /// @param operator 待授权地址。
    /// @param allowed true 为授权，false 为移除。
    function setOperator(address operator, bool allowed) external onlyOwner {
        if (operator == address(0)) revert ZeroAddress();
        operators[operator] = allowed;
        emit OperatorUpdated(operator, allowed);
    }

    /// @notice 转移 owner 权限到新地址（仅 owner）。
    /// @param newOwner 新 owner 地址，不能为零地址。
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    /// @notice 读者自助注册。
    /// @dev 注册后默认启用，可被操作员后续停用。
    function registerReader() external {
        ReaderState storage state = readers[msg.sender];
        if (state.registered) revert ReaderAlreadyRegistered();
        uint64 nowTs = uint64(block.timestamp);
        readers[msg.sender] = ReaderState({registered: true, active: true, registeredAt: nowTs});
        readerIndex.push(msg.sender);
        emit ReaderRegistered(msg.sender, nowTs);
    }

    /// @notice 启用或停用读者（仅 operator）。
    /// @param reader 读者钱包地址。
    /// @param active true 为启用，false 为停用。
    function setReaderActive(address reader, bool active) external onlyOperator {
        if (reader == address(0)) revert ZeroAddress();
        ReaderState storage state = readers[reader];
        if (!state.registered) revert ReaderNotRegistered();
        state.active = active;
        emit ReaderStatusUpdated(reader, active);
    }

    /// @notice 获取已注册读者总数。
    /// @dev 用于前端按索引分页/全量读取。
    function getReaderCount() external view returns (uint256) {
        return readerIndex.length;
    }

    /// @notice 按索引读取读者条目（0-based）。
    /// @param index 读者索引。
    /// @return reader 读者地址。
    /// @return active 是否启用。
    /// @return registeredAt 注册时间。
    function getReaderAt(uint256 index)
        external
        view
        returns (address reader, bool active, uint64 registeredAt)
    {
        if (index >= readerIndex.length) revert ReaderIndexOutOfBounds();
        reader = readerIndex[index];
        ReaderState memory state = readers[reader];
        active = state.active;
        registeredAt = state.registeredAt;
    }

    /// @notice 查询指定地址的读者状态。
    /// @param reader 读者地址。
    /// @return registered 是否已注册。
    /// @return active 是否启用。
    /// @return registeredAt 注册时间。
    function getReader(address reader)
        external
        view
        returns (bool registered, bool active, uint64 registeredAt)
    {
        ReaderState memory state = readers[reader];
        return (state.registered, state.active, state.registeredAt);
    }

    /// @notice 上架单本图书并设置总库存（仅 operator）。
    /// @dev totalCopies 不能为空且会同步初始化 availableCopies。
    /// @param contentHash 图书内容哈希。
    /// @param metaHash 图书元数据哈希。
    /// @param policyHash 图书策略哈希。
    /// @param totalCopies 上架总库存。
    /// @return bookId 新书 ID。
    function registerBook(
        bytes32 contentHash,
        bytes32 metaHash,
        bytes32 policyHash,
        uint32 totalCopies
    ) external onlyOperator returns (uint256 bookId) {
        if (contentHash == bytes32(0)) revert ContentHashRequired();
        if (metaHash == bytes32(0)) revert MetaHashRequired();
        if (totalCopies == 0) revert TotalCopiesRequired();

        bookId = nextBookId++;
        books[bookId] = Book({
            id: bookId,
            contentHash: contentHash,
            metaHash: metaHash,
            policyHash: policyHash,
            registrar: msg.sender,
            active: true,
            totalCopies: totalCopies,
            availableCopies: totalCopies
        });

        emit BookRegistered(bookId, contentHash, metaHash, policyHash, totalCopies, msg.sender);
    }

    /// @notice 批量上架图书并设置库存（仅 operator）。
    /// @dev 所有输入数组长度必须一致，且每本书库存需大于 0。
    /// @param contentHashes 图书内容哈希数组。
    /// @param metaHashes 图书元数据哈希数组。
    /// @param policyHashes 图书策略哈希数组。
    /// @param totalCopiesList 每本书对应总库存。
    /// @return bookIds 新书 ID 列表。
    function registerBooks(
        bytes32[] calldata contentHashes,
        bytes32[] calldata metaHashes,
        bytes32[] calldata policyHashes,
        uint32[] calldata totalCopiesList
    ) external onlyOperator returns (uint256[] memory bookIds) {
        uint256 count = contentHashes.length;
        if (count == 0) revert EmptyBatch();
        if (metaHashes.length != count) revert MetaLengthMismatch();
        if (policyHashes.length != count) revert PolicyLengthMismatch();
        if (totalCopiesList.length != count) revert CopiesLengthMismatch();

        bookIds = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            bytes32 contentHash = contentHashes[i];
            bytes32 metaHash = metaHashes[i];
            bytes32 policyHash = policyHashes[i];
            uint32 totalCopies = totalCopiesList[i];

            if (contentHash == bytes32(0)) revert ContentHashRequired();
            if (metaHash == bytes32(0)) revert MetaHashRequired();
            if (totalCopies == 0) revert TotalCopiesRequired();

            uint256 bookId = nextBookId++;
            books[bookId] = Book({
                id: bookId,
                contentHash: contentHash,
                metaHash: metaHash,
                policyHash: policyHash,
                registrar: msg.sender,
                active: true,
                totalCopies: totalCopies,
                availableCopies: totalCopies
            });

            bookIds[i] = bookId;
            emit BookRegistered(bookId, contentHash, metaHash, policyHash, totalCopies, msg.sender);
        }
    }

    /// @notice 切换图书上架状态（仅 operator）。
    /// @param bookId 图书 ID。
    /// @param active true 上架，false 下架。
    function setBookActive(uint256 bookId, bool active) external onlyOperator {
        Book storage book = _requireBook(bookId);
        book.active = active;
        emit BookActiveSet(bookId, active);
    }

    /// @notice 调整图书总库存（仅 operator）。
    /// @dev 新库存不得低于当前在借数量。
    /// @param bookId 图书 ID。
    /// @param newTotalCopies 新总库存。
    function setBookTotalCopies(uint256 bookId, uint32 newTotalCopies) external onlyOperator {
        Book storage book = _requireBook(bookId);
        uint32 borrowedCopies = book.totalCopies - book.availableCopies;
        if (newTotalCopies < borrowedCopies) revert BelowBorrowedCopies();

        book.totalCopies = newTotalCopies;
        book.availableCopies = newTotalCopies - borrowedCopies;

        emit BookInventoryUpdated(bookId, book.totalCopies, book.availableCopies);
    }

    /// @notice 记录借阅（仅 operator）。
    /// @dev 校验读者状态、图书状态、库存与重复借阅后写入流水。
    /// @param reader 读者地址。
    /// @param bookId 图书 ID。
    function borrowBook(address reader, uint256 bookId) external onlyOperator {
        if (reader == address(0)) revert ZeroAddress();

        ReaderState memory readerState = readers[reader];
        if (!readerState.registered) revert ReaderNotRegistered();
        if (!readerState.active) revert ReaderNotActive();

        Book storage book = _requireBook(bookId);
        if (!book.active) revert BookInactive();
        if (book.availableCopies == 0) revert BookUnavailable();
        if (activeLoans[reader][bookId]) revert LoanAlreadyActive();

        activeLoans[reader][bookId] = true;
        book.availableCopies -= 1;
        activeBorrowCount += 1;

        _appendBorrowRecord(reader, bookId, true);
    }

    /// @notice 记录归还（仅 operator）。
    /// @dev 只有存在在借记录时允许归还。
    /// @param reader 读者地址。
    /// @param bookId 图书 ID。
    function returnBook(address reader, uint256 bookId) external onlyOperator {
        if (reader == address(0)) revert ZeroAddress();
        if (!activeLoans[reader][bookId]) revert LoanNotActive();

        Book storage book = _requireBook(bookId);
        activeLoans[reader][bookId] = false;
        book.availableCopies += 1;
        activeBorrowCount -= 1;

        _appendBorrowRecord(reader, bookId, false);
    }

    /// @notice 按图书 ID 读取馆藏详情。
    /// @param bookId 图书 ID。
    /// @return 图书结构体。
    function getBook(uint256 bookId) external view returns (Book memory) {
        Book storage book = _requireBook(bookId);
        return book;
    }

    /// @notice 获取馆藏总数（已注册图书数）。
    function getBookCount() external view returns (uint256) {
        return nextBookId - 1;
    }

    /// @notice 获取借还流水总数。
    function getBorrowRecordCount() external view returns (uint256) {
        return nextBorrowRecordId - 1;
    }

    /// @notice 按索引读取借还流水（0-based）。
    /// @param index 借还流水索引。
    function getBorrowRecordAt(uint256 index) external view returns (BorrowRecord memory) {
        uint256 count = nextBorrowRecordId - 1;
        if (index >= count) revert BorrowIndexOutOfBounds();
        return borrowRecords[index + 1];
    }

    /// @notice 查询某读者对某图书是否处于在借状态。
    /// @param reader 读者地址。
    /// @param bookId 图书 ID。
    /// @return 是否在借。
    function isBorrowing(address reader, uint256 bookId) external view returns (bool) {
        return activeLoans[reader][bookId];
    }

    /// @dev 统一写入借还流水并发出 BorrowRecorded 事件。
    function _appendBorrowRecord(address reader, uint256 bookId, bool isBorrowAction) internal {
        uint256 recordId = nextBorrowRecordId++;
        uint64 nowTs = uint64(block.timestamp);
        borrowRecords[recordId] = BorrowRecord({
            id: recordId,
            reader: reader,
            bookId: bookId,
            isBorrow: isBorrowAction,
            timestamp: nowTs,
            operator: msg.sender
        });

        emit BorrowRecorded(recordId, reader, bookId, isBorrowAction, msg.sender, nowTs);
    }

    /// @dev 统一检查图书是否存在，不存在时回退 BookNotFound。
    function _requireBook(uint256 bookId) internal view returns (Book storage) {
        Book storage book = books[bookId];
        if (book.id == 0) revert BookNotFound();
        return book;
    }
}
