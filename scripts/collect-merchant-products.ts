import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import type { Product } from "../src/types.js";
import { MERCHANT_COLLECTION_SOURCES, type MerchantCollectionSource } from "./lib/merchant-sources.js";
import {
  auditRobotsSource,
  DEFAULT_COLLECTOR_USER_AGENT,
  type RobotsAuditResult,
  type RobotsPathDecision,
} from "./lib/robots.js";

interface OlivePocProduct {
  prdt_no?: string;
  goods_no?: string;
  name?: string;
  brand?: string;
  category?: string;
  category_leaf?: string;
  price_usd?: number;
  image_url?: string;
  product_url?: string;
  review_count?: number;
  avg_rating?: number;
  key_ingredients?: string[];
  use_cases?: string[];
  skin_concerns?: string[];
  curate_queries?: string[];
}

interface OlivePublicRawProduct {
  prdtNo: string;
  productUrl: string;
  collectedAt: string;
  product: Record<string, unknown>;
}

interface OlivePageContext {
  csrfHeader?: string;
  csrfToken?: string;
}

interface HimartRawProduct {
  goodsNo: string;
  productUrl: string;
  collectedAt: string;
  imageUrl?: string;
  product: Record<string, unknown>;
}

interface CollectionResult {
  sourceId: string;
  status: "collected" | "skipped" | "failed";
  rawOutput?: string;
  normalizedOutput?: string;
  count: number;
  targetCount?: number;
  reason?: string;
}

