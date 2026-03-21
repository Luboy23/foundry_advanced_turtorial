import {
  decodeEventLog,
  parseAbiItem,
  type Address,
  type TransactionReceipt,
} from "viem";

type TransferRecord = {
  // Token 标准：用于前端按协议展示。
  standard: "erc20" | "erc721" | "erc1155";
  // 事件发出的 token 合约地址。
  tokenAddress: string;
  fromAddress: string | null;
  toAddress: string | null;
  // ERC721 / ERC1155 使用 tokenId。
  tokenId: string | null;
  // ERC20 / ERC1155 使用 value。
  value: string | null;
};

const ERC20_OR_721_TRANSFER = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

const ERC1155_TRANSFER_SINGLE = parseAbiItem(
  "event TransferSingle(address indexed operator,address indexed from,address indexed to,uint256 id,uint256 value)"
);

const ERC1155_TRANSFER_BATCH = parseAbiItem(
  "event TransferBatch(address indexed operator,address indexed from,address indexed to,uint256[] ids,uint256[] values)"
);

/**
 * 解码 ERC20 / ERC721 `Transfer`。
 * 通过 topic/data 形态区分 ERC20 与 ERC721。
 */
const decodeErc20Or721Transfer = (log: TransactionReceipt["logs"][number]): TransferRecord | null => {
  try {
    const decoded = decodeEventLog({
      abi: [ERC20_OR_721_TRANSFER],
      data: log.data,
      topics: log.topics as any,
      strict: false,
    });
    if (decoded.eventName !== "Transfer") return null;
    const args = decoded.args as { from: Address; to: Address; value: bigint };
    const isErc721 = log.topics.length >= 4 && (log.data === "0x" || log.data === "0x0");
    return {
      standard: isErc721 ? "erc721" : "erc20",
      tokenAddress: log.address,
      fromAddress: args.from ?? null,
      toAddress: args.to ?? null,
      tokenId: isErc721 ? args.value?.toString() ?? null : null,
      value: isErc721 ? null : args.value?.toString() ?? null,
    };
  } catch {
    return null;
  }
};

/**
 * 解码 ERC1155 `TransferSingle`。
 */
const decodeErc1155Single = (log: TransactionReceipt["logs"][number]): TransferRecord | null => {
  try {
    const decoded = decodeEventLog({
      abi: [ERC1155_TRANSFER_SINGLE],
      data: log.data,
      topics: log.topics as any,
      strict: false,
    });
    if (decoded.eventName !== "TransferSingle") return null;
    const args = decoded.args as {
      from: Address;
      to: Address;
      id: bigint;
      value: bigint;
    };
    return {
      standard: "erc1155",
      tokenAddress: log.address,
      fromAddress: args.from ?? null,
      toAddress: args.to ?? null,
      tokenId: args.id?.toString() ?? null,
      value: args.value?.toString() ?? null,
    };
  } catch {
    return null;
  }
};

/**
 * 解码 ERC1155 `TransferBatch` 并展开成多条记录。
 */
const decodeErc1155Batch = (log: TransactionReceipt["logs"][number]): TransferRecord[] => {
  try {
    const decoded = decodeEventLog({
      abi: [ERC1155_TRANSFER_BATCH],
      data: log.data,
      topics: log.topics as any,
      strict: false,
    });
    if (decoded.eventName !== "TransferBatch") return [];
    const args = decoded.args as {
      from: Address;
      to: Address;
      ids: bigint[];
      values: bigint[];
    };
    const records: TransferRecord[] = [];
    const count = Math.min(args.ids.length, args.values.length);
    for (let i = 0; i < count; i += 1) {
      records.push({
        standard: "erc1155",
        tokenAddress: log.address,
        fromAddress: args.from ?? null,
        toAddress: args.to ?? null,
        tokenId: args.ids[i]?.toString() ?? null,
        value: args.values[i]?.toString() ?? null,
      });
    }
    return records;
  } catch {
    return [];
  }
};

/**
 * 统一提取 token transfer：
 * 1) 先尝试 ERC20/721；
 * 2) 再尝试 ERC1155 single；
 * 3) 最后尝试 ERC1155 batch。
 */
export const extractTokenTransfers = (log: TransactionReceipt["logs"][number]) => {
  const erc20Or721 = decodeErc20Or721Transfer(log);
  if (erc20Or721) return [erc20Or721];
  const erc1155Single = decodeErc1155Single(log);
  if (erc1155Single) return [erc1155Single];
  return decodeErc1155Batch(log);
};
