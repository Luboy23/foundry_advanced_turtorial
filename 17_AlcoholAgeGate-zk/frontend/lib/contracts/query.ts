import type { PublicClient } from "viem";
import { unixTimestampToUtcYmd } from "@/lib/domain/age-eligibility";
import type { RuntimeConfig, Address } from "@/types/contract-config";
import type { AgeCredentialSet, EligibilityStatus, MarketplaceOrder, MarketplaceProduct, RoleStatus } from "@/types/domain";
import {
  ageCredentialRootRegistryAbi,
  alcoholAgeEligibilityVerifierAbi,
  alcoholMarketplaceAbi,
  alcoholRoleRegistryAbi
} from "@/lib/contracts/abis";

export type QueryPublicClient = Pick<
  PublicClient,
  "readContract" | "getBlock" | "getBalance" | "getContractEvents" | "getBlockNumber"
>;

function readStructValue<T>(value: unknown, key: string, index: number): T {
  const record = value as Record<string, T> & T[];
  return record?.[key] ?? record?.[index];
}

export async function readRoleStatus(
  publicClient: QueryPublicClient,
  config: RuntimeConfig,
  address: Address
): Promise<RoleStatus> {
  const [isIssuer, isBuyer, isSeller] = await Promise.all([
    publicClient.readContract({
      abi: alcoholRoleRegistryAbi,
      address: config.roleRegistryAddress,
      functionName: "isIssuer",
      args: [address]
    }) as Promise<boolean>,
    publicClient.readContract({
      abi: alcoholRoleRegistryAbi,
      address: config.roleRegistryAddress,
      functionName: "isBuyer",
      args: [address]
    }) as Promise<boolean>,
    publicClient.readContract({
      abi: alcoholRoleRegistryAbi,
      address: config.roleRegistryAddress,
      functionName: "isSeller",
      args: [address]
    }) as Promise<boolean>
  ]);

  return { isIssuer, isBuyer, isSeller };
}

export async function readCurrentCredentialSet(
  publicClient: QueryPublicClient,
  config: RuntimeConfig
): Promise<AgeCredentialSet> {
  const value = await publicClient.readContract({
    abi: ageCredentialRootRegistryAbi,
    address: config.rootRegistryAddress,
    functionName: "getCurrentCredentialSet"
  });

  return {
    setId: readStructValue<`0x${string}`>(value, "setId", 0),
    merkleRoot: BigInt(readStructValue<bigint | string>(value, "merkleRoot", 1)),
    version: Number(readStructValue<number | bigint>(value, "version", 2)),
    referenceDate: Number(readStructValue<number | bigint>(value, "referenceDate", 3)),
    issuer: readStructValue<Address>(value, "issuer", 4),
    updatedAt: Number(readStructValue<number | bigint>(value, "updatedAt", 5)),
    active: Boolean(readStructValue<boolean>(value, "active", 6))
  };
}

export async function readEligibilityStatus(
  publicClient: QueryPublicClient,
  config: RuntimeConfig,
  buyer: Address
): Promise<EligibilityStatus> {
  const [statusValue, isCurrent] = await Promise.all([
    publicClient.readContract({
      abi: alcoholAgeEligibilityVerifierAbi,
      address: config.eligibilityVerifierAddress,
      functionName: "getEligibility",
      args: [buyer]
    }),
    publicClient.readContract({
      abi: alcoholAgeEligibilityVerifierAbi,
      address: config.eligibilityVerifierAddress,
      functionName: "hasValidEligibility",
      args: [buyer]
    }) as Promise<boolean>
  ]);

  return {
    verifiedRootVersion: Number(readStructValue<number | bigint>(statusValue, "verifiedRootVersion", 0)),
    verifiedAt: Number(readStructValue<number | bigint>(statusValue, "verifiedAt", 1)),
    active: Boolean(readStructValue<boolean>(statusValue, "active", 2)),
    isCurrent
  };
}

export async function readCurrentUtcDateYmd(publicClient: QueryPublicClient) {
  const block = await publicClient.getBlock({ blockTag: "latest" });
  return unixTimestampToUtcYmd(Number(block.timestamp));
}