type OliveSourceMode = "auto" | "local" | "public";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const dataDir = join(repoRoot, "data");
const runDir = join(dataDir, "collection-runs");
const statusOutput = join(dataDir, "merchant-collection-status.json");
const manifestOutput = join(dataDir, "merchant-product-manifest.json");
const MERCHANT_TARGET_COUNT = Math.max(1, Number(process.env.MERCHANT_TARGET_COUNT ?? 500));
const REQUESTED_MERCHANTS = new Set(
  String(process.env.COLLECT_MERCHANTS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const OLIVE_SOURCE_DIR = process.env.OLIVE_POC_DATA_DIR
  ?? join(repoRoot, "..", "olive-poc", "data", "catalog100-3.31");
const OLIVE_SOURCE_FILE = join(OLIVE_SOURCE_DIR, "master_products.json");
const OLIVE_RAW_OUTPUT = join(dataDir, "olive-young-products.raw.json");
const OLIVE_NORMALIZED_OUTPUT = join(dataDir, "olive-young-products.normalized.json");
const OLIVE_BASE_URL = "https://global.oliveyoung.com";
const OLIVE_PRODUCT_SITEMAP_URL = `${OLIVE_BASE_URL}/sitemapindex-product.xml`;
const OLIVE_DETAIL_DATA_URL = `${OLIVE_BASE_URL}/product/detail-data`;
const OLIVE_TARGET_COUNT = Math.max(1, Number(process.env.OLIVE_TARGET_COUNT ?? MERCHANT_TARGET_COUNT));
const OLIVE_SOURCE_MODE = (process.env.OLIVE_SOURCE_MODE ?? "auto") as OliveSourceMode;
const OLIVE_RESPECT_ROBOTS_DELAY = process.env.OLIVE_RESPECT_ROBOTS_DELAY !== "0";
const OLIVE_REQUEST_DELAY_MS = Math.max(0, Number(process.env.OLIVE_REQUEST_DELAY_MS ?? 0));
const HIMART_BASE_URL = "https://www.e-himart.co.kr";
const HIMART_SITEMAP_URL = `${HIMART_BASE_URL}/sitemap.xml`;
const HIMART_RAW_OUTPUT = join(dataDir, "lotte-himart-products.raw.json");
const HIMART_NORMALIZED_OUTPUT = join(dataDir, "lotte-himart-products.normalized.json");
const HIMART_TARGET_COUNT = Math.max(1, Number(process.env.HIMART_TARGET_COUNT ?? MERCHANT_TARGET_COUNT));
const HIMART_REQUEST_DELAY_MS = Math.max(0, Number(process.env.HIMART_REQUEST_DELAY_MS ?? 150));
const NETWORK_RETRY_ATTEMPTS = Math.max(1, Number(process.env.COLLECT_NETWORK_RETRY_ATTEMPTS ?? 5));
const NETWORK_RETRY_BASE_MS = Math.max(250, Number(process.env.COLLECT_NETWORK_RETRY_BASE_MS ?? 5000));
const USD_KRW_RATE = Number(process.env.OLIVE_USD_KRW_RATE ?? 1350);

function compactIsoForFilename(value: string): string {
  return value.replace(/[:.]/g, "-");
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function numberFrom(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringFrom(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function splitCategory(category: string | undefined, fallback: string | undefined): string[] {
  const parts = String(category || fallback || "Beauty")
    .split(">")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? parts : ["Beauty"];
}

function cleanTags(values: Array<unknown>): string[] {
  return Array.from(new Set(
    values
      .flatMap((value) => Array.isArray(value) ? value : [value])
      .map((value) => String(value ?? "").trim())
      .filter(Boolean),
  )).slice(0, 18);
}

function normalizeOliveProduct(product: OlivePocProduct, collectedAt: string): Product | null {
  const sku = product.prdt_no || product.goods_no;
  const title = product.name?.trim();
  const brand = product.brand?.trim() || "Olive Young";
  const priceUsd = numberFrom(product.price_usd);
  const productUrl = product.product_url?.trim();
  const categoryPath = splitCategory(product.category, product.category_leaf);

  if (!sku || !title || !productUrl || priceUsd <= 0) return null;

  const priceKrw = Math.max(1000, Math.round((priceUsd * USD_KRW_RATE) / 10) * 10);
  const keyIngredients = Array.isArray(product.key_ingredients) ? product.key_ingredients : [];
  const useCases = Array.isArray(product.use_cases) ? product.use_cases : [];
  const skinConcerns = Array.isArray(product.skin_concerns) ? product.skin_concerns : [];

  return {
    merchantId: "olive-young",
    merchantName: "Olive Young",
    productId: `olive-${sku}`,
    sku,
    title,
    brand,
    domain: "beauty",
    categoryPath,
    attributes: {
      source: "olive-poc",
      originalCurrency: "USD",
      originalPriceUsd: priceUsd,
      exchangeRateUsdKrw: USD_KRW_RATE,
      categoryLeaf: product.category_leaf ?? categoryPath.at(-1) ?? "",
      keyIngredients,
      useCases,
      skinConcerns,
      curateQueries: Array.isArray(product.curate_queries) ? product.curate_queries : [],
    },
    price: priceKrw,
    currency: "KRW",
    stockStatus: "in_stock",
    rating: numberFrom(product.avg_rating),
    reviewCount: Math.round(numberFrom(product.review_count)),
    tags: cleanTags([
      "beauty",
      "oliveyoung",
      brand,
      ...categoryPath,
      ...useCases,
      ...skinConcerns,
      ...title.split(/\s+/).slice(0, 6),
    ]),
    productUrl,
    checkoutUrl: productUrl,
    imageUrl: product.image_url,
    metadataQuality: keyIngredients.length ? 0.94 : 0.88,
    sourceUpdatedAt: collectedAt,
  };
}

function robotsProductDetailDecision(audit: RobotsAuditResult | undefined): RobotsPathDecision | undefined {
  return audit?.decisions.find((decision) => decision.path.startsWith("/product/detail"));
}

function robotsAllowsProductDetail(audit: RobotsAuditResult | undefined): boolean {
  return Boolean(audit?.ok && robotsProductDetailDecision(audit)?.allowed === true);
}

function robotsAwareDelayMs(audit: RobotsAuditResult | undefined): number {
  const crawlDelaySeconds = robotsProductDetailDecision(audit)?.crawlDelay ?? 0;
  const robotsDelayMs = OLIVE_RESPECT_ROBOTS_DELAY ? crawlDelaySeconds * 1000 : 0;
  return Math.max(robotsDelayMs, OLIVE_REQUEST_DELAY_MS);
}

function absoluteOliveImageUrl(value: unknown): string | undefined {
  const imagePath = stringFrom(value);
  if (!imagePath) return undefined;
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  if (imagePath.startsWith("//")) return `https:${imagePath}`;
  const cleanPath = imagePath.replace(/^\/+/, "");
  return `https://cdn-image.oliveyoung.com/${cleanPath}`;
}

function publicOliveCategoryPath(product: Record<string, unknown>): string[] {
  const englishPath = decodeHtmlEntities(stringFrom(product.allPathCtgrNameEn));
  const categoryPath = englishPath
    .split(">")
    .map((part) => part.trim())
    .filter((part) => part && part.toLowerCase() !== "oliveyoungglobal");

  if (categoryPath.length) return categoryPath;

  return [
    stringFrom(product.gdsLclsNm),
    stringFrom(product.gdsMclsNm),
    stringFrom(product.gdsSclsNm),
  ].filter(Boolean);
}

function normalizeOlivePublicProduct(rawProduct: OlivePublicRawProduct, collectedAt: string): Product | null {
  const product = rawProduct.product;
  const sku = stringFrom(product.prdtNo) || rawProduct.prdtNo;
  const title = stringFrom(product.prdtNameEn) || stringFrom(product.prdtName);
  const brand = stringFrom(product.brandNameEn) || stringFrom(product.brandName) || stringFrom(product.korBrandName) || "Olive Young";
  const priceUsd = numberFrom(product.saleAmt) || numberFrom(product.nrmlAmt);
  const normalPriceUsd = numberFrom(product.nrmlAmt);
  const imageUrl = absoluteOliveImageUrl(product.imagePath);
  const categoryPath = publicOliveCategoryPath(product);

  if (!sku || !title || priceUsd <= 0) return null;

  const priceKrw = Math.max(1000, Math.round((priceUsd * USD_KRW_RATE) / 10) * 10);
  const inStock = stringFrom(product.sellStatCode) === "10" && stringFrom(product.tempOutOfStockYn) !== "Y";
  const categoryLeaf = categoryPath.at(-1) ?? "Beauty";

  return {
    merchantId: "olive-young",
    merchantName: "Olive Young",
    productId: `olive-${sku}`,
    sku,
    title,
    brand,
    domain: "beauty",
    categoryPath: categoryPath.length ? categoryPath : ["Beauty"],
    attributes: {
      source: "olive-young-public-product-api",
      originalCurrency: "USD",
      originalPriceUsd: priceUsd,
      originalNormalPriceUsd: normalPriceUsd,
      exchangeRateUsdKrw: USD_KRW_RATE,
      koreanLargeCategory: stringFrom(product.gdsLclsNm),
      koreanMiddleCategory: stringFrom(product.gdsMclsNm),
      koreanSmallCategory: stringFrom(product.gdsSclsNm),
      categoryLeaf,
      prdtNo: sku,
      saleStatusCode: stringFrom(product.sellStatCode),
      temporaryOutOfStock: stringFrom(product.tempOutOfStockYn),
    },
    price: priceKrw,
    currency: "KRW",
    stockStatus: inStock ? "in_stock" : "out_of_stock",
    rating: 0,
    reviewCount: 0,
    tags: cleanTags([
      "beauty",
      "oliveyoung",
      brand,
      ...categoryPath,
      ...title.split(/\s+/).slice(0, 8),
    ]),
    productUrl: rawProduct.productUrl,
    checkoutUrl: rawProduct.productUrl,
    imageUrl,
    metadataQuality: imageUrl && categoryPath.length > 1 ? 0.9 : 0.82,
    sourceUpdatedAt: collectedAt,
  };
}

async function readLocalOliveProducts(): Promise<OlivePocProduct[]> {
  if (!existsSync(OLIVE_SOURCE_FILE)) return [];
  return JSON.parse(await readFile(OLIVE_SOURCE_FILE, "utf8")) as OlivePocProduct[];
}

async function collectOliveYoungLocal(
  audit: RobotsAuditResult | undefined,
  collectedAt: string,
  requestedTargetCount: number,
): Promise<CollectionResult> {
  const rawProducts = await readLocalOliveProducts();
  if (!rawProducts.length) {
    return {
      sourceId: "olive-young",
      status: "failed",
      count: 0,
      targetCount: requestedTargetCount,
      reason: `Source file not found or empty: ${OLIVE_SOURCE_FILE}`,
    };
  }

  const selectedProducts = rawProducts.slice(0, requestedTargetCount);
  const normalizedProducts = selectedProducts
    .map((product) => normalizeOliveProduct(product, collectedAt))
    .filter((product): product is Product => Boolean(product));

  await writeJson(OLIVE_RAW_OUTPUT, {
    merchantId: "olive-young",
    source: "olive-poc local catalog100-3.31 master_products.json",
    sourceFile: OLIVE_SOURCE_FILE,
    sourceMode: "local",
    collectionPolicy: "Local PoC import. robots.txt checked for current public product detail URL policy before refresh.",
    robotsAudit: audit,
    targetCount: requestedTargetCount,
    availableCount: rawProducts.length,
    count: selectedProducts.length,
    collectedAt,
    products: selectedProducts,
  });
  await writeJson(OLIVE_NORMALIZED_OUTPUT, {
    merchantId: "olive-young",
    source: "olive-poc local catalog100-3.31 master_products.json",
    sourceMode: "local",
    targetCount: requestedTargetCount,
    count: normalizedProducts.length,
    collectedAt,
    products: normalizedProducts,
  });

  return {
    sourceId: "olive-young",
    status: "collected",
    count: normalizedProducts.length,
    targetCount: requestedTargetCount,
    rawOutput: OLIVE_RAW_OUTPUT,
    normalizedOutput: OLIVE_NORMALIZED_OUTPUT,
    reason: rawProducts.length < requestedTargetCount
      ? `Local olive-poc source only has ${rawProducts.length} products; use OLIVE_SOURCE_MODE=public for the 500 target.`
      : undefined,
  };
}

function extractLocValues(xml: string): string[] {
  return Array.from(xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi))
    .map((match) => decodeHtmlEntities(match[1].trim()));
}

function productNumberFromUrl(value: string): string | null {
  try {
    return new URL(value).searchParams.get("prdtNo");
  } catch {
    return null;
  }
}

async function withNetworkRetry<T>(label: string, operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= NETWORK_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= NETWORK_RETRY_ATTEMPTS) break;
      const waitMs = NETWORK_RETRY_BASE_MS * attempt;
      console.warn(`${label} failed on attempt ${attempt}/${NETWORK_RETRY_ATTEMPTS}; retrying in ${waitMs}ms: ${error instanceof Error ? error.message : String(error)}`);
      await sleep(waitMs);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function fetchText(url: string, accept = "text/plain,*/*;q=0.8"): Promise<string> {
  return withNetworkRetry(`GET ${url}`, async () => {
    const response = await fetch(url, {
      headers: {
        "user-agent": DEFAULT_COLLECTOR_USER_AGENT,
        "accept": accept,
        "accept-language": "en-US,en;q=0.9,ko;q=0.8",
      },
    });
    if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
    return response.text();
  });
}

async function fetchOliveProductUrls(targetCount: number): Promise<string[]> {
  const sitemapXml = await fetchText(OLIVE_PRODUCT_SITEMAP_URL, "application/xml,text/xml,*/*;q=0.8");
  const productUrls = extractLocValues(sitemapXml)
    .filter((url) => url.startsWith(`${OLIVE_BASE_URL}/product/detail?`))
    .filter((url) => productNumberFromUrl(url));
  return Array.from(new Set(productUrls)).slice(0, targetCount);
}

async function fetchOlivePageContext(productUrl: string): Promise<OlivePageContext> {
  const html = await fetchText(productUrl, "text/html,*/*;q=0.8");
  return {
    csrfHeader: html.match(/<meta\s+name="_csrf_header"\s+content="([^"]+)"/i)?.[1],
    csrfToken: html.match(/<meta\s+name="_csrf"\s+content="([^"]+)"/i)?.[1],
  };
}

async function fetchOliveDetailProduct(
  prdtNo: string,
  productUrl: string,
  context: OlivePageContext,
): Promise<Record<string, unknown> | null> {
  const headers: Record<string, string> = {
    "user-agent": DEFAULT_COLLECTOR_USER_AGENT,
    "accept": "application/json,text/plain,*/*",
    "accept-language": "en-US,en;q=0.9,ko;q=0.8",
    "content-type": "application/json;charset=UTF-8",
    "referer": productUrl,
    "origin": OLIVE_BASE_URL,
  };

  if (context.csrfHeader && context.csrfToken) headers[context.csrfHeader] = context.csrfToken;

  return withNetworkRetry(`POST Olive detail-data ${prdtNo}`, async () => {
    const response = await fetch(OLIVE_DETAIL_DATA_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ prdtNo }),
    });

    if (response.status >= 500 || response.status === 429) {
      throw new Error(`${OLIVE_DETAIL_DATA_URL} returned HTTP ${response.status}`);
    }
    if (!response.ok) return null;

    const body = await response.json() as { product?: Record<string, unknown> };
    return body.product && typeof body.product === "object" ? body.product : null;
  });
}

