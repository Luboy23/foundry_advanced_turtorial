// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {FixedPriceMarket} from "../src/FixedPriceMarket.sol";
import {IERC165, IERC721} from "../src/interfaces/IERC721.sol";
import {MyNFT} from "../src/MyNFT.sol";
import {TestBase} from "./TestBase.sol";

contract FixedPriceMarketTest is TestBase {
    event Listed(uint256 indexed listingId, address indexed seller, uint256 indexed tokenId, uint256 price);
    event Cancelled(uint256 indexed listingId);
    event Bought(uint256 indexed listingId, address indexed buyer);
    event Invalidated(uint256 indexed listingId, address indexed caller);

    MyNFT private nft;
    FixedPriceMarket private market;

    address private seller = address(0xA11CE);
    address private buyer = address(0xB0B);
    address private buyer2 = address(0xCAFE);
    address private other = address(0xD00D);

    uint256 private tokenId;
    uint256 private price = 1 ether;

    function setUp() public {
        // 基础场景：1 个卖家、2 个买家、1 个其他地址
        nft = new MyNFT("MyNFT", "MNFT");
        market = new FixedPriceMarket(address(nft));

        vm.deal(seller, 10 ether);
        vm.deal(buyer, 10 ether);
        vm.deal(buyer2, 10 ether);
        vm.deal(other, 10 ether);

        vm.prank(seller);
        tokenId = nft.mint();
    }

    function testConstructorBindsNft() public view {
        // 部署时必须锁定唯一 NFT 地址
        assertEq(market.nft(), address(nft), "nft mismatch");
    }

    function testConstructorRejectsZeroNft() public {
        vm.expectRevert(bytes("nft=0"));
        new FixedPriceMarket(address(0));
    }

    function testListAndBuy() public {
        // 完整成交闭环：上架 -> 购买 -> 资产与资金结算
        uint256 listingId = _listAsSeller(tokenId, price);
        uint256 sellerBalBefore = seller.balance;

        vm.prank(buyer);
        market.buy{value: price}(listingId);

        assertEq(nft.ownerOf(tokenId), buyer, "owner not updated");
        assertEq(seller.balance, sellerBalBefore + price, "seller not paid");

        (,,, bool active) = market.listings(listingId);
        assertTrue(!active, "listing still active");
        assertEq(market.activeListingByToken(tokenId), 0, "active listing token not cleared");
    }

    function testListPriceZeroReverts() public {
        vm.prank(seller);
        nft.approve(address(market), tokenId);

        vm.prank(seller);
        vm.expectRevert(bytes("price=0"));
        market.list(tokenId, 0);
    }

    function testListNotOwnerReverts() public {
        vm.prank(buyer);
        vm.expectRevert(bytes("not owner"));
        market.list(tokenId, price);
    }

    function testListRequiresApproval() public {
        vm.prank(seller);
        vm.expectRevert(bytes("not approved"));
        market.list(tokenId, price);
    }

    function testListRejectDuplicate() public {
        // 同一 token 不允许重复有效挂单
        _listAsSeller(tokenId, price);

        vm.prank(seller);
        vm.expectRevert(bytes("already listed"));
        market.list(tokenId, price);
    }

    function testCancel() public {
        uint256 listingId = _listAsSeller(tokenId, price);

        vm.prank(seller);
        market.cancel(listingId);

        (,,, bool active) = market.listings(listingId);
        assertTrue(!active, "cancel failed");
        assertEq(market.activeListingByToken(tokenId), 0, "active listing token not cleared");
    }

    function testOnlySellerCanCancel() public {
        // 撤单权限仅属于卖家本人
        uint256 listingId = _listAsSeller(tokenId, price);

        vm.prank(buyer);
        vm.expectRevert(bytes("not seller"));
        market.cancel(listingId);
    }

    function testCancelInactiveReverts() public {
        uint256 listingId = _listAsSeller(tokenId, price);

        vm.prank(seller);
        market.cancel(listingId);

        vm.prank(seller);
        vm.expectRevert(bytes("inactive"));
        market.cancel(listingId);
    }

    function testBuyWrongPriceReverts() public {
        uint256 listingId = _listAsSeller(tokenId, price);

        vm.prank(buyer);
        vm.expectRevert(bytes("bad price"));
        market.buy{value: price - 1}(listingId);
    }

    function testBuySelfBuyReverts() public {
        // 禁止自买，避免刷量和无意义成交
        uint256 listingId = _listAsSeller(tokenId, price);

        vm.prank(seller);
        vm.expectRevert(bytes("self buy"));
        market.buy{value: price}(listingId);
    }

    function testBuyStaleOwnerReverts() public {
        // 非托管挂单：卖家转走 NFT 后，成交必须失败
        uint256 listingId = _listAsSeller(tokenId, price);

        vm.prank(seller);
        nft.transferFrom(seller, other, tokenId);

        vm.prank(buyer);
        vm.expectRevert(bytes("stale owner"));
        market.buy{value: price}(listingId);
    }

    function testBuyStaleApprovalReverts() public {
        // 卖家撤销授权后，挂单也应视为失效
        uint256 listingId = _listAsSeller(tokenId, price);

        vm.prank(seller);
        nft.approve(address(0), tokenId);

        vm.prank(buyer);
        vm.expectRevert(bytes("stale approval"));
        market.buy{value: price}(listingId);
    }

    function testInvalidateStaleOwner() public {
        // 任意地址可触发失效清理，减少脏挂单长期存在
        uint256 listingId = _listAsSeller(tokenId, price);

        vm.prank(seller);
        nft.transferFrom(seller, other, tokenId);

        vm.expectEmit(true, true, false, true);
        emit Invalidated(listingId, buyer);
        vm.prank(buyer);
        market.invalidate(listingId);

        (,,, bool active) = market.listings(listingId);
        assertTrue(!active, "invalidate failed");
        assertEq(market.activeListingByToken(tokenId), 0, "active listing token not cleared");
    }

    function testInvalidateStaleApproval() public {
        uint256 listingId = _listAsSeller(tokenId, price);

        vm.prank(seller);
        nft.approve(address(0), tokenId);

        vm.prank(other);
        market.invalidate(listingId);

        (,,, bool active) = market.listings(listingId);
        assertTrue(!active, "invalidate failed");
    }

    function testInvalidateStillValidReverts() public {
        // 仍有效的挂单不允许被误清理
        uint256 listingId = _listAsSeller(tokenId, price);

        vm.prank(other);
        vm.expectRevert(bytes("still valid"));
        market.invalidate(listingId);
    }

    function testIsListingValid() public {
        uint256 listingId = _listAsSeller(tokenId, price);
        assertTrue(market.isListingValid(listingId), "listing should be valid");

        vm.prank(seller);
        nft.transferFrom(seller, other, tokenId);

        assertTrue(!market.isListingValid(listingId), "listing should be invalid");
    }

    function testSecondarySaleFlow() public {
        // 二次售卖链路：A 买入 -> A 再上架 -> B 买入
        uint256 listingId1 = _listAsSeller(tokenId, price);

        vm.prank(buyer);
        market.buy{value: price}(listingId1);
        assertEq(nft.ownerOf(tokenId), buyer, "buyer should own token");

        vm.prank(buyer);
        nft.approve(address(market), tokenId);
        vm.prank(buyer);
        uint256 listingId2 = market.list(tokenId, price / 2);

        vm.prank(buyer2);
        market.buy{value: price / 2}(listingId2);

        assertEq(nft.ownerOf(tokenId), buyer2, "buyer2 should own token");
    }

    function testListEmitsEvent() public {
        vm.prank(seller);
        nft.approve(address(market), tokenId);

        uint256 listingId = market.nextListingId();
        vm.expectEmit(true, true, true, true);
        emit Listed(listingId, seller, tokenId, price);

        vm.prank(seller);
        market.list(tokenId, price);
    }

    function testCancelEmitsEvent() public {
        uint256 listingId = _listAsSeller(tokenId, price);

        vm.expectEmit(true, false, false, true);
        emit Cancelled(listingId);
        vm.prank(seller);
        market.cancel(listingId);
    }

    function testBuyEmitsEvent() public {
        uint256 listingId = _listAsSeller(tokenId, price);

        vm.expectEmit(true, true, false, true);
        emit Bought(listingId, buyer);
        vm.prank(buyer);
        market.buy{value: price}(listingId);
    }

    function testListReturnsNotApprovedWhenGetApprovedReverts() public {
        // 防御性分支：第三方 NFT 合约异常 revert 时应安全失败
        MockERC721ForMarket mock = new MockERC721ForMarket();
        FixedPriceMarket localMarket = new FixedPriceMarket(address(mock));
        uint256 localTokenId = 1;

        mock.mint(seller, localTokenId);
        mock.setRevertGetApproved(true);

        vm.prank(seller);
        vm.expectRevert(bytes("not approved"));
        localMarket.list(localTokenId, price);
    }

    function testListReturnsNotApprovedWhenIsApprovedForAllReverts() public {
        MockERC721ForMarket mock = new MockERC721ForMarket();
        FixedPriceMarket localMarket = new FixedPriceMarket(address(mock));
        uint256 localTokenId = 2;

        mock.mint(seller, localTokenId);
        mock.setRevertIsApprovedForAll(true);

        vm.prank(seller);
        vm.expectRevert(bytes("not approved"));
        localMarket.list(localTokenId, price);
    }

    function testIsListingValidFalseWhenOwnerOfReverts() public {
        // ownerOf 异常时，isListingValid 应返回 false 而非直接崩溃
        MockERC721ForMarket mock = new MockERC721ForMarket();
        FixedPriceMarket localMarket = new FixedPriceMarket(address(mock));
        uint256 localTokenId = 3;

        mock.mint(seller, localTokenId);
        vm.prank(seller);
        mock.approve(address(localMarket), localTokenId);
        vm.prank(seller);
        uint256 listingId = localMarket.list(localTokenId, price);

        mock.setRevertOwnerOf(true);
        assertTrue(!localMarket.isListingValid(listingId), "listing should be invalid when ownerOf reverts");
    }

    function _listAsSeller(uint256 listTokenId, uint256 listPrice) internal returns (uint256) {
        // 辅助函数：统一“授权 + 挂单”准备步骤
        vm.prank(seller);
        nft.approve(address(market), listTokenId);

        vm.prank(seller);
        return market.list(listTokenId, listPrice);
    }
}