export async function readProduct(
  publicClient: QueryPublicClient,
  config: RuntimeConfig,
  productId: `0x${string}`
): Promise<Pick<MarketplaceProduct, "productId" | "priceWei" | "stock" | "active" | "metadataURI">> {
  const value = await publicClient.readContract({
    abi: alcoholMarketplaceAbi,
    address: config.marketplaceAddress,
    functionName: "getProduct",
    args: [productId]
  });

  return {
    productId: readStructValue<`0x${string}`>(value, "productId", 0),
    priceWei: BigInt(readStructValue<bigint | string>(value, "price", 1)),
    stock: Number(readStructValue<number | bigint>(value, "stock", 2)),
    active: Boolean(readStructValue<boolean>(value, "active", 3)),
    metadataURI: readStructValue<string>(value, "metadataURI", 4)
  };
}

export async function readPendingBalance(
  publicClient: QueryPublicClient,
  config: RuntimeConfig,
  seller: Address
) {
  const value = await publicClient.readContract({
    abi: alcoholMarketplaceAbi,
    address: config.marketplaceAddress,
    functionName: "pendingBalanceOf",
    args: [seller]
  });

  return BigInt(value as bigint | string);
}

export async function readWalletBalance(publicClient: QueryPublicClient, address: Address) {
  return publicClient.getBalance({ address });
}

export async function readBuyerOrders(
  publicClient: QueryPublicClient,
  config: RuntimeConfig,
  buyer: Address
): Promise<MarketplaceOrder[]> {
  const logs = (await publicClient.getContractEvents({
    abi: alcoholMarketplaceAbi,
    address: config.marketplaceAddress,
    eventName: "ProductPurchased",
    args: { buyer },
    fromBlock: "earliest"
  })) as Array<{
    args: {
      orderId?: `0x${string}`;
      productId?: `0x${string}`;
      buyer?: Address;
      seller?: Address;
      quantity?: number | bigint;
      totalPriceWei?: bigint | string;
    };
    transactionHash?: `0x${string}`;
    blockHash?: `0x${string}`;
  }>;

  const orders = await Promise.all(
    logs.map(async (log) => {
      if (
        !log.blockHash ||
        !log.args.orderId ||
        !log.args.productId ||
        !log.args.buyer ||
        !log.args.seller ||
        log.args.quantity === undefined ||
        log.args.totalPriceWei === undefined
      ) {
        throw new Error("订单记录暂不完整，暂时无法整理历史订单。");
      }

      const block = await publicClient.getBlock({
        blockHash: log.blockHash
      });

      return {
        orderId: log.args.orderId,
        productId: log.args.productId,
        buyer: log.args.buyer,
        seller: log.args.seller,
        quantity: Number(log.args.quantity),
        totalPriceWei: BigInt(log.args.totalPriceWei),
        purchasedAt: Number(block.timestamp),
        txHash: log.transactionHash
      };
    })
  );

  return orders.sort((left, right) => right.purchasedAt - left.purchasedAt);
}

export async function readSellerOrders(
  publicClient: QueryPublicClient,
  config: RuntimeConfig,
  seller: Address
): Promise<MarketplaceOrder[]> {
  const logs = (await publicClient.getContractEvents({
    abi: alcoholMarketplaceAbi,
    address: config.marketplaceAddress,
    eventName: "ProductPurchased",
    fromBlock: "earliest"
  })) as Array<{
    args: {
      orderId?: `0x${string}`;
      productId?: `0x${string}`;
      buyer?: Address;
      seller?: Address;
      quantity?: number | bigint;
      totalPriceWei?: bigint | string;
    };
    transactionHash?: `0x${string}`;
    blockHash?: `0x${string}`;
  }>;

  const sellerOrders = logs.filter((log) => log.args.seller?.toLowerCase() === seller.toLowerCase());

  const orders = await Promise.all(
    sellerOrders.map(async (log) => {
      if (
        !log.blockHash ||
        !log.args.orderId ||
        !log.args.productId ||
        !log.args.buyer ||
        !log.args.seller ||
        log.args.quantity === undefined ||
        log.args.totalPriceWei === undefined
      ) {
        throw new Error("购买记录暂不完整，暂时无法整理卖家历史订单。");
      }

      const block = await publicClient.getBlock({
        blockHash: log.blockHash
      });

      return {
        orderId: log.args.orderId,
        productId: log.args.productId,
        buyer: log.args.buyer,
        seller: log.args.seller,
        quantity: Number(log.args.quantity),
        totalPriceWei: BigInt(log.args.totalPriceWei),
        purchasedAt: Number(block.timestamp),
        txHash: log.transactionHash
      };
    })
  );

  return orders.sort((left, right) => right.purchasedAt - left.purchasedAt);
}