async function collectOliveYoungPublic(
  audit: RobotsAuditResult | undefined,
  collectedAt: string,
  requestedTargetCount: number,
): Promise<CollectionResult> {
  if (!robotsAllowsProductDetail(audit)) {
    return {
      sourceId: "olive-young",
      status: "skipped",
      count: 0,
      targetCount: requestedTargetCount,
      reason: "Current robots policy does not allow the sampled Olive Young product detail path for this collector.",
    };
  }

  const delayMs = robotsAwareDelayMs(audit);
  const productUrls = await fetchOliveProductUrls(requestedTargetCount * 2);
  if (!productUrls.length) {
    return {
      sourceId: "olive-young",
      status: "failed",
      count: 0,
      targetCount: requestedTargetCount,
      reason: "Olive Young product sitemap did not return product detail URLs.",
    };
  }

  const context = await fetchOlivePageContext(productUrls[0]);
  const rawProducts: OlivePublicRawProduct[] = [];
  let checked = 0;

  for (const productUrl of productUrls) {
    checked += 1;
    const prdtNo = productNumberFromUrl(productUrl);
    if (!prdtNo) continue;

    let product: Record<string, unknown> | null = null;
    try {
      product = await fetchOliveDetailProduct(prdtNo, productUrl, context);
    } catch (error) {
      console.warn(`olive-young product skipped after retries (${prdtNo}): ${error instanceof Error ? error.message : String(error)}`);
    }
    if (product) {
      rawProducts.push({
        prdtNo,
        productUrl,
        collectedAt,
        product,
      });
    }

    if (rawProducts.length % 25 === 0 && rawProducts.length > 0) {
      console.log(`olive-young public collection: ${rawProducts.length}/${requestedTargetCount} products saved in memory`);
    }

    if (rawProducts.length >= requestedTargetCount) break;
    if (delayMs > 0 && checked < productUrls.length) await sleep(delayMs);
  }

  const normalizedProducts = rawProducts
    .map((product) => normalizeOlivePublicProduct(product, collectedAt))
    .filter((product): product is Product => Boolean(product));

  await writeJson(OLIVE_RAW_OUTPUT, {
    merchantId: "olive-young",
    source: "olive-young-public-product-api",
    sourceMode: "public",
    sitemapUrl: OLIVE_PRODUCT_SITEMAP_URL,
    detailDataUrl: OLIVE_DETAIL_DATA_URL,
    collectionPolicy: OLIVE_RESPECT_ROBOTS_DELAY
      ? "Public product sitemap + product detail-data endpoint. robots.txt checked and crawl-delay respected."
      : "Public product sitemap + product detail-data endpoint. robots.txt checked; crawl-delay was manually disabled by OLIVE_RESPECT_ROBOTS_DELAY=0.",
    robotsAudit: audit,
    targetCount: requestedTargetCount,
    discoveredProductUrls: productUrls.length,
    count: rawProducts.length,
    collectedAt,
    products: rawProducts,
  });
  await writeJson(OLIVE_NORMALIZED_OUTPUT, {
    merchantId: "olive-young",
    source: "olive-young-public-product-api",
    sourceMode: "public",
    targetCount: requestedTargetCount,
    count: normalizedProducts.length,
    collectedAt,
    products: normalizedProducts,
  });

  return {
    sourceId: "olive-young",
    status: normalizedProducts.length ? "collected" : "failed",
    count: normalizedProducts.length,
    targetCount: requestedTargetCount,
    rawOutput: OLIVE_RAW_OUTPUT,
    normalizedOutput: OLIVE_NORMALIZED_OUTPUT,
    reason: normalizedProducts.length < requestedTargetCount
      ? `Collected ${normalizedProducts.length}/${requestedTargetCount}; source returned fewer parseable products during this run.`
      : undefined,
  };
}

