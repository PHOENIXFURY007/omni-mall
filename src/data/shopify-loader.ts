import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { Product } from "../types.js";

interface ShopifyDataset {
  count: number;
  collectedAt: string;
  products: Product[];
}

function truncate(value: unknown, maxLength: number): string {
  const text = String(value ?? "");
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function compactProduct(product: Product): Product {
  return {
    ...product,
    attributes: {
      ...product.attributes,
      description: truncate(product.attributes.description, 500),
      shopifyTags: Array.isArray(product.attributes.shopifyTags)
        ? product.attributes.shopifyTags.slice(0, 12)
        : [],
    },
    tags: Array.from(new Set(product.tags)).slice(0, 14),
  };
}

function loadCollectedShopifyProducts(fileName: string, label: string): Product[] {
  const datasetPath = join(process.cwd(), "data", fileName);
  if (!existsSync(datasetPath)) return [];

  try {
    const dataset = JSON.parse(readFileSync(datasetPath, "utf8")) as ShopifyDataset;
    return dataset.products.map(compactProduct);
  } catch (error) {
    console.warn(`Failed to load collected ${label} products`, error);
    return [];
  }
}

export function loadCollectedSulwhasooProducts(): Product[] {
  return loadCollectedShopifyProducts("sulwhasoo-us-products.normalized.json", "Sulwhasoo US");
}

export function loadCollectedInnisfreeProducts(): Product[] {
  return loadCollectedShopifyProducts("innisfree-jp-products.normalized.json", "Innisfree JP");
}
