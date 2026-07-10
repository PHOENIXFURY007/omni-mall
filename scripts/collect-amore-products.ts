import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { requireRobotsAllowed, type RobotsSource } from "./lib/robots.js";

interface JsonLdGraph {
  "@graph"?: unknown[];
}

interface ProductJsonLd {
  "@type"?: string;
  name?: string;
  image?: string | string[];
  sku?: string;
  inLanguage?: string;
  brand?: {
    name?: string;
  };
  category?: string;
  description?: string;
  aggregateRating?: {
    ratingValue?: number | string;
    reviewCount?: number | string;
  };
  offers?: {
    price?: number | string;
    priceCurrency?: string;
    availability?: string;
    url?: string;
  };
  additionalProperties?: Array<{
    name?: string;
    value?: string;
  }>;
}

interface CollectedAmoreProduct {
  onlineProdSn: string;
  brandName: string;
  productName: string;
  imageUrl: string;
  images: string[];
  price: number;
  currency: "KRW";
  rating: number;
  reviewCount: number;
  isSoldOut: boolean;
  productUrl: string;
  category: string;
  categoryPath: string[];
  description: string;
  ingredients?: string;
  source: "amoremall-product-detail-page-jsonld";
  collectedAt: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const RAW_OUTPUT = join(repoRoot, "data", "amore-products.raw.json");
const NORMALIZED_OUTPUT = join(repoRoot, "data", "amore-products.normalized.json");
const CHECKPOINT_OUTPUT = join(repoRoot, "data", "amore-products.checkpoint.json");
const TARGET_COUNT = Number(process.env.AMORE_TARGET_COUNT ?? 500);
const START_SN = Number(process.env.AMORE_START_SN ?? 70550);
const MIN_SN = Number(process.env.AMORE_MIN_SN ?? 12000);
const CONCURRENCY = Math.max(1, Number(process.env.AMORE_CONCURRENCY ?? 6));
const REQUEST_DELAY_MS = Math.max(0, Number(process.env.AMORE_REQUEST_DELAY_MS ?? 80));
const REQUEST_TIMEOUT_MS = Math.max(1000, Number(process.env.AMORE_REQUEST_TIMEOUT_MS ?? 10000));
const USER_AGENT = "OmniMall-PoC-Collector/0.1 (+public product pages; contact: internal-poc)";
const AMORE_SOURCE: RobotsSource = {
  id: "amore-pacific",
  displayName: "Amore Mall",
  baseUrl: "https://www.amoremall.com",
  samplePaths: ["/kr/ko/product/detail?onlineProdSn=70513"],
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function absoluteImageUrl(value: string): string {
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("products/")) return `https://images-kr.amoremall.com/${value}`;
  if (value.startsWith("/")) return `https://www.amoremall.com${value}`;
  return value;
}

function numberFrom(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function extractJsonLd(html: string): JsonLdGraph | null {
  const match = html.match(/<script id="geo-structured-data" type="application\/ld\+json">(?<json>.*?)<\/script>/s);
  if (!match?.groups?.json) return null;
  try {
    return JSON.parse(decodeHtmlEntities(match.groups.json)) as JsonLdGraph;
  } catch {
    return null;
  }
}

function findKoreanProduct(graph: JsonLdGraph): ProductJsonLd | null {
  const items = graph["@graph"] ?? [];
  const product = items.find((item): item is ProductJsonLd => {
    if (typeof item !== "object" || item === null) return false;
    const record = item as ProductJsonLd;
    return record["@type"] === "Product" && record.inLanguage === "ko-KR" && Boolean(record.sku);
  });
  return product ?? null;
}

function getAdditionalProperty(product: ProductJsonLd, key: string): string | undefined {
  return product.additionalProperties?.find((property) => property.name === key)?.value;
}

function extractPriceFromHtml(html: string): number {
  const discountMatch = html.match(/priceInfo__inner-item discount[\s\S]*?<strong>(?<price>[\d,]+)<\/strong>/);
  const anyPriceInfoMatch = html.match(/priceInfo[\s\S]{0,1200}?<strong>(?<price>[\d,]+)<\/strong>[\s\S]{0,80}?원/);
  return numberFrom(discountMatch?.groups?.price ?? anyPriceInfoMatch?.groups?.price);
}

function normalizeProduct(product: ProductJsonLd, onlineProdSn: string, html: string): CollectedAmoreProduct | null {
  const imageValues = Array.isArray(product.image)
    ? product.image
    : product.image
      ? [product.image]
      : [];
  const images = imageValues.map(absoluteImageUrl).filter(Boolean);
  const price = numberFrom(product.offers?.price) || extractPriceFromHtml(html);
  const category = product.category ?? "뷰티";
  const productName = product.name?.trim();
  const brandName = product.brand?.name?.trim() ?? "AMOREPACIFIC";

  if (!productName || images.length === 0 || price <= 0) return null;

  return {
    onlineProdSn,
    brandName,
    productName,
    imageUrl: images[0]!,
    images,
    price,
    currency: "KRW",
    rating: numberFrom(product.aggregateRating?.ratingValue),
    reviewCount: Math.round(numberFrom(product.aggregateRating?.reviewCount)),
    isSoldOut: String(product.offers?.availability ?? "").toLowerCase().includes("outofstock") || /품절|일시품절/.test(html.slice(0, 120000)),
    productUrl: `https://www.amoremall.com/kr/ko/product/detail?onlineProdSn=${onlineProdSn}`,
    category,
    categoryPath: category.split(">").map((part) => part.trim()).filter(Boolean),
    description: product.description?.trim() ?? "",
    ingredients: getAdditionalProperty(product, "성분"),
    source: "amoremall-product-detail-page-jsonld",
    collectedAt: new Date().toISOString(),
  };
}

async function fetchProduct(onlineProdSn: number): Promise<CollectedAmoreProduct | null> {
  const url = `https://www.amoremall.com/kr/ko/product/detail?onlineProdSn=${onlineProdSn}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "accept": "text/html,application/xhtml+xml",
        "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "user-agent": USER_AGENT,
      },
    });
    if (!response.ok) return null;
    const html = await response.text();
    const jsonLd = extractJsonLd(html);
    if (!jsonLd) return null;
    const product = findKoreanProduct(jsonLd);
    if (!product) return null;
    return normalizeProduct(product, String(onlineProdSn), html);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function collectProducts(): Promise<CollectedAmoreProduct[]> {
  await mkdir(dirname(CHECKPOINT_OUTPUT), { recursive: true });
  const products = new Map<string, CollectedAmoreProduct>();
  let nextSn = START_SN;
  let checked = 0;
  let nextProgressAt = 250;

  while (products.size < TARGET_COUNT && nextSn >= MIN_SN) {
    const batchIds = Array.from({ length: CONCURRENCY }, () => nextSn--).filter((id) => id >= MIN_SN);
    const batch = await Promise.allSettled(batchIds.map(fetchProduct));
    checked += batchIds.length;

    for (const result of batch) {
      if (result.status === "fulfilled" && result.value) {
        products.set(result.value.onlineProdSn, result.value);
      }
    }

    if (checked >= nextProgressAt || products.size >= TARGET_COUNT) {
      console.log(`checked=${checked} collected=${products.size} currentSn=${nextSn}`);
      await writeFile(CHECKPOINT_OUTPUT, `${JSON.stringify({
        targetCount: TARGET_COUNT,
        checked,
        collected: products.size,
        currentSn: nextSn,
        checkpointAt: new Date().toISOString(),
        products: Array.from(products.values()),
      }, null, 2)}\n`, "utf8");
      nextProgressAt += 250;
    }
    await delay(REQUEST_DELAY_MS);
  }

  return Array.from(products.values()).slice(0, TARGET_COUNT);
}

function normalizeForOmniMall(products: CollectedAmoreProduct[]) {
  return products.map((product) => ({
    merchantId: "amore-pacific",
    merchantName: "Amore Pacific",
    productId: `amore-${product.onlineProdSn}`,
    sku: product.onlineProdSn,
    title: product.productName,
    brand: product.brandName,
    domain: "beauty",
    categoryPath: product.categoryPath.length ? product.categoryPath : ["Beauty"],
    attributes: {
      source: "amoremall",
      onlineProdSn: product.onlineProdSn,
      originalCategory: product.category,
      ingredients: product.ingredients ?? "",
      description: product.description,
    },
    price: product.price,
    currency: "KRW",
    stockStatus: product.isSoldOut ? "out_of_stock" : "in_stock",
    rating: product.rating,
    reviewCount: product.reviewCount,
    tags: Array.from(new Set([
      "beauty",
      "amoremall",
      product.brandName,
      ...product.categoryPath,
      ...product.productName.split(/\s+/).slice(0, 6),
    ])).filter(Boolean),
    productUrl: product.productUrl,
    checkoutUrl: product.productUrl,
    imageUrl: product.imageUrl,
    metadataQuality: product.description || product.ingredients ? 0.96 : 0.9,
    sourceUpdatedAt: product.collectedAt,
  }));
}

async function main(): Promise<void> {
  const robotsAudit = await requireRobotsAllowed(AMORE_SOURCE, "/kr/ko/product/detail?onlineProdSn=70513", USER_AGENT);
  const products = await collectProducts();
  if (products.length < TARGET_COUNT) {
    console.warn(`Only collected ${products.length} products before reaching AMORE_MIN_SN=${MIN_SN}.`);
  }
  await mkdir(dirname(RAW_OUTPUT), { recursive: true });
  await writeFile(RAW_OUTPUT, `${JSON.stringify({
    source: "amoremall public product detail pages",
    collectionPolicy: "robots.txt allows /kr/ko/product/detail pages; /kr/ko/api and search display paths were not used",
    robotsAudit,
    targetCount: TARGET_COUNT,
    count: products.length,
    collectedAt: new Date().toISOString(),
    products,
  }, null, 2)}\n`, "utf8");
  await writeFile(NORMALIZED_OUTPUT, `${JSON.stringify({
    source: "amoremall public product detail pages",
    count: products.length,
    collectedAt: new Date().toISOString(),
    products: normalizeForOmniMall(products),
  }, null, 2)}\n`, "utf8");
  console.log(`Saved ${products.length} products`);
  console.log(`Raw: ${RAW_OUTPUT}`);
  console.log(`Normalized: ${NORMALIZED_OUTPUT}`);
}

await main();