async function collectOliveYoung(audit: RobotsAuditResult | undefined, collectedAt: string): Promise<CollectionResult> {
  const localProducts = await readLocalOliveProducts();
  const mode = OLIVE_SOURCE_MODE;

  if (mode === "local") return collectOliveYoungLocal(audit, collectedAt, OLIVE_TARGET_COUNT);
  if (mode === "public") return collectOliveYoungPublic(audit, collectedAt, OLIVE_TARGET_COUNT);

  if (localProducts.length >= OLIVE_TARGET_COUNT) {
    return collectOliveYoungLocal(audit, collectedAt, OLIVE_TARGET_COUNT);
  }

  try {
    return await collectOliveYoungPublic(audit, collectedAt, OLIVE_TARGET_COUNT);
  } catch (error) {
    const fallback = await collectOliveYoungLocal(audit, collectedAt, OLIVE_TARGET_COUNT);
    return {
      ...fallback,
      reason: [
        `Public Olive Young collection failed: ${error instanceof Error ? error.message : String(error)}`,
        fallback.reason,
      ].filter(Boolean).join(" "),
    };
  }
}

function robotsAllowsHimartProductDetail(audit: RobotsAuditResult | undefined): boolean {
  if (!audit?.ok) return false;
  const productDecision = audit.decisions.find((decision) => decision.path.startsWith("/app/goods/goodsDetail"));
  return productDecision?.allowed === true;
}

