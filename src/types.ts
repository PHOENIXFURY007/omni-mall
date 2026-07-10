export const MERCHANT_IDS = [
  "shinsegae",
  "lotte",
  "lotte-himart",
  "olive-young",
  "daiso",
  "amore-pacific",
] as const;

export type MerchantId = (typeof MERCHANT_IDS)[number];

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

export type AccessClass =
  | "public_product"
  | "account_context"
  | "purchase_intent"
  | "payment_redirect";

export type AuthMode = "none" | "api_key" | "oauth2" | "oauth2_pkce" | "session_bound_oauth";

export interface MerchantProfile {
  merchantId: MerchantId;
  displayName: string;
  aliases: string[];
  sourceType: "sample_catalog" | "partner_api" | "markdown_spec" | "marketplace_api";
  status: "sample_ready" | "pilot_ready" | "needs_credentials";
  authProfile: AuthMode;
  capabilities: string[];
  requiredFields: string[];
  notes: string[];
}

export interface Product {
  merchantId: MerchantId;
  merchantName: string;
  productId: string;
  sku: string;
  title: string;
  brand: string;
  domain: string;
  categoryPath: string[];
  attributes: Record<string, string | number | boolean | string[]>;
  price: number;
  currency: "KRW";
  stockStatus: StockStatus;
  rating: number;
  reviewCount: number;
  tags: string[];
  productUrl: string;
  checkoutUrl?: string;
  imageUrl?: string;
  metadataQuality: number;
  sourceUpdatedAt: string;
}

export interface RankedProduct extends Product {
  score: number;
  scoreBreakdown: Record<string, number>;
  why: string[];
}

export interface ProductGraphEdge {
  sourceProductId: string;
  targetProductId: string;
  relation: "similar" | "substitute" | "complement";
  weight: number;
  reason: string;
}

export interface ToolApiMeta {
  demonstrationPlatform: "chatgpt_apps_sdk";
  compatibleProviders: Array<"openai_agents_sdk" | "claude_agent_sdk" | "google_adk">;
  protocols: Array<"mcp" | "a2a">;
  p95TargetMs: number;
  authMode: AuthMode;
  accessClass: AccessClass;
  generatedAt: string;
}

export interface SearchProductsInput {
  query: string;
  limit?: number;
  merchantIds?: MerchantId[];
  maxPrice?: number;
  domain?: string;
  requireInStock?: boolean;
}

export interface ZeroResultState {
  occurred: boolean;
  recovered: boolean;
  relaxedConstraints: string[];
  message: string;
}

export interface SearchProductsResult {
  type: "product_search";
  query: string;
  items: RankedProduct[];
  graph: ProductGraphEdge[];
  zeroResult: ZeroResultState;
  metrics: {
    durationMs: number;
    resultCount: number;
    p95TargetMs: number;
  };
  apiMeta: ToolApiMeta;
}

export interface SimilarProductsResult {
  type: "similar_products";
  seed: Product | null;
  items: RankedProduct[];
  graph: ProductGraphEdge[];
  metrics: {
    durationMs: number;
    resultCount: number;
    p95TargetMs: number;
  };
  apiMeta: ToolApiMeta;
}

export interface CompareProductsResult {
  type: "product_comparison";
  products: Product[];
  comparisonRows: Array<{
    label: string;
    values: Record<string, string>;
  }>;
  bestFor: Array<{
    productId: string;
    label: string;
    reason: string;
  }>;
  apiMeta: ToolApiMeta;
}

export interface CheckoutResult {
  type: "checkout_link";
  ok: boolean;
  requiresConfirmation: boolean;
  product: Product | null;
  checkoutUrl?: string;
  reason: string;
  audit: {
    id: string;
    event: "checkout_confirmation_required" | "checkout_link_created" | "checkout_blocked";
    policy: "external_redirect_only";
    createdAt: string;
  };
  apiMeta: ToolApiMeta;
}

export interface AdapterPreviewResult {
  type: "merchant_adapter_preview";
  merchants: MerchantProfile[];
  coverage: {
    merchantCount: number;
    sampleProductCount: number;
    domains: string[];
  };
  apiMeta: ToolApiMeta;
}

export interface AdapterValidationResult {
  type: "merchant_mapping_validation";
  results: Array<{
    merchantId: MerchantId;
    ok: boolean;
    score: number;
    productCount: number;
    missingFields: string[];
    warnings: string[];
    onboardingEstimate: "sample-ready" | "1-day-pilot" | "needs-api-access";
  }>;
  apiMeta: ToolApiMeta;
}
