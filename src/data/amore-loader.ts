import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { Product } from "../types.js";

interface AmoreDataset {
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
      ingredients: truncate(product.attributes.ingredients, 700),
    },
    tags: Array.from(new Set(product.tags)).slice(0, 14),
  };
}

export function loadCollectedAmoreProducts(): Product[] {
  const datasetPath = join(process.cwd(), "data", "amore-products.normalized.json");
  if (!existsSync(datasetPath)) return [];

  try {
    const dataset = JSON.parse(readFileSync(datasetPath, "utf8")) as AmoreDataset;
    return dataset.products.map(compactProduct);
  } catch (error) {
    console.warn("Failed to load collected Amore products", error);
    return [];
  }
}