function himartGoodsNoFromUrl(value: string): string | null {
  try {
    return new URL(value).searchParams.get("goodsNo");
  } catch {
    return null;
  }
}

function himartMetaContent(html: string, property: string): string | undefined {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<meta\\s+property="${escaped}"\\s+content="([^"]*)"`, "i");
  return html.match(pattern)?.[1]?.trim();
}

function findProductJsonLd(html: string): Record<string, unknown> | null {
  const scripts = Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
  for (const script of scripts) {
    const text = script[1].trim();
    if (!text) continue;

    try {
      const parsed = JSON.parse(text) as unknown;
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      const product = candidates.find((candidate) => {
        if (!candidate || typeof candidate !== "object") return false;
        const record = candidate as Record<string, unknown>;
        return stringFrom(record["@type"]).toLowerCase() === "product";
      });
      if (product && typeof product === "object") return product as Record<string, unknown>;
    } catch {
      continue;
    }
  }
  return null;
}

function nestedRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function himartCategoryPath(value: unknown): string[] {
  const category = stringFrom(value);
  const parts = category
    .split(">")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? parts : ["Electronics"];
}

function normalizeHimartProduct(rawProduct: HimartRawProduct, collectedAt: string): Product | null {
  const product = rawProduct.product;
  const offers = nestedRecord(product.offers);
  const aggregateRating = nestedRecord(product.aggregateRating);
  const brandRecord = nestedRecord(product.brand);
  const sku = stringFrom(product.sku) || rawProduct.goodsNo;
  const title = stringFrom(product.name);
  const brand = stringFrom(brandRecord.name) || "Lotte Hi-Mart";
  const price = Math.round(numberFrom(offers.price));
  const categoryPath = himartCategoryPath(product.category);
  const availability = stringFrom(offers.availability);
  const additionalProperties = Array.isArray(product.additionalProperty)
    ? product.additionalProperty
      .map((property) => nestedRecord(property))
      .map((property) => `${stringFrom(property.name)}: ${stringFrom(property.value)}`)
      .filter((value) => value !== ": ")
      .slice(0, 12)
    : [];

  if (!sku || !title || price <= 0) return null;

  return {
    merchantId: "lotte-himart",
    merchantName: "Lotte Hi-Mart",
    productId: `himart-${sku}`,
    sku,
    title,
    brand,
    domain: "electronics",
    categoryPath,
    attributes: {
      source: "himart-sitemap-jsonld",
      goodsNo: sku,
      model: stringFrom(product.model),
      description: stringFrom(product.description).slice(0, 700),
      categoryLeaf: categoryPath.at(-1) ?? "Electronics",
      specs: additionalProperties,
    },
    price,
    currency: "KRW",
    stockStatus: availability.includes("InStock") ? "in_stock" : "out_of_stock",
    rating: numberFrom(aggregateRating.ratingValue),
    reviewCount: Math.round(numberFrom(aggregateRating.reviewCount)),
    tags: cleanTags([
      "electronics",
      "himart",
      "lotte",
      brand,
      ...categoryPath,
      ...title.split(/\s+/).slice(0, 8),
    ]),
    productUrl: rawProduct.productUrl,
    checkoutUrl: rawProduct.productUrl,
    imageUrl: rawProduct.imageUrl,
    metadataQuality: rawProduct.imageUrl && additionalProperties.length ? 0.92 : 0.84,
    sourceUpdatedAt: collectedAt,
  };
}

