const addressPattern = /^0x[0-9a-fA-F]{40}$/;

/**
 * 解析并校验 EVM 地址环境变量。
 * 返回 `null` 表示地址缺失或格式非法，供上层统一判断配置是否完整。
 */
const parseAddress = (value: string | undefined): `0x${string}` | null => {
  const normalized = (value ?? "").trim();
  return addressPattern.test(normalized) ? (normalized as `0x${string}`) : null;
};

const rawChainId = process.env.NEXT_PUBLIC_CHAIN_ID ?? "31337";
const rawRpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545";
const rawIpfsGatewayBase = (process.env.NEXT_PUBLIC_IPFS_GATEWAY_BASE ?? "https://ipfs.io/ipfs/").trim();

/** 当前前端连接的 RPC 地址。 */
export const RPC_URL = rawRpcUrl;
/** 当前前端预期连接的链 ID。 */
export const CHAIN_ID = Number(rawChainId);
/** IPFS 网关基地址（保证以 `/` 结尾，便于拼接路径）。 */
export const IPFS_GATEWAY_BASE = rawIpfsGatewayBase.endsWith("/")
  ? rawIpfsGatewayBase
  : `${rawIpfsGatewayBase}/`;
/** 项目主页地址，用于页脚外链。 */
export const PROJECT_GITHUB =
  process.env.NEXT_PUBLIC_PROJECT_GITHUB ??
  "https://github.com/lllu23/foundry_advanced_turtorial";
/** 活动索引器地址，留空表示仅走链上日志回读。 */
export const ACTIVITY_INDEXER_URL =
  (process.env.NEXT_PUBLIC_ACTIVITY_INDEXER_URL ?? "").trim() || null;

/** EventFactory 合约地址。 */
export const EVENT_FACTORY_ADDRESS = parseAddress(process.env.NEXT_PUBLIC_EVENT_FACTORY_ADDRESS);
/** ERC1155 头寸代币合约地址。 */
export const POSITION_TOKEN_ADDRESS = parseAddress(process.env.NEXT_PUBLIC_POSITION_TOKEN_ADDRESS);
/** ETH 抵押金库合约地址。 */
export const ETH_COLLATERAL_VAULT_ADDRESS = parseAddress(process.env.NEXT_PUBLIC_ETH_COLLATERAL_VAULT_ADDRESS);
/** 预言机适配器合约地址。 */
export const ORACLE_ADAPTER_ADDRESS = parseAddress(process.env.NEXT_PUBLIC_ORACLE_ADAPTER_ADDRESS);

/** 前端运行所需的核心合约地址是否已全部配置。 */
export const IS_CONTRACT_CONFIGURED =
  EVENT_FACTORY_ADDRESS !== null &&
  POSITION_TOKEN_ADDRESS !== null &&
  ETH_COLLATERAL_VAULT_ADDRESS !== null &&
  ORACLE_ADAPTER_ADDRESS !== null;
