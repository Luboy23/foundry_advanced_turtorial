import type { Abi } from "viem";

export const NFT_ADDRESS =
  process.env.NEXT_PUBLIC_NFT_ADDRESS ?? "";
export const MARKET_ADDRESS =
  process.env.NEXT_PUBLIC_MARKET_ADDRESS ?? "";

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545";

export const NFT_CONTRACT_READY =
  NFT_ADDRESS.length > 0;
export const MARKET_CONTRACT_READY =
  MARKET_ADDRESS.length > 0;
export const CONTRACTS_READY = NFT_CONTRACT_READY;
export const MARKET_FEATURE_READY =
  NFT_CONTRACT_READY && MARKET_CONTRACT_READY;

export const MAX_BATCH = 20;

export const nftAbi = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{ name: "tokenId", type: "uint256" }]
  },
  {
    type: "function",
    name: "mintWithURI",
    stateMutability: "nonpayable",
    inputs: [
      { name: "uri", type: "string" }
    ],
    outputs: [{ name: "tokenId", type: "uint256" }]
  },
  {
    type: "function",
    name: "mintBatchWithURI",
    stateMutability: "nonpayable",
    inputs: [
      { name: "uris", type: "string[]" }
    ],
    outputs: [{ name: "tokenIds", type: "uint256[]" }]
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "setApprovalForAll",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }]
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "owner", type: "address" }]
  },
  {
    type: "function",
    name: "getApproved",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "approved", type: "address" }]
  },
  {
    type: "function",
    name: "isApprovedForAll",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "operator", type: "address" }
    ],
    outputs: [{ name: "approved", type: "bool" }]
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "uri", type: "string" }]
  },
  {
    type: "function",
    name: "burn",
    stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: []
  }
] as const satisfies Abi;

export const marketAbi = [
  {
    type: "function",
    name: "nft",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }]
  },
  {
    type: "function",
    name: "nextListingId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "list",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "price", type: "uint256" }
    ],
    outputs: [{ name: "listingId", type: "uint256" }]
  },
  {
    type: "function",
    name: "cancel",
    stateMutability: "nonpayable",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "buy",
    stateMutability: "payable",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "invalidate",
    stateMutability: "nonpayable",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "isListingValid",
    stateMutability: "view",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    type: "function",
    name: "activeListingByToken",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "listings",
    stateMutability: "view",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [
      { name: "seller", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "price", type: "uint256" },
      { name: "active", type: "bool" }
    ]
  }
] as const satisfies Abi;
