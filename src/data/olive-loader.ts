import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { Product } from "../types.js";

interface OliveDataset {
  count: number;
  collectedAt: string;
  products: Product[];
}

function compactProduct(product: Product): Product {
  return {
    ...product,
    attributes: {
      ...product.attributes,
      keyIngredients: Array.isArray(product.attributes.keyIngredients)
        ? product.attributes.keyIngredients.slice(0, 12)
        : [],
      useCases: Array.isArray(product.attributes.useCases) ? product.attributes.useCases.slice(0, 8) : [],
      skinConcerns: Array.isArray(product.attributes.skinConcerns) ? product.attributes.skinConcerns.slice(0, 8) : [],
    },
    tags: Array.from(new Set(product.tags)).slice(0, 14),
  };
}

export function loadCollectedOliveYoungProducts(): Product[] {
  const datasetPath = join(process.cwd(), "data", "olive-young-products.normalized.json");
  if (!existsSync(datasetPath)) return [];

  try {
    const dataset = JSON.parse(readFileSync(datasetPath, "utf8")) as OliveDataset;
    return dataset.products.map(compactProduct);
  } catch (error) {
    console.warn("Failed to load collected Olive Young products", error);
    return [];
  }
}
