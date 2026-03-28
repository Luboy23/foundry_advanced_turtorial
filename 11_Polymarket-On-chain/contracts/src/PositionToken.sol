// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "openzeppelin-contracts/access/Ownable.sol";
import {ERC1155} from "openzeppelin-contracts/token/ERC1155/ERC1155.sol";

/// @title PositionToken
/// @notice 预测事件头寸代币（ERC1155），由核心合约统一铸造与销毁。
contract PositionToken is ERC1155, Ownable {
    /// @notice 核心业务合约地址（唯一可执行 mint/burn）。
    address public core;

    /// @notice 核心合约地址更新事件。
    /// @param previousCore 更新前地址。
    /// @param newCore 更新后地址。
    event CoreUpdated(address indexed previousCore, address indexed newCore);

    /// @notice 仅允许核心合约调用。
    modifier onlyCore() {
        require(msg.sender == core, "ONLY_CORE");
        _;
    }

    /// @notice 初始化 ERC1155 基础 URI 与合约 owner。
    /// @param baseUri ERC1155 元数据基础 URI。
    constructor(string memory baseUri) ERC1155(baseUri) {}

    /// @notice 设置核心合约地址。
    /// @dev 仅 owner 可调用；禁止设置为零地址。
    /// @param newCore 新核心合约地址。
    function setCore(address newCore) external onlyOwner {
        require(newCore != address(0), "ZERO_ADDRESS");
        address previous = core;
        core = newCore;
        emit CoreUpdated(previous, newCore);
    }

    /// @notice 更新 ERC1155 基础 URI。
    /// @param newUri 新 URI。
    function setURI(string calldata newUri) external onlyOwner {
        _setURI(newUri);
    }

    /// @notice 铸造头寸代币。
    /// @dev 仅核心合约可调用。
    /// @param to 接收地址。
    /// @param tokenId 头寸 tokenId。
    /// @param amount 铸造数量（18 位精度）。
    function mint(address to, uint256 tokenId, uint256 amount) external onlyCore {
        _mint(to, tokenId, amount, "");
    }

    /// @notice 销毁头寸代币。
    /// @dev 仅核心合约可调用。
    /// @param from 被销毁地址。
    /// @param tokenId 头寸 tokenId。
    /// @param amount 销毁数量（18 位精度）。
    function burn(address from, uint256 tokenId, uint256 amount) external onlyCore {
        _burn(from, tokenId, amount);
    }
}
