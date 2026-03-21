import {
  toEventSelector,
  toFunctionSelector,
  type Abi,
  type AbiEvent,
  type AbiFunction,
  type Hex,
} from "viem";

export type NamedAbi = { name: string; abi: Abi };

const LULUCOIN_ABI = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "initialOwner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "_name",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "_symbol",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "allowance",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "spender",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "approve",
    "inputs": [
      {
        "name": "spender",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "value",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "balanceOf",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "burn",
    "inputs": [
      {
        "name": "_amount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "decimals",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "mint",
    "inputs": [
      {
        "name": "_amount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "name",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "renounceOwnership",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "symbol",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "totalSupply",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "transfer",
    "inputs": [
      {
        "name": "to",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "value",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "transferFrom",
    "inputs": [
      {
        "name": "from",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "to",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "value",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "transferOwnership",
    "inputs": [
      {
        "name": "newOwner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "Approval",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "spender",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "value",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Burn",
    "inputs": [
      {
        "name": "amount",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Mint",
    "inputs": [
      {
        "name": "amount",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OwnershipTransferred",
    "inputs": [
      {
        "name": "previousOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Transfer",
    "inputs": [
      {
        "name": "from",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "to",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "value",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "ERC20InsufficientAllowance",
    "inputs": [
      {
        "name": "spender",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "allowance",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "needed",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC20InsufficientBalance",
    "inputs": [
      {
        "name": "sender",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "balance",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "needed",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC20InvalidApprover",
    "inputs": [
      {
        "name": "approver",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC20InvalidReceiver",
    "inputs": [
      {
        "name": "receiver",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC20InvalidSender",
    "inputs": [
      {
        "name": "sender",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC20InvalidSpender",
    "inputs": [
      {
        "name": "spender",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "OwnableInvalidOwner",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "OwnableUnauthorizedAccount",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ]
  }
] as const;

const LLC_FAUCET_ABI = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "_tokenAddress",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_dripInterval",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_dripLimit",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_owner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "deposit",
    "inputs": [
      {
        "name": "_amount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "drip",
    "inputs": [
      {
        "name": "_amount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "dripInterval",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "dripLimit",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getDripInterval",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getDripLimit",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getDripTime",
    "inputs": [
      {
        "name": "_user",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "renounceOwnership",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setDripInterval",
    "inputs": [
      {
        "name": "_newDripInterval",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setDripLimit",
    "inputs": [
      {
        "name": "_newDripLimit",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setTokenAddress",
    "inputs": [
      {
        "name": "_newTokenAddress",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "token",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IERC20"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "tokenAddress",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "transferOwnership",
    "inputs": [
      {
        "name": "newOwner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "LLCFaucet__Drip",
    "inputs": [
      {
        "name": "Receiver",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "Amount",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "LLCFaucet__OwnerDeposit",
    "inputs": [
      {
        "name": "amount",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OwnershipTransferred",
    "inputs": [
      {
        "name": "previousOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "LLCFaucet__ExceedLimit",
    "inputs": []
  },
  {
    "type": "error",
    "name": "LLCFaucet__FaucetEmpty",
    "inputs": []
  },
  {
    "type": "error",
    "name": "LLCFaucet__IntervalHasNotPassed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "LLCFaucet__InvalidAmount",
    "inputs": []
  },
  {
    "type": "error",
    "name": "OwnableInvalidOwner",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "OwnableUnauthorizedAccount",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "SafeERC20FailedOperation",
    "inputs": [
      {
        "name": "token",
        "type": "address",
        "internalType": "address"
      }
    ]
  }
] as const;

const FLAPPY_SCORE_ABI = [
  {
    "type": "function",
    "name": "MAX_LEADERBOARD",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "bestScore",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getLeaderboard",
    "inputs": [],
    "outputs": [
      {
        "name": "players",
        "type": "address[]",
        "internalType": "address[]"
      },
      {
        "name": "scores",
        "type": "uint256[]",
        "internalType": "uint256[]"
      },
      {
        "name": "timestamps",
        "type": "uint256[]",
        "internalType": "uint256[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "leaderboardLength",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "submitScore",
    "inputs": [
      {
        "name": "score",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "ScoreSubmitted",
    "inputs": [
      {
        "name": "player",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "score",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "timestamp",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "isBest",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      }
    ],
    "anonymous": false
  }
] as const;

const SNAKE_SCOREBOARD_ABI = [
  {
    type: 'function',
    name: 'submitScore',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'score', type: 'uint32' },
      { name: 'maxCombo', type: 'uint16' },
      { name: 'durationSec', type: 'uint32' },
      { name: 'speedPeak', type: 'uint16' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getGlobalTop',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        components: [
          { name: 'player', type: 'address' },
          { name: 'score', type: 'uint32' },
          { name: 'maxCombo', type: 'uint16' },
          { name: 'durationSec', type: 'uint32' },
          { name: 'speedPeak', type: 'uint16' },
          { name: 'timestamp', type: 'uint64' },
          { name: 'seq', type: 'uint64' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'getUserRecent',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        components: [
          { name: 'player', type: 'address' },
          { name: 'score', type: 'uint32' },
          { name: 'maxCombo', type: 'uint16' },
          { name: 'durationSec', type: 'uint32' },
          { name: 'speedPeak', type: 'uint16' },
          { name: 'timestamp', type: 'uint64' },
          { name: 'seq', type: 'uint64' },
        ],
      },
    ],
  },
] as const;

const SCORE_2048_ABI = [
  {
    type: "function",
    name: "submitScore",
    inputs: [
      { name: "score", type: "uint64" },
      { name: "duration", type: "uint32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getLeaderboard",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "player", type: "address" },
          { name: "score", type: "uint64" },
          { name: "duration", type: "uint32" },
          { name: "timestamp", type: "uint64" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getPlayerHistory",
    inputs: [
      { name: "player", type: "address" },
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "player", type: "address" },
          { name: "score", type: "uint64" },
          { name: "duration", type: "uint32" },
          { name: "timestamp", type: "uint64" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getPlayerHistoryCount",
    inputs: [{ name: "player", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "bestScores",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint64" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "leaderboardLength",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "MAX_LEADERBOARD",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "ScoreSubmitted",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "score", type: "uint64", indexed: false },
      { name: "duration", type: "uint32", indexed: false },
      { name: "previousBest", type: "uint64", indexed: false },
      { name: "isNewBest", type: "bool", indexed: false },
    ],
    anonymous: false,
  },
] as const;

const LIGHTS_OUT_ABI = [
  {
    type: "event",
    name: "ResultSubmitted",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "gridSize", type: "uint8", indexed: true },
      { name: "density", type: "uint8", indexed: true },
      { name: "moves", type: "uint32", indexed: false },
      { name: "durationMs", type: "uint32", indexed: false },
      { name: "finishedAt", type: "uint64", indexed: false },
      { name: "usedHint", type: "bool", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "function",
    name: "submitResult",
    stateMutability: "nonpayable",
    inputs: [
      { name: "gridSize", type: "uint8" },
      { name: "density", type: "uint8" },
      { name: "moves", type: "uint32" },
      { name: "durationMs", type: "uint32" },
      { name: "usedHint", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getLatest",
    stateMutability: "view",
    inputs: [{ name: "player", type: "address" }],
    outputs: [
      { name: "player", type: "address" },
      { name: "gridSize", type: "uint8" },
      { name: "density", type: "uint8" },
      { name: "moves", type: "uint32" },
      { name: "durationMs", type: "uint32" },
      { name: "finishedAt", type: "uint64" },
      { name: "usedHint", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "getBest",
    stateMutability: "view",
    inputs: [
      { name: "player", type: "address" },
      { name: "gridSize", type: "uint8" },
      { name: "density", type: "uint8" },
    ],
    outputs: [
      { name: "player", type: "address" },
      { name: "gridSize", type: "uint8" },
      { name: "density", type: "uint8" },
      { name: "moves", type: "uint32" },
      { name: "durationMs", type: "uint32" },
      { name: "finishedAt", type: "uint64" },
      { name: "usedHint", type: "bool" },
    ],
  },
] as const;

const LULU_NFT_ABI = [
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
] as const;

const BOOK_REGISTRY_ABI = [
  {
    type: "function",
    name: "registerBook",
    stateMutability: "nonpayable",
    inputs: [
      { name: "contentHash", type: "bytes32" },
      { name: "metaHash", type: "bytes32" },
      { name: "policyHash", type: "bytes32" },
    ],
    outputs: [{ name: "bookId", type: "uint256" }],
  },
  {
    type: "function",
    name: "registerBooks",
    stateMutability: "nonpayable",
    inputs: [
      { name: "contentHashes", type: "bytes32[]" },
      { name: "metaHashes", type: "bytes32[]" },
      { name: "policyHashes", type: "bytes32[]" },
    ],
    outputs: [{ name: "bookIds", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "updateBook",
    stateMutability: "nonpayable",
    inputs: [
      { name: "bookId", type: "uint256" },
      { name: "contentHash", type: "bytes32" },
      { name: "metaHash", type: "bytes32" },
      { name: "policyHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setBookActive",
    stateMutability: "nonpayable",
    inputs: [
      { name: "bookId", type: "uint256" },
      { name: "active", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getBook",
    stateMutability: "view",
    inputs: [{ name: "bookId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "contentHash", type: "bytes32" },
          { name: "metaHash", type: "bytes32" },
          { name: "policyHash", type: "bytes32" },
          { name: "registrar", type: "address" },
          { name: "active", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getBookCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "updateBorrowRoot",
    stateMutability: "nonpayable",
    inputs: [
      { name: "proof", type: "bytes" },
      { name: "newRoot", type: "bytes32" },
      { name: "batchSize", type: "uint256" },
      { name: "batchCommitment", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "borrowRoot",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "operators",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "borrowEpoch",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "borrowCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "verifier",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "setVerifier",
    stateMutability: "nonpayable",
    inputs: [{ name: "verifierAddress", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getBorrowBatch",
    stateMutability: "view",
    inputs: [{ name: "epoch", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "root", type: "bytes32" },
          { name: "batchCommitment", type: "bytes32" },
          { name: "timestamp", type: "uint64" },
          { name: "operator", type: "address" },
          { name: "batchSize", type: "uint256" },
          { name: "startIndex", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "BORROW_BATCH_SIZE",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "BORROW_TREE_DEPTH",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const ABI_REGISTRY: NamedAbi[] = [
  { name: "01_Erc20 LuLuCoin", abi: LULUCOIN_ABI as Abi },
  { name: "02_Faucet LLCFaucet", abi: LLC_FAUCET_ABI as Abi },
  { name: "04_FlappyBird Score", abi: FLAPPY_SCORE_ABI as Abi },
  { name: "05_SnakeGame Scoreboard", abi: SNAKE_SCOREBOARD_ABI as Abi },
  { name: "06_2048Game Score", abi: SCORE_2048_ABI as Abi },
  { name: "07_LightOut Results", abi: LIGHTS_OUT_ABI as Abi },
  { name: "08_LuLuNFT", abi: LULU_NFT_ABI as Abi },
  { name: "09_BookManagement Registry", abi: BOOK_REGISTRY_ABI as Abi },
];

// 仅保留 ABI 数组本身，供简单 decode 场景使用。
export const BUILTIN_ABIS = ABI_REGISTRY.map((item) => item.abi);

/**
 * 生成函数签名字符串（如 `transfer(address,uint256)`）。
 */
const buildFunctionSignature = (item: AbiFunction) => {
  const argTypes = item.inputs.map((input) => input.type).join(",");
  return `${item.name}(${argTypes})`;
};

/**
 * 生成事件签名字符串（如 `Transfer(address,address,uint256)`）。
 */
const buildEventSignature = (item: AbiEvent) => {
  const argTypes = item.inputs.map((input) => input.type).join(",");
  return `${item.name}(${argTypes})`;
};

/**
 * 向索引表追加 ABI 项，自动去重同名来源。
 */
const pushIndexValue = (map: Map<string, NamedAbi[]>, key: string, value: NamedAbi) => {
  const bucket = map.get(key);
  if (!bucket) {
    map.set(key, [value]);
    return;
  }
  if (!bucket.some((entry) => entry.name === value.name)) {
    bucket.push(value);
  }
};

/**
 * 构建 selector/topic -> ABI 的倒排索引。
 * 用于交易方法与日志事件的快速解码。
 */
const buildSelectorIndexes = (registry: NamedAbi[]) => {
  const functionSelectors = new Map<string, NamedAbi[]>();
  const eventTopics = new Map<string, NamedAbi[]>();

  for (const entry of registry) {
    for (const item of entry.abi) {
      if (item.type === "function" && item.name) {
        const selector = toFunctionSelector(buildFunctionSignature(item as AbiFunction)).toLowerCase();
        pushIndexValue(functionSelectors, selector, entry);
      }
      if (item.type === "event" && item.name && !item.anonymous) {
        const topic0 = toEventSelector(buildEventSignature(item as AbiEvent)).toLowerCase();
        pushIndexValue(eventTopics, topic0 as Hex, entry);
      }
    }
  }

  return { functionSelectors, eventTopics };
};

const selectorIndexes = buildSelectorIndexes(ABI_REGISTRY);

// 函数 selector 索引：`0xa9059cbb` -> 可能匹配的 ABI 列表。
export const FUNCTION_SELECTOR_INDEX = selectorIndexes.functionSelectors;
// 事件 topic0 索引：`0xddf252ad...` -> 可能匹配的 ABI 列表。
export const EVENT_TOPIC_INDEX = selectorIndexes.eventTopics;
