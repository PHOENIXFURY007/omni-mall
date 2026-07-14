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

interface ShopifyVariant {
  id?: number;
  title?: string;
  sku?: string | null;
  available?: boolean;
  price?: string;
  compare_at_price?: string | null;
}

interface ShopifyImage {
  src?: string;
}

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html?: string;
  vendor?: string;
  product_type?: string;
  tags?: string[];
  variants?: ShopifyVariant[];
  images?: ShopifyImage[];
  published_at?: string;
  updated_at?: string;
}

interface ShopifyMerchantConfig {
  merchantId: "sulwhasoo-us" | "innisfree-jp";
  merchantName: string;
  baseUrl: string;
  rawOutput: string;
  normalizedOutput: string;
  targetCount: number;
  originalCurrency: "USD" | "JPY";
  krwRate: number;
}

interface JsonLdMerchantConfig {
  merchantId: "kurly" | "stylekorean";
  merchantName: string;
  baseUrl: string;
  rawOutput: string;
  normalizedOutput: string;
  targetCount: number;
  source: string;
  domain: string;
  categoryRoot: string;
  robotsPathPrefix: string;
  defaultCurrency: "KRW" | "USD";
  krwRate: number;
  requestDelayMs: number;
  fetchProductUrls: (targetCount: number) => Promise<string[]>;
}

