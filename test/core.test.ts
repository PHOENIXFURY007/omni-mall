import assert from "node:assert/strict";
import test from "node:test";

import { previewMerchantAdapters, validateMerchantMappings } from "../src/core/adapters.js";
import { searchProducts, exploreSimilarProducts } from "../src/core/catalog.js";
import { compareProducts } from "../src/core/compare.js";
import { createCheckoutLink } from "../src/core/checkout.js";

test("searches across merchants and returns normalized products", () => {
  const result = searchProducts({ query: "beauty sunscreen sensitive", limit: 4, requireInStock: true });

  assert.equal(result.type, "product_search");
  assert.ok(result.items.length > 0);
  assert.ok(result.items.every((product) => product.stockStatus === "in_stock"));
  assert.equal(result.apiMeta.demonstrationPlatform, "chatgpt_apps_sdk");
});

test("recovers from zero-result queries with fallback products", () => {
  const result = searchProducts({ query: "nonexistent-specialized-query", merchantIds: ["daiso"], domain: "digital" });

  assert.equal(result.zeroResult.occurred, true);
  assert.equal(result.zeroResult.recovered, true);
  assert.ok(result.items.length > 0);
});

test("infers simple price constraints from natural language queries", () => {
  const result = searchProducts({ query: "sensitive sunscreen under 30000", limit: 5, requireInStock: true });

  assert.ok(result.items.length > 0);
  assert.ok(result.items.every((product) => product.price <= 30000));
});

test("explores product graph from a seed product", () => {
  const search = searchProducts({ query: "green tea cream", limit: 1 });
  const result = exploreSimilarProducts(search.items[0]!.productId, 5);

  assert.equal(result.type, "similar_products");
  assert.ok(result.seed);
  assert.ok(result.graph.length > 0);
});

test("compares selected products", () => {
  const search = searchProducts({ query: "beauty", limit: 3 });
  const result = compareProducts(search.items.slice(0, 2).map((product) => product.productId));

  assert.equal(result.products.length, 2);
  assert.ok(result.comparisonRows.some((row) => row.label === "Price"));
});

test("requires confirmation before checkout handoff", () => {
  const search = searchProducts({ query: "earbuds", limit: 1 });
  const preview = createCheckoutLink(search.items[0]!.productId, false);
  const confirmed = createCheckoutLink(search.items[0]!.productId, true);

  assert.equal(preview.requiresConfirmation, true);
  assert.equal(confirmed.requiresConfirmation, false);
  assert.ok(confirmed.checkoutUrl);
});

test("validates sample merchant adapters", () => {
  const preview = previewMerchantAdapters();
  const validation = validateMerchantMappings();

  assert.equal(preview.coverage.merchantCount, 10);
  assert.ok(validation.results.every((result) => result.ok));
});
