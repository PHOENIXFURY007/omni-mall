import { PRODUCT_CATALOG } from "../data/catalog.js";
import type {
  MerchantId,
  Product,
  ProductGraphEdge,
  RankedProduct,
  SearchProductsInput,
  SearchProductsResult,
  SimilarProductsResult,
} from "../types.js";
import { createApiMeta, P95_TARGET_MS } from "./meta.js";
import { normalizeText, tokenize } from "./text.js";

const QUERY_SYNONYMS: Record<string, string[]> = {
  sunscreen: ["spf", "sun", "uv"],
  spf: ["sunscreen", "sun", "uv"],
  skincare: ["skin", "beauty", "serum", "cream"],
  makeup: ["beauty", "foundation", "cushion"],
  gift: ["present", "premium", "giftbox"],
  toy: ["kids", "blocks", "play"],
  kitchen: ["cookware", "home", "living"],
  home: ["living", "storage", "diffuser"],
  cheap: ["budget", "value", "daiso"],
  value: ["budget", "cheap"],
};

function nowMs(): number {
  return Date.now();
}

function clampLimit(limit: number | undefined, fallback: number, max: number): number {
  if (!Number.isFinite(limit)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(Number(limit))));
}

function parsePriceNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function inferMaxPrice(query: string): number | undefined {
  const englishMatch = query.match(/(?:under|below|less than|max|up to)\s*(\d[\d,]*)/i);
  const koreanMatch = query.match(/(\d[\d,]*)\s*(?:\uC6D0|krw)?\s*(?:\uC774\uD558|\uBBF8\uB9CC|\uC544\uB798)/iu);
  return parsePriceNumber(englishMatch?.[1]) ?? parsePriceNumber(koreanMatch?.[1]);
}

function expandTerms(terms: string[]): string[] {
  const expanded = new Set<string>(terms);
  for (const term of terms) {
    for (const synonym of QUERY_SYNONYMS[term] ?? []) {
      expanded.add(synonym);
    }
  }
  return Array.from(expanded);
}

function productSearchText(product: Product): string {
  return normalizeText([
    product.title,
    product.brand,
    product.merchantName,
    product.domain,
    product.categoryPath.join(" "),
    product.tags.join(" "),
    Object.values(product.attributes).flat().join(" "),
  ].join(" "));
}

function merchantAliasText(product: Product): string {
  return normalizeText(`${product.merchantName} ${product.merchantId.replace(/-/g, " ")}`);
}

function rankProduct(product: Product, query: string, terms: string[], baseBoost = 0): RankedProduct {
  const text = productSearchText(product);
  const normalizedQuery = normalizeText(query);
  const title = normalizeText(product.title);
  const brand = normalizeText(product.brand);
  const merchantText = merchantAliasText(product);
  const scoreBreakdown: Record<string, number> = {
    token: 0,
    phrase: 0,
    merchant: 0,
    stock: 0,
    quality: Math.round(product.metadataQuality * 10),
    rating: Math.max(0, product.rating - 4) * 2,
    base: baseBoost,
  };
  const why: string[] = [];

  for (const term of terms) {
    if (text.includes(term)) scoreBreakdown.token += 8;
    if (title.includes(term)) scoreBreakdown.token += 4;
    if (brand.includes(term)) scoreBreakdown.token += 3;
    if (merchantText.includes(term)) scoreBreakdown.merchant += 8;
  }

  if (normalizedQuery && title.includes(normalizedQuery)) {
    scoreBreakdown.phrase += 16;
    why.push("title phrase match");
  }
  if (scoreBreakdown.token > 0) why.push("matched product attributes");
  if (scoreBreakdown.merchant > 0) why.push("matched merchant intent");

  if (product.stockStatus === "in_stock") {
    scoreBreakdown.stock += 4;
    why.push("available now");
  } else if (product.stockStatus === "low_stock") {
    scoreBreakdown.stock += 2;
    why.push("low stock");
  }

  if (product.metadataQuality >= 0.9) {
    why.push("high metadata quality");
  }

  const score = Object.values(scoreBreakdown).reduce((sum, value) => sum + value, 0);
  return {
    ...product,
    score: Number(score.toFixed(2)),
    scoreBreakdown,
    why: why.slice(0, 4),
  };
}

function matchesHardFilters(product: Product, input: SearchProductsInput): boolean {
  if (input.merchantIds?.length && !input.merchantIds.includes(product.merchantId)) return false;
  if (input.domain && normalizeText(product.domain) !== normalizeText(input.domain)) return false;
  if (typeof input.maxPrice === "number" && product.price > input.maxPrice) return false;
  if (input.requireInStock && product.stockStatus !== "in_stock") return false;
  return true;
}

function sortRanked(items: RankedProduct[]): RankedProduct[] {
  return [...items].sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    if (right.rating !== left.rating) return right.rating - left.rating;
    return left.price - right.price;
  });
}

function inferEdgeRelation(seed: Product, target: Product): ProductGraphEdge["relation"] {
  if (seed.domain !== target.domain) return "complement";
  if (seed.merchantId !== target.merchantId) return "substitute";
  return "similar";
}

