// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { IAlcoholRoleRegistry } from "./interfaces/IAlcoholRoleRegistry.sol";

/// @title 酒水平台角色注册合约
/// @notice 统一维护签发机构、买家和卖家的链上白名单。
contract AlcoholRoleRegistry is IAlcoholRoleRegistry {
    error ZeroAddress();
    error Unauthorized(address caller);

    address private s_issuer;
    address private s_seller;
    mapping(address => bool) private s_buyers;

    event IssuerUpdated(address indexed issuer);
    event BuyerUpdated(address indexed buyer, bool active);
    event SellerUpdated(address indexed seller, bool active);

    constructor(address initialIssuer) {
        if (initialIssuer == address(0)) {
            revert ZeroAddress();
        }

        s_issuer = initialIssuer;
        emit IssuerUpdated(initialIssuer);
    }

    modifier onlyIssuer() {
        if (msg.sender != s_issuer) {
            revert Unauthorized(msg.sender);
        }
        _;
    }

    function getIssuer() external view returns (address) {
        return s_issuer;
    }

    function getSeller() external view returns (address) {
        return s_seller;
    }

    function isIssuer(address account) external view returns (bool) {
        return account == s_issuer;
    }

    function isBuyer(address account) external view returns (bool) {
        return s_buyers[account];
    }

    function isSeller(address account) external view returns (bool) {
        return account != address(0) && account == s_seller;
    }

    function isWhitelisted(address account) external view returns (bool) {
        return account == s_issuer || account == s_seller || s_buyers[account];
    }

    function setIssuer(address nextIssuer) external onlyIssuer {
        if (nextIssuer == address(0)) {
            revert ZeroAddress();
        }

        s_issuer = nextIssuer;
        emit IssuerUpdated(nextIssuer);
    }

    function setBuyer(address buyer, bool active) external onlyIssuer {
        if (buyer == address(0)) {
            revert ZeroAddress();
        }

        s_buyers[buyer] = active;
        emit BuyerUpdated(buyer, active);
    }

    function setBuyers(address[] calldata buyers, bool active) external onlyIssuer {
        // 批量 buyer 更新主要服务于发行方发布身份集合后的白名单同步，
        // 这样前端不用为每个新地址分别发一笔交易。
        for (uint256 index = 0; index < buyers.length; index += 1) {
            address buyer = buyers[index];
            if (buyer == address(0)) {
                revert ZeroAddress();
            }

            s_buyers[buyer] = active;
            emit BuyerUpdated(buyer, active);
        }
    }

    function setSeller(address seller, bool active) external onlyIssuer {
        if (active && seller == address(0)) {
            revert ZeroAddress();
        }

        s_seller = active ? seller : address(0);
        emit SellerUpdated(s_seller, active);
    }
}
