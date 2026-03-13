// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {MyNFT} from "../src/MyNFT.sol";
import {TestBase} from "./TestBase.sol";

contract MyNFTTest is TestBase {
    MyNFT private nft;
    address private minter = address(0xA11CE);

    function setUp() public {
        // 每个测试用例重建新合约，避免 tokenId 递增影响断言
        nft = new MyNFT("LuLuNFT", "LULU");
    }

    function testOwnerAndContractURI() public view {
        // 部署者应自动成为 owner，且 contractURI 默认为空
        assertEq(nft.owner(), address(this), "owner mismatch");
        assertEq(
            keccak256(bytes(nft.contractURI())),
            keccak256(bytes("")),
            "contractURI should be empty"
        );
    }

    function testSetContractURI() public {
        nft.setContractURI("ipfs://contract-metadata");
        assertEq(
            keccak256(bytes(nft.contractURI())),
            keccak256(bytes("ipfs://contract-metadata")),
            "contractURI mismatch"
        );
    }

    function testSetContractURIOnlyOwner() public {
        // 权限边界：非 owner 不可改合约级元数据
        vm.prank(minter);
        vm.expectRevert(bytes("only owner"));
        nft.setContractURI("ipfs://contract-metadata");
    }

    function testMint() public {
        vm.prank(minter);
        uint256 tokenId = nft.mint();

        assertEq(nft.ownerOf(tokenId), minter, "owner mismatch");
    }

    function testMintWithURI() public {
        // mintWithURI 需同时验证 owner 与 tokenURI 绑定
        vm.prank(minter);
        uint256 tokenId = nft.mintWithURI("ipfs://cid-1");

        assertEq(nft.ownerOf(tokenId), minter, "owner mismatch");
        assertEq(
            keccak256(bytes(nft.tokenURI(tokenId))),
            keccak256(bytes("ipfs://cid-1")),
            "tokenURI mismatch"
        );
    }

    function testMintBatchWithURI() public {
        // 批量铸造至少校验数量与每个 token 的归属
        string[] memory uris = new string[](2);
        uris[0] = "ipfs://cid-1";
        uris[1] = "ipfs://cid-2";

        vm.prank(minter);
        uint256[] memory tokenIds = nft.mintBatchWithURI(uris);

        assertEq(tokenIds.length, 2, "batch size mismatch");
        assertEq(nft.ownerOf(tokenIds[0]), minter, "owner mismatch 0");
        assertEq(nft.ownerOf(tokenIds[1]), minter, "owner mismatch 1");
    }

    function testMintBatchEmptyReverts() public {
        // 空数组应回滚，防止无意义交易
        string[] memory uris = new string[](0);
        vm.prank(minter);
        vm.expectRevert(bytes("empty"));
        nft.mintBatchWithURI(uris);
    }

    function testMintBatchAtMax() public {
        // 上限边界（MAX_BATCH）应允许通过
        uint256 maxBatch = nft.MAX_BATCH();
        string[] memory uris = new string[](maxBatch);
        for (uint256 i = 0; i < uris.length; i++) {
            uris[i] = "ipfs://cid";
        }

        vm.prank(minter);
        uint256[] memory tokenIds = nft.mintBatchWithURI(uris);
        assertEq(tokenIds.length, maxBatch, "batch size mismatch");
        assertEq(nft.ownerOf(tokenIds[0]), minter, "owner mismatch 0");
        assertEq(nft.ownerOf(tokenIds[maxBatch - 1]), minter, "owner mismatch last");
    }

    function testBatchLimitReverts() public {
        // 超出上限必须回滚，避免 gas 不可控
        uint256 maxBatch = nft.MAX_BATCH();
        string[] memory uris = new string[](maxBatch + 1);
        for (uint256 i = 0; i < uris.length; i++) {
            uris[i] = "ipfs://cid";
        }

        vm.prank(minter);
        vm.expectRevert(bytes("too many"));
        nft.mintBatchWithURI(uris);
    }

    function testBurnUnauthorizedReverts() public {
        // ERC721Burnable 权限校验：非 owner/approved 不能 burn
        vm.prank(minter);
        uint256 tokenId = nft.mint();

        address attacker = address(0xB0B);
        vm.prank(attacker);
        vm.expectRevert();
        nft.burn(tokenId);
    }

    function testBurn() public {
        vm.prank(minter);
        uint256 tokenId = nft.mintWithURI("ipfs://cid-3");

        vm.prank(minter);
        nft.burn(tokenId);

        vm.expectRevert();
        nft.ownerOf(tokenId);
    }

    function testSupportsInterface() public view{
        // 接口支持声明是前端/市场兼容性的基础
        assertTrue(nft.supportsInterface(0x80ac58cd), "ERC721 not supported");
        assertTrue(nft.supportsInterface(0x5b5e139f), "ERC721Metadata not supported");
        assertTrue(!nft.supportsInterface(0xffffffff), "unexpected support");
    }

    function testMintTokenUriEmpty() public {
        vm.prank(minter);
        uint256 tokenId = nft.mint();
        string memory uri = nft.tokenURI(tokenId);
        assertEq(keccak256(bytes(uri)), keccak256(bytes("")), "tokenURI should be empty");
    }

    function testFuzzMintBatchWithURI(uint8 countSeed) public {
        // fuzz 覆盖 1..MAX_BATCH 区间的批量铸造
        uint256 maxBatch = nft.MAX_BATCH();
        uint256 count = _bound(countSeed, 1, maxBatch);
        string[] memory uris = new string[](count);
        for (uint256 i = 0; i < count; i++) {
            uris[i] = "ipfs://cid";
        }

        vm.prank(minter);
        uint256[] memory tokenIds = nft.mintBatchWithURI(uris);
        assertEq(tokenIds.length, count, "batch size mismatch");
        assertEq(nft.ownerOf(tokenIds[0]), minter, "owner mismatch");
    }

    function testFuzzMintWithURI(bytes32 seed) public {
        // fuzz 覆盖不同 URI 输入，验证 tokenURI 持久化一致性
        string memory uri = string(abi.encodePacked("ipfs://", seed));
        if (bytes(uri).length > 64) return;
        vm.prank(minter);
        uint256 tokenId = nft.mintWithURI(uri);
        assertEq(keccak256(bytes(nft.tokenURI(tokenId))), keccak256(bytes(uri)), "tokenURI mismatch");
    }

    function _bound(uint256 value, uint256 min, uint256 max) internal pure returns (uint256) {
        if (value < min) return min;
        if (value > max) return max;
        return value;
    }
}