async function fetchHimartProductUrls(targetCount: number): Promise<string[]> {
  const sitemapXml = await fetchText(HIMART_SITEMAP_URL, "application/xml,text/xml,*/*;q=0.8");
  const productUrls = extractLocValues(sitemapXml)
    .filter((url) => url.startsWith(`${HIMART_BASE_URL}/app/goods/goodsDetail?`))
    .filter((url) => himartGoodsNoFromUrl(url));
  return Array.from(new Set(productUrls)).slice(0, targetCount);
}

async function fetchHimartRawProduct(productUrl: string, collectedAt: string): Promise<HimartRawProduct | null> {
  const goodsNo = himartGoodsNoFromUrl(productUrl);
  if (!goodsNo) return null;

  const html = await fetchText(productUrl, "text/html,*/*;q=0.8");
  const product = findProductJsonLd(html);
  if (!product) return null;

  return {
    goodsNo,
    productUrl,
    collectedAt,
    imageUrl: himartMetaContent(html, "eg:itemImage") || himartMetaContent(html, "og:image"),
    product,
  };
}

async function collectHimart(audit: RobotsAuditResult | undefined, collectedAt: string): Promise<CollectionResult> {
  if (!robotsAllowsHimartProductDetail(audit)) {
    return {
      sourceId: "lotte-himart",
      status: "skipped",
      count: 0,
      targetCount: HIMART_TARGET_COUNT,
      reason: "Current robots policy does not allow the sampled Hi-Mart product detail path for this collector.",
    };
  }

  const productUrls = await fetchHimartProductUrls(HIMART_TARGET_COUNT * 4);
  if (!productUrls.length) {
    return {
      sourceId: "lotte-himart",
      status: "failed",
      count: 0,
      targetCount: HIMART_TARGET_COUNT,
      reason: "Hi-Mart sitemap did not return product detail URLs.",
    };
  }

  const rawProducts: HimartRawProduct[] = [];
  for (const productUrl of productUrls) {
    const product = await fetchHimartRawProduct(productUrl, collectedAt);
    if (product) rawProducts.push(product);

    if (product && rawProducts.length % 25 === 0 && rawProducts.length > 0) {
      console.log(`lotte-himart collection: ${rawProducts.length}/${HIMART_TARGET_COUNT} products saved in memory`);
    }

    if (rawProducts.length >= HIMART_TARGET_COUNT) break;
    if (HIMART_REQUEST_DELAY_MS > 0) await sleep(HIMART_REQUEST_DELAY_MS);
  }

  const normalizedProducts = rawProducts
    .map((product) => normalizeHimartProduct(product, collectedAt))
    .filter((product): product is Product => Boolean(product));

  await writeJson(HIMART_RAW_OUTPUT, {
    merchantId: "lotte-himart",
    source: "himart-sitemap-jsonld",
    sitemapUrl: HIMART_SITEMAP_URL,
    collectionPolicy: "Public sitemap + product detail Schema.org JSON-LD. robots.txt checked before collection.",
    robotsAudit: audit,
    targetCount: HIMART_TARGET_COUNT,
    discoveredProductUrls: productUrls.length,
    count: rawProducts.length,
    collectedAt,
    products: rawProducts,
  });
  await writeJson(HIMART_NORMALIZED_OUTPUT, {
    merchantId: "lotte-himart",
    source: "himart-sitemap-jsonld",
    targetCount: HIMART_TARGET_COUNT,
    count: normalizedProducts.length,
    collectedAt,
    products: normalizedProducts,
  });

  return {
    sourceId: "lotte-himart",
    status: normalizedProducts.length ? "collected" : "failed",
    count: normalizedProducts.length,
    targetCount: HIMART_TARGET_COUNT,
    rawOutput: HIMART_RAW_OUTPUT,
    normalizedOutput: HIMART_NORMALIZED_OUTPUT,
    reason: normalizedProducts.length < HIMART_TARGET_COUNT
      ? `Collected ${normalizedProducts.length}/${HIMART_TARGET_COUNT}; source returned fewer parseable products during this run.`
      : undefined,
  };
}

