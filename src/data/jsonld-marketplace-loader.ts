import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { Product } from "../types.js";

interface JsonLdMarketplaceDataset {
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
    },
    tags: Array.from(new Set(product.tags)).slice(0, 14),
  };
}

function loadCollectedJsonLdMarketplaceProducts(fileName: string, label: string): Product[] {
  const datasetPath = join(process.cwd(), "data", fileName);
  if (!existsSync(datasetPath)) return [];

  try {
    const dataset = JSON.parse(readFileSync(datasetPath, "utf8")) as JsonLdMarketplaceDataset;
    return dataset.products.map(compactProduct);
  } catch (error) {
    console.warn(`Failed to load collected ${label} products`, error);
    return [];
  }
}

export function loadCollectedKurlyProducts(): Product[] {
  return loadCollectedJsonLdMarketplaceProducts("kurly-products.normalized.json", "Kurly");
}

export function loadCollectedStyleKoreanProducts(): Product[] {
  return loadCollectedJsonLdMarketplaceProducts("stylekorean-products.normalized.json", "StyleKorean");
}
