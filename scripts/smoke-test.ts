import assert from "node:assert/strict";

import { previewMerchantAdapters, validateMerchantMappings } from "../src/core/adapters.js";
import { searchProducts, exploreSimilarProducts } from "../src/core/catalog.js";
import { compareProducts } from "../src/core/compare.js";
import { createCheckoutLink } from "../src/core/checkout.js";

const search = searchProducts({ query: "sensitive sunscreen under 30000", limit: 3, requireInStock: true });
assert.equal(search.type, "product_search");
assert.ok(search.items.length > 0, "search should return products");

const similar = exploreSimilarProducts(search.items[0]!.productId, 3);
assert.equal(similar.type, "similar_products");
assert.ok(similar.items.length > 0, "similar exploration should return graph products");

const compare = compareProducts(search.items.slice(0, 2).map((product) => product.productId));
assert.equal(compare.type, "product_comparison");
assert.ok(compare.comparisonRows.length > 0, "comparison should include rows");

const checkoutPreview = createCheckoutLink(search.items[0]!.productId, false);
assert.equal(checkoutPreview.requiresConfirmation, true);

const checkout = createCheckoutLink(search.items[0]!.productId, true);
assert.equal(checkout.ok, true);
assert.ok(checkout.checkoutUrl, "confirmed checkout should return a URL");

const adapters = previewMerchantAdapters();
assert.equal(adapters.coverage.merchantCount, 8);

const validation = validateMerchantMappings();
assert.ok(validation.results.every((result) => result.ok), "sample merchant mappings should validate");

console.log("OmniMall smoke test passed");