function summarizeSource(source: MerchantCollectionSource, audit: RobotsAuditResult | undefined): Record<string, unknown> {
  const allowedPaths = audit?.decisions.filter((decision) => decision.allowed).map((decision) => decision.path) ?? [];
  const blockedPaths = audit?.decisions.filter((decision) => !decision.allowed).map((decision) => ({
    path: decision.path,
    rule: decision.matchedRule,
  })) ?? [];

  return {
    id: source.id,
    displayName: source.displayName,
    baseUrl: source.baseUrl,
    collectionStatus: source.collectionStatus,
    collectionNotes: source.collectionNotes,
    robots: audit
      ? {
          ok: audit.ok,
          robotsUrl: audit.robotsUrl,
          status: audit.status,
          error: audit.error,
          isRobotsText: audit.isRobotsText,
          sitemaps: audit.sitemaps,
          decisions: audit.decisions,
          allowedPaths,
          blockedPaths,
        }
      : null,
  };
}

async function auditAllSources(): Promise<RobotsAuditResult[]> {
  const audits: RobotsAuditResult[] = [];
  for (const source of MERCHANT_COLLECTION_SOURCES) {
    audits.push(await auditRobotsSource(source));
  }
  return audits;
}

function shouldCollect(merchantId: string): boolean {
  return REQUESTED_MERCHANTS.size === 0 || REQUESTED_MERCHANTS.has(merchantId);
}