interface JsonLdRawProduct {
  productId: string;
  productUrl: string;
  collectedAt: string;
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

interface DatasetManifestSource {
  merchantId: string;
  rawOutput: string;
  normalizedOutput: string;
  targetCount?: number;
}

type OliveSourceMode = "auto" | "local" | "public";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const dataDir = join(repoRoot, "data");
const runDir = join(dataDir, "collection-runs");
const statusOutput = join(dataDir, "merchant-collection-status.json");
const manifestOutput = join(dataDir, "merchant-product-manifest.json");
const AMORE_RAW_OUTPUT = join(dataDir, "amore-products.raw.json");
const AMORE_NORMALIZED_OUTPUT = join(dataDir, "amore-products.normalized.json");
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
const KURLY_BASE_URL = "https://www.kurly.com";
const KURLY_SITEMAP_INDEX_URL = `${KURLY_BASE_URL}/sitemap/index-sitemap.xml`;
const KURLY_RAW_OUTPUT = join(dataDir, "kurly-products.raw.json");
const KURLY_NORMALIZED_OUTPUT = join(dataDir, "kurly-products.normalized.json");
const KURLY_TARGET_COUNT = Math.max(1, Number(process.env.KURLY_TARGET_COUNT ?? MERCHANT_TARGET_COUNT));
const KURLY_REQUEST_DELAY_MS = Math.max(0, Number(process.env.KURLY_REQUEST_DELAY_MS ?? 100));
const STYLEKOREAN_BASE_URL = "https://www.stylekorean.com";
const STYLEKOREAN_PRODUCT_SITEMAP_URL = `${STYLEKOREAN_BASE_URL}/sitemap-products-1.xml`;
const STYLEKOREAN_RAW_OUTPUT = join(dataDir, "stylekorean-products.raw.json");
const STYLEKOREAN_NORMALIZED_OUTPUT = join(dataDir, "stylekorean-products.normalized.json");
const STYLEKOREAN_TARGET_COUNT = Math.max(1, Number(process.env.STYLEKOREAN_TARGET_COUNT ?? MERCHANT_TARGET_COUNT));
const STYLEKOREAN_REQUEST_DELAY_MS = Math.max(0, Number(process.env.STYLEKOREAN_REQUEST_DELAY_MS ?? 75));
const COSRX_BASE_URL = "https://cosrx.co.kr";
const COSRX_SITEMAP_URL = `${COSRX_BASE_URL}/sitemap.xml`;
const COSRX_RAW_OUTPUT = join(dataDir, "cosrx-korea-products.raw.json");
const COSRX_NORMALIZED_OUTPUT = join(dataDir, "cosrx-korea-products.normalized.json");
const COSRX_TARGET_COUNT = Math.max(1, Number(process.env.COSRX_TARGET_COUNT ?? MERCHANT_TARGET_COUNT));
const SULWHASOO_BASE_URL = "https://us.sulwhasoo.com";
const SULWHASOO_RAW_OUTPUT = join(dataDir, "sulwhasoo-us-products.raw.json");
const SULWHASOO_NORMALIZED_OUTPUT = join(dataDir, "sulwhasoo-us-products.normalized.json");
const SULWHASOO_TARGET_COUNT = Math.max(1, Number(process.env.SULWHASOO_TARGET_COUNT ?? MERCHANT_TARGET_COUNT));
const INNISFREE_BASE_URL = "https://www.innisfree.jp";
const INNISFREE_RAW_OUTPUT = join(dataDir, "innisfree-jp-products.raw.json");
const INNISFREE_NORMALIZED_OUTPUT = join(dataDir, "innisfree-jp-products.normalized.json");
const INNISFREE_TARGET_COUNT = Math.max(1, Number(process.env.INNISFREE_TARGET_COUNT ?? MERCHANT_TARGET_COUNT));
const NETWORK_RETRY_ATTEMPTS = Math.max(1, Number(process.env.COLLECT_NETWORK_RETRY_ATTEMPTS ?? 5));
const NETWORK_RETRY_BASE_MS = Math.max(250, Number(process.env.COLLECT_NETWORK_RETRY_BASE_MS ?? 5000));
const USD_KRW_RATE = Number(process.env.OLIVE_USD_KRW_RATE ?? 1350);
const SHOPIFY_USD_KRW_RATE = Number(process.env.SHOPIFY_USD_KRW_RATE ?? 1350);
const SHOPIFY_JPY_KRW_RATE = Number(process.env.SHOPIFY_JPY_KRW_RATE ?? 9.2);
const MARKETPLACE_USD_KRW_RATE = Number(process.env.MARKETPLACE_USD_KRW_RATE ?? 1350);

function datasetManifestSources(): DatasetManifestSource[] {
  return [
    {
      merchantId: "amore-pacific",
      rawOutput: AMORE_RAW_OUTPUT,
      normalizedOutput: AMORE_NORMALIZED_OUTPUT,
      targetCount: MERCHANT_TARGET_COUNT,
    },
    {
      merchantId: "olive-young",
      rawOutput: OLIVE_RAW_OUTPUT,
      normalizedOutput: OLIVE_NORMALIZED_OUTPUT,
      targetCount: OLIVE_TARGET_COUNT,
    },
    {
      merchantId: "lotte-himart",
      rawOutput: HIMART_RAW_OUTPUT,
      normalizedOutput: HIMART_NORMALIZED_OUTPUT,
      targetCount: HIMART_TARGET_COUNT,
    },
    {
      merchantId: "kurly",
      rawOutput: KURLY_RAW_OUTPUT,
      normalizedOutput: KURLY_NORMALIZED_OUTPUT,
      targetCount: KURLY_TARGET_COUNT,
    },
    {
      merchantId: "stylekorean",
      rawOutput: STYLEKOREAN_RAW_OUTPUT,
      normalizedOutput: STYLEKOREAN_NORMALIZED_OUTPUT,
      targetCount: STYLEKOREAN_TARGET_COUNT,
    },
    {
      merchantId: "cosrx-korea",
      rawOutput: COSRX_RAW_OUTPUT,
      normalizedOutput: COSRX_NORMALIZED_OUTPUT,
      targetCount: COSRX_TARGET_COUNT,
    },
    {
      merchantId: "sulwhasoo-us",
      rawOutput: SULWHASOO_RAW_OUTPUT,
      normalizedOutput: SULWHASOO_NORMALIZED_OUTPUT,
      targetCount: SULWHASOO_TARGET_COUNT,
    },
    {
      merchantId: "innisfree-jp",
      rawOutput: INNISFREE_RAW_OUTPUT,
      normalizedOutput: INNISFREE_NORMALIZED_OUTPUT,
      targetCount: INNISFREE_TARGET_COUNT,
    },
  ];
}

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

function stripHtml(value: unknown): string {
  return decodeHtmlEntities(String(value ?? ""))
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toKrwPrice(originalPrice: number, krwRate: number): number {
  return Math.max(1000, Math.round((originalPrice * krwRate) / 10) * 10);
}

function firstUsableVariant(product: ShopifyProduct): ShopifyVariant | undefined {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  return variants.find((variant) => variant.available) ?? variants[0];
}

function firstShopifyImage(product: ShopifyProduct): string | undefined {
  const image = Array.isArray(product.images) ? product.images.find((candidate) => candidate.src)?.src : undefined;
  if (!image) return undefined;
  return image.startsWith("//") ? `https:${image}` : image;
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

function normalizeCharsetLabel(value: string | undefined): string | undefined {
  const label = value?.trim().toLowerCase().replace(/^["']|["']$/g, "");
  if (!label) return undefined;
  if (label === "utf8") return "utf-8";
  if (["euc_kr", "ks_c_5601-1987", "ks_c_5601", "cp949", "windows-949"].includes(label)) return "euc-kr";
  return label;
}

function charsetFromContentType(value: string | null): string | undefined {
  return normalizeCharsetLabel(value?.match(/charset\s*=\s*([^;\s]+)/i)?.[1]);
}

function charsetFromHtmlHead(buffer: ArrayBuffer): string | undefined {
  const head = new TextDecoder("utf-8").decode(buffer.slice(0, 4096));
  const charset = head.match(/<meta[^>]+charset=["']?\s*([^"'>\s/]+)/i)?.[1]
    ?? head.match(/content=["'][^"']*charset\s*=\s*([^"'\s;]+)/i)?.[1];
  return normalizeCharsetLabel(charset);
}

function decodeResponseBody(buffer: ArrayBuffer, contentType: string | null): string {
  const charset = charsetFromContentType(contentType) ?? charsetFromHtmlHead(buffer) ?? "utf-8";
  try {
    return new TextDecoder(charset).decode(buffer);
  } catch {
    return new TextDecoder("utf-8").decode(buffer);
  }
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
    return decodeResponseBody(await response.arrayBuffer(), response.headers.get("content-type"));
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

function jsonLdTypeMatches(record: Record<string, unknown>, expectedType: string): boolean {
  const value = record["@type"];
  const types = Array.isArray(value) ? value : [value];
  return types.some((type) => stringFrom(type).toLowerCase() === expectedType.toLowerCase());
}

function findProductJsonLdCandidate(candidate: unknown): Record<string, unknown> | null {
  if (Array.isArray(candidate)) {
    for (const item of candidate) {
      const product = findProductJsonLdCandidate(item);
      if (product) return product;
    }
    return null;
  }

  if (!candidate || typeof candidate !== "object") return null;
  const record = candidate as Record<string, unknown>;
  if (jsonLdTypeMatches(record, "Product")) return record;

  const graph = record["@graph"];
  if (Array.isArray(graph)) return findProductJsonLdCandidate(graph);

  return null;
}

function findProductJsonLd(html: string): Record<string, unknown> | null {
  const scripts = Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
  for (const script of scripts) {
    const text = script[1].trim();
    if (!text) continue;

    try {
      const parsed = JSON.parse(text) as unknown;
      const product = findProductJsonLdCandidate(parsed);
      if (product) return product;
    } catch {
      continue;
    }
  }
  return null;
}

function nestedRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function firstNestedRecord(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) {
    const record = value.find((candidate) => candidate && typeof candidate === "object" && !Array.isArray(candidate));
    return nestedRecord(record);
  }
  return nestedRecord(value);
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

function robotsAllowsPath(audit: RobotsAuditResult | undefined, pathPrefix: string): boolean {
  if (!audit?.ok) return false;
  const decision = audit.decisions.find((candidate) => candidate.path.startsWith(pathPrefix));
  return decision?.allowed !== false;
}

function jsonLdProductIdFromUrl(value: string): string {
  try {
    const url = new URL(value);
    const lastPathPart = url.pathname.split("/").filter(Boolean).at(-1);
    return lastPathPart || value;
  } catch {
    return value;
  }
}

function absoluteUrl(value: string, baseUrl: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return trimmed;
  }
}

function jsonLdImageUrl(value: unknown, baseUrl: string): string | undefined {
  if (typeof value === "string") {
    const imageUrl = absoluteUrl(value, baseUrl);
    return imageUrl || undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const imageUrl = jsonLdImageUrl(item, baseUrl);
      if (imageUrl) return imageUrl;
    }
    return undefined;
  }

  const record = nestedRecord(value);
  const url = stringFrom(record.url) || stringFrom(record.contentUrl);
  return url ? absoluteUrl(url, baseUrl) : undefined;
}

function jsonLdBrandName(value: unknown, fallback: string): string {
  if (typeof value === "string") return value.trim() || fallback;
  const record = firstNestedRecord(value);
  return stringFrom(record.name) || fallback;
}

function jsonLdCategoryPath(config: JsonLdMerchantConfig, value: unknown): string[] {
  const rawCategory = stringFrom(value);
  const parts = rawCategory
    .split(/>|\/|\|/g)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) return [config.categoryRoot];
  const rootAlreadyPresent = parts[0]?.toLowerCase() === config.categoryRoot.toLowerCase();
  return rootAlreadyPresent ? parts : [config.categoryRoot, ...parts];
}

function priceInKrw(originalPrice: number, currency: string, krwRate: number): number {
  if (currency.toUpperCase() === "KRW") return Math.round(originalPrice);
  return originalPrice > 0 ? toKrwPrice(originalPrice, krwRate) : 0;
}

function normalizeJsonLdProduct(
  config: JsonLdMerchantConfig,
  rawProduct: JsonLdRawProduct,
  collectedAt: string,
): Product | null {
  const product = rawProduct.product;
  const offers = firstNestedRecord(product.offers);
  const aggregateRating = firstNestedRecord(product.aggregateRating);
  const title = stringFrom(product.name);
  const sku = stringFrom(product.sku) || stringFrom(product.mpn) || rawProduct.productId;
  const brand = jsonLdBrandName(product.brand, config.merchantName);
  const currency = (stringFrom(offers.priceCurrency) || config.defaultCurrency).toUpperCase();
  const originalPrice = numberFrom(offers.price) || numberFrom(offers.lowPrice);
  const price = priceInKrw(originalPrice, currency, config.krwRate);
  const categoryPath = jsonLdCategoryPath(config, product.category);
  const productUrl = absoluteUrl(stringFrom(product.url) || rawProduct.productUrl, config.baseUrl);
  const imageUrl = jsonLdImageUrl(product.image, config.baseUrl);
  const description = stringFrom(product.description).slice(0, 700);
  const availability = stringFrom(offers.availability);
  const rating = numberFrom(aggregateRating.ratingValue);
  const reviewCount = Math.round(numberFrom(aggregateRating.reviewCount) || numberFrom(aggregateRating.ratingCount));

  if (!sku || !title || !productUrl || price <= 0) return null;

  return {
    merchantId: config.merchantId,
    merchantName: config.merchantName,
    productId: `${config.merchantId}-${rawProduct.productId}`,
    sku,
    title,
    brand,
    domain: config.domain,
    categoryPath,
    attributes: {
      source: config.source,
      productId: rawProduct.productId,
      originalCurrency: currency,
      originalPrice,
      exchangeRateToKrw: config.krwRate,
      description,
      categoryLeaf: categoryPath.at(-1) ?? config.categoryRoot,
    },
    price,
    currency: "KRW",
    stockStatus: availability.includes("OutOfStock") ? "out_of_stock" : "in_stock",
    rating,
    reviewCount,
    tags: cleanTags([
      config.categoryRoot,
      config.domain,
      config.merchantName,
      brand,
      ...categoryPath,
      ...title.split(/\s+/).slice(0, 8),
    ]),
    productUrl,
    checkoutUrl: productUrl,
    imageUrl,
    metadataQuality: imageUrl && description ? 0.92 : 0.86,
    sourceUpdatedAt: collectedAt,
  };
}

async function fetchKurlyProductUrls(targetCount: number): Promise<string[]> {
  const sitemapIndexXml = await fetchText(KURLY_SITEMAP_INDEX_URL, "application/xml,text/xml,*/*;q=0.8");
  const sitemapUrls = extractLocValues(sitemapIndexXml)
    .filter((url) => url.startsWith(`${KURLY_BASE_URL}/sitemap/goods-`));
  const productUrls: string[] = [];

  for (const sitemapUrl of sitemapUrls) {
    try {
      const sitemapXml = await fetchText(sitemapUrl, "application/xml,text/xml,*/*;q=0.8");
      productUrls.push(...extractLocValues(sitemapXml).filter((url) => url.startsWith(`${KURLY_BASE_URL}/goods/`)));
    } catch (error) {
      console.warn(`kurly sitemap skipped (${sitemapUrl}): ${error instanceof Error ? error.message : String(error)}`);
    }
    if (productUrls.length >= targetCount * 4) break;
  }

  return Array.from(new Set(productUrls)).slice(0, targetCount * 4);
}

async function fetchStyleKoreanProductUrls(targetCount: number): Promise<string[]> {
  const sitemapXml = await fetchText(STYLEKOREAN_PRODUCT_SITEMAP_URL, "application/xml,text/xml,*/*;q=0.8");
  const productUrls = extractLocValues(sitemapXml)
    .filter((url) => url.startsWith(`${STYLEKOREAN_BASE_URL}/product/`));
  return Array.from(new Set(productUrls)).slice(0, targetCount * 3);
}

async function fetchJsonLdRawProduct(productUrl: string, collectedAt: string): Promise<JsonLdRawProduct | null> {
  const html = await fetchText(productUrl, "text/html,*/*;q=0.8");
  const product = findProductJsonLd(html);
  if (!product) return null;

  return {
    productId: jsonLdProductIdFromUrl(productUrl),
    productUrl,
    collectedAt,
    product,
  };
}

async function collectJsonLdMerchant(
  config: JsonLdMerchantConfig,
  audit: RobotsAuditResult | undefined,
  collectedAt: string,
): Promise<CollectionResult> {
  if (!robotsAllowsPath(audit, config.robotsPathPrefix)) {
    return {
      sourceId: config.merchantId,
      status: "skipped",
      count: 0,
      targetCount: config.targetCount,
      reason: `Current robots policy does not allow the sampled ${config.robotsPathPrefix} path for this collector.`,
    };
  }

  const productUrls = await config.fetchProductUrls(config.targetCount);
  if (!productUrls.length) {
    return {
      sourceId: config.merchantId,
      status: "failed",
      count: 0,
      targetCount: config.targetCount,
      reason: `${config.merchantName} sitemap did not return product detail URLs.`,
    };
  }

  const rawProducts: JsonLdRawProduct[] = [];
  const normalizedProducts: Product[] = [];

  for (const productUrl of productUrls) {
    try {
      const rawProduct = await fetchJsonLdRawProduct(productUrl, collectedAt);
      const normalizedProduct = rawProduct ? normalizeJsonLdProduct(config, rawProduct, collectedAt) : null;
      if (rawProduct && normalizedProduct) {
        rawProducts.push(rawProduct);
        normalizedProducts.push(normalizedProduct);
      }
    } catch (error) {
      console.warn(`${config.merchantId} product skipped (${productUrl}): ${error instanceof Error ? error.message : String(error)}`);
    }

    if (normalizedProducts.length % 25 === 0 && normalizedProducts.length > 0) {
      console.log(`${config.merchantId} collection: ${normalizedProducts.length}/${config.targetCount} products saved in memory`);
    }

    if (normalizedProducts.length >= config.targetCount) break;
    if (config.requestDelayMs > 0) await sleep(config.requestDelayMs);
  }

  await writeJson(config.rawOutput, {
    merchantId: config.merchantId,
    source: config.source,
    baseUrl: config.baseUrl,
    collectionPolicy: "Public sitemap + product detail Schema.org JSON-LD. robots.txt checked before collection; account/cart/payment paths are not collected.",
    robotsAudit: audit,
    targetCount: config.targetCount,
    discoveredProductUrls: productUrls.length,
    count: rawProducts.length,
    collectedAt,
    products: rawProducts,
  });
  await writeJson(config.normalizedOutput, {
    merchantId: config.merchantId,
    source: config.source,
    targetCount: config.targetCount,
    count: normalizedProducts.length,
    collectedAt,
    products: normalizedProducts,
  });

  return {
    sourceId: config.merchantId,
    status: normalizedProducts.length ? "collected" : "failed",
    count: normalizedProducts.length,
    targetCount: config.targetCount,
    rawOutput: config.rawOutput,
    normalizedOutput: config.normalizedOutput,
    reason: normalizedProducts.length < config.targetCount
      ? `Collected ${normalizedProducts.length}/${config.targetCount}; source returned fewer parseable products during this run.`
      : undefined,
  };
}

async function fetchShopifyProducts(baseUrl: string, targetCount: number): Promise<ShopifyProduct[]> {
  const products: ShopifyProduct[] = [];
  for (let page = 1; products.length < targetCount; page += 1) {
    const url = `${baseUrl}/products.json?limit=250&page=${page}`;
    const response = await withNetworkRetry(`GET ${url}`, async () => {
      const fetched = await fetch(url, {
        headers: {
          "user-agent": DEFAULT_COLLECTOR_USER_AGENT,
          "accept": "application/json",
          "accept-language": "en-US,en;q=0.9,ko;q=0.8,ja;q=0.7",
        },
      });
      if (!fetched.ok) throw new Error(`${url} returned HTTP ${fetched.status}`);
      return fetched;
    });
    const body = await response.json() as { products?: ShopifyProduct[] };
    const pageProducts = Array.isArray(body.products) ? body.products : [];
    if (!pageProducts.length) break;
    products.push(...pageProducts);
    if (pageProducts.length < 250) break;
  }
  return products.slice(0, targetCount);
}

function normalizeShopifyProduct(
  config: ShopifyMerchantConfig,
  product: ShopifyProduct,
  collectedAt: string,
): Product | null {
  const variant = firstUsableVariant(product);
  const originalPrice = numberFrom(variant?.price);
  if (!product.id || !product.title || !product.handle || !variant || variant.price === undefined || variant.price === null) return null;

  const productType = product.product_type?.trim() || "Beauty";
  const tags = Array.isArray(product.tags) ? product.tags : [];
  const categoryPath = ["Beauty", productType].filter(Boolean);
  const productUrl = `${config.baseUrl}/products/${product.handle}`;
  const sku = variant.sku?.trim() || `${product.id}-${variant.id ?? "default"}`;
  const description = stripHtml(product.body_html).slice(0, 700);

  return {
    merchantId: config.merchantId,
    merchantName: config.merchantName,
    productId: `${config.merchantId}-${product.id}`,
    sku,
    title: product.title.trim(),
    brand: product.vendor?.trim() || config.merchantName,
    domain: "beauty",
    categoryPath,
    attributes: {
      source: "shopify-products-json",
      productId: String(product.id),
      variantId: String(variant.id ?? ""),
      handle: product.handle,
      description,
      originalCurrency: config.originalCurrency,
      originalPrice: originalPrice,
      compareAtPrice: numberFrom(variant.compare_at_price),
      exchangeRateToKrw: config.krwRate,
      productType,
      shopifyTags: tags.slice(0, 12),
    },
    price: originalPrice > 0 ? toKrwPrice(originalPrice, config.krwRate) : 0,
    currency: "KRW",
    stockStatus: variant.available === false ? "out_of_stock" : "in_stock",
    rating: 0,
    reviewCount: 0,
    tags: cleanTags([
      "beauty",
      config.merchantName,
      product.vendor,
      productType,
      ...tags,
      ...product.title.split(/\s+/).slice(0, 8),
    ]),
    productUrl,
    checkoutUrl: productUrl,
    imageUrl: firstShopifyImage(product),
    metadataQuality: description ? 0.9 : 0.86,
    sourceUpdatedAt: product.updated_at ?? collectedAt,
  };
}

async function collectShopifyMerchant(
  config: ShopifyMerchantConfig,
  audit: RobotsAuditResult | undefined,
  collectedAt: string,
): Promise<CollectionResult> {
  if (!robotsAllowsPath(audit, "/products.json")) {
    return {
      sourceId: config.merchantId,
      status: "skipped",
      count: 0,
      targetCount: config.targetCount,
      reason: "Current robots policy does not allow the sampled Shopify products.json path for this collector.",
    };
  }

  const rawProducts = await fetchShopifyProducts(config.baseUrl, config.targetCount);
  const normalizedProducts = rawProducts
    .map((product) => normalizeShopifyProduct(config, product, collectedAt))
    .filter((product): product is Product => Boolean(product));

  await writeJson(config.rawOutput, {
    merchantId: config.merchantId,
    source: "shopify-products-json",
    productsJsonUrl: `${config.baseUrl}/products.json`,
    ucpDiscoveryUrl: `${config.baseUrl}/.well-known/ucp`,
    collectionPolicy: "Public Shopify products.json catalog. robots.txt checked before collection; checkout/cart/account paths are not collected.",
    robotsAudit: audit,
    targetCount: config.targetCount,
    count: rawProducts.length,
    collectedAt,
    products: rawProducts,
  });
  await writeJson(config.normalizedOutput, {
    merchantId: config.merchantId,
    source: "shopify-products-json",
    targetCount: config.targetCount,
    count: normalizedProducts.length,
    collectedAt,
    products: normalizedProducts,
  });

  return {
    sourceId: config.merchantId,
    status: normalizedProducts.length ? "collected" : "failed",
    count: normalizedProducts.length,
    targetCount: config.targetCount,
    rawOutput: config.rawOutput,
    normalizedOutput: config.normalizedOutput,
    reason: normalizedProducts.length < config.targetCount
      ? `Collected ${normalizedProducts.length}/${config.targetCount}; public Shopify catalog returned fewer product-level records.`
      : undefined,
  };
}

function cosrxProductIdFromUrl(value: string): string {
  try {
    return new URL(value).searchParams.get("branduid") ?? value;
  } catch {
    return value;
  }
}

async function collectCosrxCandidates(audit: RobotsAuditResult | undefined, collectedAt: string): Promise<CollectionResult> {
  if (!robotsAllowsPath(audit, "/sitemap.xml")) {
    return {
      sourceId: "cosrx-korea",
      status: "skipped",
      count: 0,
      targetCount: COSRX_TARGET_COUNT,
      reason: "Current robots policy does not allow sitemap inspection for this collector.",
    };
  }

  const sitemapXml = await fetchText(COSRX_SITEMAP_URL, "application/xml,text/xml,*/*;q=0.8");
  const productUrls = extractLocValues(sitemapXml)
    .map((url) => url.replace(/^http:\/\/www\.cosrx\.co\.kr/i, COSRX_BASE_URL))
    .filter((url) => /\/shop\/shopdetail\.html/i.test(url))
    .slice(0, COSRX_TARGET_COUNT);

  await writeJson(COSRX_RAW_OUTPUT, {
    merchantId: "cosrx-korea",
    source: "cosrx-sitemap-product-candidates",
    sitemapUrl: COSRX_SITEMAP_URL,
    collectionPolicy: "robots.txt allows sitemap/product candidate discovery. Detail/category pages returned a MakeShop anti-abuse page for the collector IP, so normalized product metadata is not generated.",
    robotsAudit: audit,
    targetCount: COSRX_TARGET_COUNT,
    count: productUrls.length,
    collectedAt,
    products: productUrls.map((productUrl) => ({
      productUrl,
      productId: cosrxProductIdFromUrl(productUrl),
      status: "candidate_only",
    })),
  });
  await writeJson(COSRX_NORMALIZED_OUTPUT, {
    merchantId: "cosrx-korea",
    source: "cosrx-sitemap-product-candidates",
    targetCount: COSRX_TARGET_COUNT,
    count: 0,
    collectedAt,
    products: [],
    reason: "COSRX MakeShop detail/category pages returned anti-abuse block content to the collector IP; approved source/feed is needed before runtime normalization.",
  });

  return {
    sourceId: "cosrx-korea",
    status: "skipped",
    count: 0,
    targetCount: COSRX_TARGET_COUNT,
    rawOutput: COSRX_RAW_OUTPUT,
    normalizedOutput: COSRX_NORMALIZED_OUTPUT,
    reason: `Saved ${productUrls.length} sitemap product candidates, but normalized collection was not possible because detail/category pages returned anti-abuse block content.`,
  };
}

async function readJsonFile(path: string): Promise<Record<string, unknown> | null> {
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function datasetCount(dataset: Record<string, unknown> | null): number {
  if (!dataset) return 0;
  const explicitCount = numberFrom(dataset.count);
  if (explicitCount > 0) return explicitCount;
  return Array.isArray(dataset.products) ? dataset.products.length : 0;
}

async function buildDatasetManifest(collectionResults: CollectionResult[]): Promise<Record<string, unknown>> {
  const resultsByMerchant = new Map(collectionResults.map((result) => [result.sourceId, result]));
  const merchants = await Promise.all(datasetManifestSources().map(async (source) => {
    const normalized = await readJsonFile(source.normalizedOutput);
    const raw = await readJsonFile(source.rawOutput);
    const normalizedCount = datasetCount(normalized);
    const rawCount = datasetCount(raw);
    const result = resultsByMerchant.get(source.merchantId);
    const status = result?.status
      ?? (normalizedCount > 0 ? "available" : rawCount > 0 ? "candidate_only" : "not_collected");

    return {
      merchantId: source.merchantId,
      status,
      count: normalizedCount,
      rawCount,
      targetCount: result?.targetCount ?? source.targetCount,
      rawOutput: source.rawOutput,
      normalizedOutput: source.normalizedOutput,
      reason: result?.reason
        ?? (normalizedCount === 0 && rawCount > 0 ? "Raw candidates exist, but normalized runtime products are not available." : undefined),
    };
  }));

  return {
    targetProductsPerMerchant: MERCHANT_TARGET_COUNT,
    merchants,
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
  if (shouldCollect("kurly")) {
    collectionResults.push(await collectJsonLdMerchant({
      merchantId: "kurly",
      merchantName: "Kurly",
      baseUrl: KURLY_BASE_URL,
      rawOutput: KURLY_RAW_OUTPUT,
      normalizedOutput: KURLY_NORMALIZED_OUTPUT,
      targetCount: KURLY_TARGET_COUNT,
      source: "kurly-goods-sitemap-jsonld",
      domain: "food",
      categoryRoot: "Food",
      robotsPathPrefix: "/goods",
      defaultCurrency: "KRW",
      krwRate: 1,
      requestDelayMs: KURLY_REQUEST_DELAY_MS,
      fetchProductUrls: fetchKurlyProductUrls,
    }, auditsById.get("kurly"), collectedAt));
  }
  if (shouldCollect("stylekorean")) {
    collectionResults.push(await collectJsonLdMerchant({
      merchantId: "stylekorean",
      merchantName: "StyleKorean",
      baseUrl: STYLEKOREAN_BASE_URL,
      rawOutput: STYLEKOREAN_RAW_OUTPUT,
      normalizedOutput: STYLEKOREAN_NORMALIZED_OUTPUT,
      targetCount: STYLEKOREAN_TARGET_COUNT,
      source: "stylekorean-product-sitemap-jsonld",
      domain: "beauty",
      categoryRoot: "Beauty",
      robotsPathPrefix: "/product",
      defaultCurrency: "USD",
      krwRate: MARKETPLACE_USD_KRW_RATE,
      requestDelayMs: STYLEKOREAN_REQUEST_DELAY_MS,
      fetchProductUrls: fetchStyleKoreanProductUrls,
    }, auditsById.get("stylekorean"), collectedAt));
  }
  if (shouldCollect("cosrx-korea")) {
    collectionResults.push(await collectCosrxCandidates(auditsById.get("cosrx-korea"), collectedAt));
  }
  if (shouldCollect("sulwhasoo-us")) {
    collectionResults.push(await collectShopifyMerchant({
      merchantId: "sulwhasoo-us",
      merchantName: "Sulwhasoo US",
      baseUrl: SULWHASOO_BASE_URL,
      rawOutput: SULWHASOO_RAW_OUTPUT,
      normalizedOutput: SULWHASOO_NORMALIZED_OUTPUT,
      targetCount: SULWHASOO_TARGET_COUNT,
      originalCurrency: "USD",
      krwRate: SHOPIFY_USD_KRW_RATE,
    }, auditsById.get("sulwhasoo-us"), collectedAt));
  }
  if (shouldCollect("innisfree-jp")) {
    collectionResults.push(await collectShopifyMerchant({
      merchantId: "innisfree-jp",
      merchantName: "Innisfree JP",
      baseUrl: INNISFREE_BASE_URL,
      rawOutput: INNISFREE_RAW_OUTPUT,
      normalizedOutput: INNISFREE_NORMALIZED_OUTPUT,
      targetCount: INNISFREE_TARGET_COUNT,
      originalCurrency: "JPY",
      krwRate: SHOPIFY_JPY_KRW_RATE,
    }, auditsById.get("innisfree-jp"), collectedAt));
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
    ...(await buildDatasetManifest(collectionResults)),
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