function edgeWeight(left: Product, right: Product): number {
  const sharedTags = left.tags.filter((tag) => right.tags.includes(tag)).length;
  const sharedCategory = left.categoryPath.filter((part) => right.categoryPath.includes(part)).length;
  const sameDomain = left.domain === right.domain ? 3 : 0;
  const priceRatio = Math.min(left.price, right.price) / Math.max(left.price, right.price);
  return Number(Math.min(1, ((sharedTags * 0.16) + (sharedCategory * 0.12) + (sameDomain * 0.12) + (priceRatio * 0.24))).toFixed(2));
}

export function findProduct(productId: string): Product | undefined {
  return PRODUCT_CATALOG.find((product) => product.productId === productId);
}

export function buildGraph(seedProductIds: string[], limit = 12): ProductGraphEdge[] {
  const seeds = PRODUCT_CATALOG.filter((product) => seedProductIds.includes(product.productId));
  const edges: ProductGraphEdge[] = [];

  for (const seed of seeds) {
    for (const target of PRODUCT_CATALOG) {
      if (seed.productId === target.productId) continue;
      const weight = edgeWeight(seed, target);
      if (weight < 0.26) continue;
      const sharedTags = seed.tags.filter((tag) => target.tags.includes(tag));
      edges.push({
        sourceProductId: seed.productId,
        targetProductId: target.productId,
        relation: inferEdgeRelation(seed, target),
        weight,
        reason: sharedTags.length
          ? `shared tags: ${sharedTags.slice(0, 3).join(", ")}`
          : `shared domain: ${seed.domain}`,
      });
    }
  }

  return edges
    .sort((left, right) => right.weight - left.weight)
    .slice(0, limit);
}

export function searchProducts(input: SearchProductsInput): SearchProductsResult {
  const startedAt = nowMs();
  const effectiveInput = {
    ...input,
    maxPrice: input.maxPrice ?? inferMaxPrice(input.query),
  };
  const limit = clampLimit(input.limit, 5, 12);
  const rawTerms = tokenize(input.query);
  const terms = expandTerms(rawTerms);
  const candidates = PRODUCT_CATALOG.filter((product) => matchesHardFilters(product, effectiveInput));
  let zeroResult = {
    occurred: false,
    recovered: false,
    relaxedConstraints: [] as string[],
    message: "Matched products with current constraints.",
  };

  let ranked = sortRanked(
    candidates
      .map((product) => rankProduct(product, input.query, terms))
      .filter((product) => terms.length === 0 || product.scoreBreakdown.token > 0 || product.scoreBreakdown.phrase > 0 || product.scoreBreakdown.merchant > 0),
  );

  if (ranked.length === 0) {
    zeroResult = {
      occurred: true,
      recovered: true,
      relaxedConstraints: ["merchant", "domain", "price", "exact token match"],
      message: "No exact match under the requested constraints. Showing high-confidence alternatives across merchants.",
    };
    ranked = sortRanked(
      PRODUCT_CATALOG
        .filter((product) => product.stockStatus !== "out_of_stock")
        .map((product) => rankProduct(product, input.query, terms, 6)),
    );
  }

  const items = ranked.slice(0, limit);
  const durationMs = nowMs() - startedAt;

  return {
    type: "product_search",
    query: input.query,
    items,
    graph: buildGraph(items.map((product) => product.productId), 10),
    zeroResult,
    metrics: {
      durationMs,
      resultCount: items.length,
      p95TargetMs: P95_TARGET_MS,
    },
    apiMeta: createApiMeta("public_product"),
  };
}

export function exploreSimilarProducts(productId: string, limitInput?: number): SimilarProductsResult {
  const startedAt = nowMs();
  const limit = clampLimit(limitInput, 6, 10);
  const seed = findProduct(productId) ?? null;

  if (!seed) {
    return {
      type: "similar_products",
      seed: null,
      items: [],
      graph: [],
      metrics: {
        durationMs: nowMs() - startedAt,
        resultCount: 0,
        p95TargetMs: P95_TARGET_MS,
      },
      apiMeta: createApiMeta("public_product"),
    };
  }

  const graph = buildGraph([seed.productId], 24);
  const graphBoostByProductId = new Map<string, number>();
  for (const edge of graph) {
    graphBoostByProductId.set(edge.targetProductId, Math.max(graphBoostByProductId.get(edge.targetProductId) ?? 0, edge.weight * 20));
  }

  const ranked = sortRanked(
    PRODUCT_CATALOG
      .filter((product) => product.productId !== seed.productId)
      .map((product) => rankProduct(product, `${seed.title} ${seed.tags.join(" ")}`, tokenize(`${seed.title} ${seed.tags.join(" ")}`), graphBoostByProductId.get(product.productId) ?? 0))
      .filter((product) => graphBoostByProductId.has(product.productId) || product.domain === seed.domain),
  ).slice(0, limit);

  return {
    type: "similar_products",
    seed,
    items: ranked.slice(0, limit),
    graph: graph.slice(0, 10),
    metrics: {
      durationMs: nowMs() - startedAt,
      resultCount: ranked.length,
      p95TargetMs: P95_TARGET_MS,
    },
    apiMeta: createApiMeta("public_product"),
  };
}

export function listDomains(): string[] {
  return Array.from(new Set(PRODUCT_CATALOG.map((product) => product.domain))).sort();
}

export function listMerchantIds(): MerchantId[] {
  return Array.from(new Set(PRODUCT_CATALOG.map((product) => product.merchantId)));
}