async function runOnce(): Promise<void> {
  const collectedAt = new Date().toISOString();
  const audits = await auditAllSources();
  const auditsById = new Map(audits.map((audit) => [audit.id, audit]));
  const collectionResults: CollectionResult[] = [];

  if (shouldCollect("olive-young")) {
    collectionResults.push(await collectOliveYoung(auditsById.get("olive-young"), collectedAt));
  }
  if (shouldCollect("lotte-himart")) {
    collectionResults.push(await collectHimart(auditsById.get("lotte-himart"), collectedAt));
  }

  const status = {
    generatedAt: collectedAt,
    userAgent: DEFAULT_COLLECTOR_USER_AGENT,
    targetProductsPerMerchant: MERCHANT_TARGET_COUNT,
    intervalHint: "Run `npm run collect:merchants -- --watch --interval-minutes=1440` for periodic daily refresh.",
    sources: MERCHANT_COLLECTION_SOURCES.map((source) => summarizeSource(source, auditsById.get(source.id))),
    collectionResults,
  };

  const manifest = {
    generatedAt: collectedAt,
    targetProductsPerMerchant: MERCHANT_TARGET_COUNT,
    merchants: collectionResults.map((result) => ({
      merchantId: result.sourceId,
      status: result.status,
      count: result.count,
      targetCount: result.targetCount,
      rawOutput: result.rawOutput,
      normalizedOutput: result.normalizedOutput,
      reason: result.reason,
    })),
  };

  await writeJson(statusOutput, status);
  await writeJson(manifestOutput, manifest);
  await writeJson(join(runDir, `merchant-collection-${compactIsoForFilename(collectedAt)}.json`), status);

  for (const result of collectionResults) {
    console.log(`${result.sourceId}: ${result.status} (${result.count}/${result.targetCount ?? result.count})${result.reason ? ` - ${result.reason}` : ""}`);
  }
  console.log(`Status: ${statusOutput}`);
  console.log(`Manifest: ${manifestOutput}`);
}

function argValue(name: string): string | undefined {
  const prefix = `${name}=`;
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const watch = args.has("--watch") || process.env.OMNIMALL_COLLECT_WATCH === "1";
  const intervalMinutes = Math.max(1, Number(argValue("--interval-minutes") ?? process.env.OMNIMALL_COLLECT_INTERVAL_MINUTES ?? 1440));

  await runOnce();

  if (!watch) return;
  const intervalMs = intervalMinutes * 60 * 1000;
  console.log(`Periodic collection enabled every ${intervalMinutes} minute(s).`);
  setInterval(() => {
    runOnce().catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
  }, intervalMs);
}

await main();