contract MockERC721ForMarket is IERC721 {
    mapping(uint256 => address) private _owners;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    mapping(address => uint256) private _balances;

    bool private _revertOwnerOf;
    bool private _revertGetApproved;
    bool private _revertIsApprovedForAll;

    function setRevertOwnerOf(bool value) external {
        _revertOwnerOf = value;
    }

    function setRevertGetApproved(bool value) external {
        _revertGetApproved = value;
    }

    function setRevertIsApprovedForAll(bool value) external {
        _revertIsApprovedForAll = value;
    }

    function mint(address to, uint256 tokenId) external {
        require(to != address(0), "mint to zero");
        require(_owners[tokenId] == address(0), "already minted");

        _owners[tokenId] = to;
        _balances[to] += 1;
        emit Transfer(address(0), to, tokenId);
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IERC721).interfaceId || interfaceId == type(IERC165).interfaceId;
    }

    function balanceOf(address owner) external view returns (uint256) {
        require(owner != address(0), "zero owner");
        return _balances[owner];
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        // 用于覆盖 market 的 try/catch 分支
        if (_revertOwnerOf) {
            revert("ownerOf reverted");
        }
        address owner = _owners[tokenId];
        require(owner != address(0), "not minted");
        return owner;
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        transferFrom(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata) external {
        transferFrom(from, to, tokenId);
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        address owner = ownerOf(tokenId);
        require(owner == from, "bad from");
        require(to != address(0), "bad to");
        require(_isApprovedOrOwner(msg.sender, tokenId), "not approved");

        _tokenApprovals[tokenId] = address(0);
        _owners[tokenId] = to;
        _balances[from] -= 1;
        _balances[to] += 1;
        emit Transfer(from, to, tokenId);
    }

    function approve(address to, uint256 tokenId) external {
        address owner = ownerOf(tokenId);
        require(msg.sender == owner || _operatorApprovals[owner][msg.sender], "not auth");
        _tokenApprovals[tokenId] = to;
        emit Approval(owner, to, tokenId);
    }

    function getApproved(uint256 tokenId) external view returns (address) {
        // 用于模拟 getApproved 异常分支
        if (_revertGetApproved) {
            revert("getApproved reverted");
        }
        require(_owners[tokenId] != address(0), "not minted");
        return _tokenApprovals[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) external {
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function isApprovedForAll(address owner, address operator) external view returns (bool) {
        // 用于模拟 isApprovedForAll 异常分支
        if (_revertIsApprovedForAll) {
            revert("isApprovedForAll reverted");
        }
        return _operatorApprovals[owner][operator];
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId) private view returns (bool) {
        address owner = _owners[tokenId];
        return spender == owner || _tokenApprovals[tokenId] == spender || _operatorApprovals[owner][spender];
    }
}
