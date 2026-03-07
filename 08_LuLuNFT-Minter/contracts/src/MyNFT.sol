// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ERC721Burnable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";

/// @title MyNFT
/// @notice 简化版 ERC721 铸造合约（支持 tokenURI 与批量铸造）
/// @dev 使用 ERC721URIStorage 管理 tokenURI
contract MyNFT is ERC721URIStorage, ERC721Burnable {
    /// @dev 下一个 tokenId
    uint256 private _nextId;
    /// @notice 批量铸造最大数量
    uint256 public constant MAX_BATCH = 20;
    /// @notice 合约管理员
    address public owner;
    /// @dev 合约级元数据 URI
    string private _contractURI;

    /// @dev 仅管理员可调用
    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    /// @notice 初始化合约名称与符号，部署者为管理员
    /// @param name_ 代币名称
    /// @param symbol_ 代币符号
    constructor(string memory name_, string memory symbol_) ERC721(name_, symbol_) {
        owner = msg.sender;
    }

    /// @notice 设置合约级元数据 URI（平台展示用）
    /// @param uri 合约级元数据地址
    function setContractURI(string calldata uri) external onlyOwner {
        _contractURI = uri;
    }

    /// @notice 获取合约级元数据 URI
    /// @return uri 合约级元数据地址
    function contractURI() external view returns (string memory) {
        return _contractURI;
    }

    /// @notice 基础铸造：仅生成 tokenId，不写入 tokenURI
    /// @return tokenId 新铸造的 tokenId
    function mint() external returns (uint256) {
        // tokenId 从 0 开始递增，便于教学中演示首个 token 的边界值处理
        uint256 tokenId = _nextId++;
        _safeMint(msg.sender, tokenId);
        return tokenId;
    }

    /// @notice 铸造并写入 tokenURI
    /// @param uri token 元数据地址
    /// @return tokenId 新铸造的 tokenId
    function mintWithURI(string calldata uri) external returns (uint256) {
        uint256 tokenId = _nextId++;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, uri);
        return tokenId;
    }

    /// @notice 批量铸造并写入 tokenURI（有限额）
    /// @param uris token 元数据地址数组
    /// @return tokenIds 新铸造的 tokenId 数组
    function mintBatchWithURI(string[] calldata uris) external returns (uint256[] memory) {
        uint256 count = uris.length;
        // 批量接口显式限制区间，避免一次交易过重导致 gas 风险
        require(count > 0, "empty");
        require(count <= MAX_BATCH, "too many");

        uint256[] memory tokenIds = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            // 批量铸造仍复用单个 token 的 mint + setTokenURI 语义，行为一致易理解
            uint256 tokenId = _nextId++;
            _safeMint(msg.sender, tokenId);
            _setTokenURI(tokenId, uris[i]);
            tokenIds[i] = tokenId;
        }

        return tokenIds;
    }

    /// @dev ERC721URIStorage 需要显式覆盖 _burn
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    /// @notice 获取 tokenURI
    /// @param tokenId tokenId
    /// @return uri token 元数据地址
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    /// @notice 查询接口支持情况
    /// @param interfaceId 接口标识
    /// @return supported 是否支持该接口
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
