// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC721} from "./interfaces/IERC721.sol";

/// @title FixedPriceMarket
/// @notice 简易 NFT 固定价格市场（挂单/取消/购买）
/// @dev 使用最小化的 nonReentrant 保护交易流程
contract FixedPriceMarket {
    /// @notice 绑定的 NFT 合约（仅支持 MyNFT）
    address public immutable nft;

    /// @notice 挂单信息
    struct Listing {
        address seller; // 卖家
        uint256 tokenId; // tokenId
        uint256 price; // 售价（wei）
        bool active; // 是否有效
    }

    /// @notice 挂单创建事件
    /// @param listingId 挂单编号
    /// @param seller 卖家地址
    /// @param tokenId tokenId
    /// @param price 售价（wei）
    event Listed(uint256 indexed listingId, address indexed seller, uint256 indexed tokenId, uint256 price);
    /// @notice 挂单取消事件
    /// @param listingId 挂单编号
    event Cancelled(uint256 indexed listingId);
    /// @notice 成交事件
    /// @param listingId 挂单编号
    /// @param buyer 买家地址
    event Bought(uint256 indexed listingId, address indexed buyer);
    /// @notice 失效挂单清理事件
    /// @param listingId 挂单编号
    /// @param caller 执行清理的地址
    event Invalidated(uint256 indexed listingId, address indexed caller);

    /// @notice 下一条挂单编号
    uint256 public nextListingId;
    /// @notice 挂单数据
    mapping(uint256 => Listing) public listings;
    /// @notice tokenId 对应的当前有效挂单（值为 listingId+1，0 表示无）
    mapping(uint256 => uint256) public activeListingByToken;

    /// @dev reentrancy lock
    uint256 private _locked = 1;

    /// @dev 简易防重入
    modifier nonReentrant() {
        require(_locked == 1, "reentrant");
        _locked = 2;
        _;
        _locked = 1;
    }

    /// @notice 初始化市场并绑定 NFT 合约
    /// @param nft_ MyNFT 合约地址
    constructor(address nft_) {
        require(nft_ != address(0), "nft=0");
        nft = nft_;
    }

    /// @notice 创建挂单（需持有并授权市场合约）
    /// @param tokenId tokenId
    /// @param price 售价（wei）
    /// @return listingId 新挂单编号
    function list(uint256 tokenId, uint256 price) external returns (uint256) {
        require(price > 0, "price=0");
        // 一个 token 同时只允许一个有效挂单，简化前端状态重建
        require(activeListingByToken[tokenId] == 0, "already listed");

        IERC721 token = IERC721(nft);
        require(token.ownerOf(tokenId) == msg.sender, "not owner");
        require(_isApproved(token, msg.sender, tokenId), "not approved");

        uint256 listingId = nextListingId++;
        listings[listingId] =
            Listing({seller: msg.sender, tokenId: tokenId, price: price, active: true});
        activeListingByToken[tokenId] = listingId + 1;

        emit Listed(listingId, msg.sender, tokenId, price);
        return listingId;
    }

    /// @notice 取消挂单（仅卖家）
    /// @param listingId 挂单编号
    function cancel(uint256 listingId) external {
        Listing storage listing = listings[listingId];
        require(listing.active, "inactive");
        require(listing.seller == msg.sender, "not seller");

        listing.active = false;
        activeListingByToken[listing.tokenId] = 0;
        emit Cancelled(listingId);
    }

    /// @notice 成交：校验价格 → 转移 NFT → 支付给卖家
    /// @param listingId 挂单编号
    function buy(uint256 listingId) external payable nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "inactive");
        require(listing.seller != msg.sender, "self buy");
        require(msg.value == listing.price, "bad price");

        IERC721 token = IERC721(nft);
        // 二次校验“所有权 + 授权”实时状态，防止非托管挂单过期后被错误成交
        (address currentOwner, bool ownerOk) = _ownerOf(token, listing.tokenId);
        require(ownerOk && currentOwner == listing.seller, "stale owner");
        require(_isApproved(token, listing.seller, listing.tokenId), "stale approval");

        // 先更新状态再外部调用，降低重入风险窗口
        listing.active = false;
        activeListingByToken[listing.tokenId] = 0;

        // 非托管成交：直接从卖家转给买家，不经过市场托管地址
        token.safeTransferFrom(listing.seller, msg.sender, listing.tokenId);

        // 将成交款直接打给卖家；无平台抽成
        (bool ok, ) = listing.seller.call{value: msg.value}("");
        require(ok, "pay failed");

        emit Bought(listingId, msg.sender);
    }

    /// @notice 清理失效挂单（挂单 NFT 已不在卖家名下或授权丢失）
    /// @param listingId 挂单编号
    function invalidate(uint256 listingId) external {
        Listing storage listing = listings[listingId];
        require(listing.active, "inactive");

        IERC721 token = IERC721(nft);
        (address currentOwner, bool ownerOk) = _ownerOf(token, listing.tokenId);
        bool ownerMismatch = !ownerOk || currentOwner != listing.seller;
        bool approvalMissing = !ownerMismatch && !_isApproved(token, listing.seller, listing.tokenId);
        // 仅在确实失效时允许清理，避免恶意方提前下架正常挂单
        require(ownerMismatch || approvalMissing, "still valid");

        listing.active = false;
        activeListingByToken[listing.tokenId] = 0;
        emit Invalidated(listingId, msg.sender);
    }

    /// @notice 检查挂单当前是否仍可成交
    /// @param listingId 挂单编号
    function isListingValid(uint256 listingId) external view returns (bool) {
        Listing storage listing = listings[listingId];
        if (!listing.active) return false;

        IERC721 token = IERC721(nft);
        (address currentOwner, bool ownerOk) = _ownerOf(token, listing.tokenId);
        if (!ownerOk || currentOwner != listing.seller) return false;
        return _isApproved(token, listing.seller, listing.tokenId);
    }

    function _isApproved(IERC721 token, address seller, uint256 tokenId) internal view returns (bool) {
        // 兼容异常 token 实现：若 getApproved revert，直接按“未授权”处理
        try token.getApproved(tokenId) returns (address approved) {
            if (approved == address(this)) {
                return true;
            }
        } catch {
            return false;
        }

        // 再检查全局授权，覆盖 approveForAll 场景
        try token.isApprovedForAll(seller, address(this)) returns (bool approvedForAll) {
            return approvedForAll;
        } catch {
            return false;
        }
    }

    function _ownerOf(IERC721 token, uint256 tokenId) internal view returns (address owner, bool ok) {
        // 将 ownerOf revert 显式转成 (address(0), false)，便于上层做统一失效判断
        try token.ownerOf(tokenId) returns (address currentOwner) {
            return (currentOwner, true);
        } catch {
            return (address(0), false);
        }
    }
}
