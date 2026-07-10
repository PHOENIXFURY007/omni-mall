import { MERCHANT_PROFILES, PRODUCT_CATALOG } from "../data/catalog.js";
import type { AdapterPreviewResult, AdapterValidationResult, MerchantId, Product } from "../types.js";
import { createApiMeta } from "./meta.js";
import { listDomains } from "./catalog.js";

const PRODUCT_REQUIRED_FIELDS = [
  "productId",
  "merchantId",
  "title",
  "brand",
  "domain",
  "categoryPath",
  "price",
  "currency",
  "stockStatus",
  "productUrl",
];

function productHasField(product: Product, field: string): boolean {
  const value = product[field as keyof Product];
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && value !== "";
}

function validateMerchant(merchantId: MerchantId): AdapterValidationResult["results"][number] {
  const products = PRODUCT_CATALOG.filter((product) => product.merchantId === merchantId);
  const missingFields = Array.from(new Set(
    products.flatMap((product) => PRODUCT_REQUIRED_FIELDS.filter((field) => !productHasField(product, field))),
  ));
  const warnings: string[] = [];
  const profile = MERCHANT_PROFILES[merchantId];

  if (profile.authProfile === "none") {
    warnings.push("No OAuth profile is configured yet; public/sample data only.");
  }
  if (products.some((product) => product.metadataQuality < 0.85)) {
    warnings.push("Some products have metadata quality below the target threshold.");
  }

  const completeness = PRODUCT_REQUIRED_FIELDS.length === 0
    ? 1
    : 1 - (missingFields.length / PRODUCT_REQUIRED_FIELDS.length);
  const qualityAverage = products.length
    ? products.reduce((sum, product) => sum + product.metadataQuality, 0) / products.length
    : 0;
  const score = Math.round(((completeness * 0.55) + (qualityAverage * 0.45)) * 100);

  return {
    merchantId,
    ok: missingFields.length === 0 && products.length > 0,
    score,
    productCount: products.length,
    missingFields,
    warnings,
    onboardingEstimate: score >= 90 ? "sample-ready" : score >= 75 ? "1-day-pilot" : "needs-api-access",
  };
}

export function previewMerchantAdapters(merchantId?: MerchantId): AdapterPreviewResult {
  const merchants = merchantId
    ? [MERCHANT_PROFILES[merchantId]].filter(Boolean)
    : Object.values(MERCHANT_PROFILES);

  return {
    type: "merchant_adapter_preview",
    merchants,
    coverage: {
      merchantCount: merchants.length,
      sampleProductCount: PRODUCT_CATALOG.filter((product) => merchants.some((merchant) => merchant.merchantId === product.merchantId)).length,
      domains: listDomains(),
    },
    apiMeta: createApiMeta("public_product"),
  };
}

export function validateMerchantMappings(merchantId?: MerchantId): AdapterValidationResult {
  const merchantIds = merchantId ? [merchantId] : Object.keys(MERCHANT_PROFILES) as MerchantId[];
  return {
    type: "merchant_mapping_validation",
    results: merchantIds.map(validateMerchant),
    apiMeta: createApiMeta("public_product"),
  };
}
