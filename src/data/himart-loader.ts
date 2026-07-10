import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { Product } from "../types.js";

interface HimartDataset {
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
      description: truncate(product.attributes.description, 400),
      specs: Array.isArray(product.attributes.specs) ? product.attributes.specs.slice(0, 10) : [],
    },
    tags: Array.from(new Set(product.tags)).slice(0, 14),
  };
}

export function loadCollectedHimartProducts(): Product[] {
  const datasetPath = join(process.cwd(), "data", "lotte-himart-products.normalized.json");
  if (!existsSync(datasetPath)) return [];

  try {
    const dataset = JSON.parse(readFileSync(datasetPath, "utf8")) as HimartDataset;
    return dataset.products.map(compactProduct);
  } catch (error) {
    console.warn("Failed to load collected Lotte Hi-Mart products", error);
    return [];
  }
}
