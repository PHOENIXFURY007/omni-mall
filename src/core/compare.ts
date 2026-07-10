import { PRODUCT_CATALOG } from "../data/catalog.js";
import type { CompareProductsResult, Product } from "../types.js";
import { createApiMeta } from "./meta.js";
import { formatCurrencyKrw } from "./text.js";

function asValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (value === undefined || value === null || value === "") return "-";
  return String(value);
}

function pickProducts(productIds: string[]): Product[] {
  const requested = new Set(productIds);
  return PRODUCT_CATALOG.filter((product) => requested.has(product.productId));
}

export function compareProducts(productIds: string[]): CompareProductsResult {
  const products = pickProducts(productIds).slice(0, 5);
  const attributeKeys = Array.from(
    new Set(products.flatMap((product) => Object.keys(product.attributes))),
  ).slice(0, 8);

  const comparisonRows = [
    {
      label: "Merchant",
      values: Object.fromEntries(products.map((product) => [product.productId, product.merchantName])),
    },
    {
      label: "Brand",
      values: Object.fromEntries(products.map((product) => [product.productId, product.brand])),
    },
    {
      label: "Price",
      values: Object.fromEntries(products.map((product) => [product.productId, formatCurrencyKrw(product.price)])),
    },
    {
      label: "Stock",
      values: Object.fromEntries(products.map((product) => [product.productId, product.stockStatus.replace(/_/g, " ")])),
    },
    {
      label: "Rating",
      values: Object.fromEntries(products.map((product) => [product.productId, `${product.rating.toFixed(1)} (${product.reviewCount})`])),
    },
    ...attributeKeys.map((key) => ({
      label: key,
      values: Object.fromEntries(products.map((product) => [product.productId, asValue(product.attributes[key])])),
    })),
  ];

  const cheapest = [...products].sort((left, right) => left.price - right.price)[0];
  const highestRated = [...products].sort((left, right) => right.rating - left.rating)[0];
  const bestMetadata = [...products].sort((left, right) => right.metadataQuality - left.metadataQuality)[0];

  return {
    type: "product_comparison",
    products,
    comparisonRows,
    bestFor: [
      ...(cheapest ? [{ productId: cheapest.productId, label: "value", reason: `${cheapest.title} has the lowest listed price.` }] : []),
      ...(highestRated ? [{ productId: highestRated.productId, label: "social proof", reason: `${highestRated.title} has the strongest rating signal.` }] : []),
      ...(bestMetadata ? [{ productId: bestMetadata.productId, label: "metadata quality", reason: `${bestMetadata.title} has the most complete normalized attributes.` }] : []),
    ],
    apiMeta: createApiMeta("public_product"),
  };
}
