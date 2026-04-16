import { formatEth } from "@/lib/utils";
import type { MarketplaceProduct, SampleProductRecord } from "@/types/domain";

export function buildMarketplaceProduct(
  sample: SampleProductRecord,
  chainState?: Partial<Pick<MarketplaceProduct, "priceWei" | "stock" | "active" | "metadataURI">>
): MarketplaceProduct {
  const priceWei = chainState?.priceWei ?? BigInt(sample.priceWei);

  return {
    productId: sample.productIdBytes32,
    productIdLabel: sample.productIdLabel,
    priceWei,
    stock: chainState?.stock ?? sample.stock,
    active: chainState?.active ?? sample.active,
    metadataURI: chainState?.metadataURI ?? sample.metadataURI,
    displayName: sample.name,
    displayPrice: formatEth(priceWei),
    imageSrc: sample.imageSrc,
    imageAlt: `${sample.name} 产品图`,
    category: sample.category,
    description: sample.description
  };
}

export function getPreferredPurchasableProduct(products: MarketplaceProduct[]) {
  return products.find((product) => product.active && product.stock > 0) ?? null;
}
