import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer, ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z, type ZodRawShape } from "zod";

import { MERCHANT_IDS, type MerchantId } from "../types.js";
import { previewMerchantAdapters, validateMerchantMappings } from "../core/adapters.js";
import { searchProducts, exploreSimilarProducts } from "../core/catalog.js";
import { compareProducts } from "../core/compare.js";
import { createCheckoutLink } from "../core/checkout.js";
import { formatCurrencyKrw } from "../core/text.js";
import { OMNI_MALL_WIDGET_URI } from "../widget/html.js";

type ToolHandler = ToolCallback<ZodRawShape>;

const merchantIdSchema = z.enum(MERCHANT_IDS);

const searchProductsInputSchema = {
  query: z.string().min(1).describe("Natural language product search query."),
  limit: z.number().int().min(1).max(12).optional().describe("Maximum products to return."),
  merchantIds: z.array(merchantIdSchema).optional().describe("Optional merchant filter."),
  maxPrice: z.number().positive().optional().describe("Maximum product price in KRW."),
  domain: z.string().optional().describe("Optional domain such as beauty, living, fashion, digital, food, or kids."),
  requireInStock: z.boolean().optional().describe("Only return products currently in stock."),
} satisfies ZodRawShape;

const similarProductsInputSchema = {
  productId: z.string().min(1).describe("Seed product id from the normalized OmniMall catalog."),
  limit: z.number().int().min(1).max(10).optional(),
} satisfies ZodRawShape;

const compareProductsInputSchema = {
  productIds: z.array(z.string().min(1)).min(2).max(5).describe("Two to five product ids to compare."),
} satisfies ZodRawShape;

const checkoutInputSchema = {
  productId: z.string().min(1).describe("Product id to create an external checkout link for."),
  confirmed: z.boolean().optional().describe("Set true only after the user confirms checkout handoff."),
} satisfies ZodRawShape;

const merchantInputSchema = {
  merchantId: merchantIdSchema.optional().describe("Optional merchant id to inspect."),
} satisfies ZodRawShape;

function textResult<T extends object>(text: string, structuredContent: T): CallToolResult {
  return {
    content: [{ type: "text", text }],
    structuredContent: structuredContent as Record<string, unknown>,
  };
}

function productLine(product: { merchantName: string; title: string; price: number; stockStatus: string; score?: number }): string {
  const score = product.score === undefined ? "" : `, score ${product.score}`;
  return `- ${product.merchantName}: ${product.title} (${formatCurrencyKrw(product.price)}, ${product.stockStatus}${score})`;
}

function asMerchantId(value: unknown): MerchantId | undefined {
  return MERCHANT_IDS.includes(value as MerchantId) ? value as MerchantId : undefined;
}

function registerSearchProducts(server: McpServer): void {
  registerAppTool(
    server,
    "search_products",
    {
      title: "Search cross-merchant products",
      description: "Search general shopping products across normalized merchants using hybrid keyword, attribute, and graph signals.",
      inputSchema: searchProductsInputSchema,
      annotations: { readOnlyHint: true, openWorldHint: true, destructiveHint: false },
      _meta: {
        ui: { resourceUri: OMNI_MALL_WIDGET_URI, visibility: ["model", "app"] },
        "openai/outputTemplate": OMNI_MALL_WIDGET_URI,
        "openai/widgetAccessible": true,
        "openai/toolInvocation/invoking": "Searching OmniMall products...",
        "openai/toolInvocation/invoked": "OmniMall products ready",
      },
    },
    (async (args: unknown) => {
      const input = args as {
        query: string;
        limit?: number;
        merchantIds?: MerchantId[];
        maxPrice?: number;
        domain?: string;
        requireInStock?: boolean;
      };
      const result = searchProducts(input);
      const lines = [
        `Found ${result.items.length} OmniMall products for "${result.query}".`,
        result.zeroResult.occurred ? result.zeroResult.message : "",
        ...result.items.map(productLine),
      ].filter(Boolean);
      return textResult(lines.join("\n"), result);
    }) as ToolHandler,
  );
}

function registerSimilarProducts(server: McpServer): void {
  registerAppTool(
    server,
    "explore_similar_products",
    {
      title: "Explore similar products",
      description: "Use the product graph to find similar, substitute, and complementary products across merchants.",
      inputSchema: similarProductsInputSchema,
      annotations: { readOnlyHint: true, openWorldHint: true, destructiveHint: false },
      _meta: {
        ui: { resourceUri: OMNI_MALL_WIDGET_URI, visibility: ["model", "app"] },
        "openai/outputTemplate": OMNI_MALL_WIDGET_URI,
        "openai/widgetAccessible": true,
        "openai/toolInvocation/invoking": "Exploring the product graph...",
        "openai/toolInvocation/invoked": "Similar products ready",
      },
    },
    (async (args: unknown) => {
      const input = args as { productId: string; limit?: number };
      const result = exploreSimilarProducts(input.productId, input.limit);
      const lines = result.seed
        ? [
            `Graph exploration from ${result.seed.title}.`,
            ...result.items.map(productLine),
          ]
        : [`Product ${input.productId} was not found.`];
      return textResult(lines.join("\n"), result);
    }) as ToolHandler,
  );
}

function registerCompareProducts(server: McpServer): void {
  registerAppTool(
    server,
    "compare_products",
    {
      title: "Compare products",
      description: "Compare normalized product attributes across two to five OmniMall products.",
      inputSchema: compareProductsInputSchema,
      annotations: { readOnlyHint: true, openWorldHint: true, destructiveHint: false },
      _meta: {
        ui: { resourceUri: OMNI_MALL_WIDGET_URI, visibility: ["model", "app"] },
        "openai/outputTemplate": OMNI_MALL_WIDGET_URI,
        "openai/widgetAccessible": true,
        "openai/toolInvocation/invoking": "Comparing products...",
        "openai/toolInvocation/invoked": "Product comparison ready",
      },
    },
    (async (args: unknown) => {
      const input = args as { productIds: string[] };
      const result = compareProducts(input.productIds);
      const lines = [
        `Compared ${result.products.length} products.`,
        ...result.bestFor.map((item) => `- Best for ${item.label}: ${item.reason}`),
      ];
      return textResult(lines.join("\n"), result);
    }) as ToolHandler,
  );
}

function registerCheckout(server: McpServer): void {
  registerAppTool(
    server,
    "create_checkout_link",
    {
      title: "Create checkout link",
      description: "Create an external merchant checkout link after explicit user confirmation.",
      inputSchema: checkoutInputSchema,
      annotations: { readOnlyHint: false, openWorldHint: true, destructiveHint: false },
      _meta: {
        ui: { resourceUri: OMNI_MALL_WIDGET_URI, visibility: ["model", "app"] },
        "openai/outputTemplate": OMNI_MALL_WIDGET_URI,
        "openai/widgetAccessible": true,
        "openai/toolInvocation/invoking": "Preparing checkout handoff...",
        "openai/toolInvocation/invoked": "Checkout handoff ready",
      },
    },
    (async (args: unknown) => {
      const input = args as { productId: string; confirmed?: boolean };
      const result = createCheckoutLink(input.productId, Boolean(input.confirmed));
      const lines = [
        result.reason,
        result.checkoutUrl ? `Checkout URL: ${result.checkoutUrl}` : "",
      ].filter(Boolean);
      return textResult(lines.join("\n"), result);
    }) as ToolHandler,
  );
}

function registerAdapterPreview(server: McpServer): void {
  registerAppTool(
    server,
    "merchant_adapter_preview",
    {
      title: "Preview merchant adapters",
      description: "Show configured merchant adapters, capabilities, auth mode, and sample catalog coverage.",
      inputSchema: merchantInputSchema,
      annotations: { readOnlyHint: true, openWorldHint: true, destructiveHint: false },
      _meta: {
        ui: { resourceUri: OMNI_MALL_WIDGET_URI, visibility: ["model", "app"] },
        "openai/outputTemplate": OMNI_MALL_WIDGET_URI,
        "openai/toolInvocation/invoking": "Loading merchant adapters...",
        "openai/toolInvocation/invoked": "Merchant adapters ready",
      },
    },
    (async (args: unknown) => {
      const input = args as { merchantId?: unknown };
      const result = previewMerchantAdapters(asMerchantId(input.merchantId));
      const lines = [
        `Adapters: ${result.coverage.merchantCount}; sample products: ${result.coverage.sampleProductCount}.`,
        ...result.merchants.map((merchant) => `- ${merchant.displayName}: ${merchant.status}, ${merchant.authProfile}, ${merchant.capabilities.join(", ")}`),
      ];
      return textResult(lines.join("\n"), result);
    }) as ToolHandler,
  );
}

function registerValidation(server: McpServer): void {
  registerAppTool(
    server,
    "validate_merchant_mapping",
    {
      title: "Validate merchant mapping",
      description: "Validate normalized product schema coverage for one merchant or all configured merchants.",
      inputSchema: merchantInputSchema,
      annotations: { readOnlyHint: true, openWorldHint: true, destructiveHint: false },
      _meta: {
        ui: { resourceUri: OMNI_MALL_WIDGET_URI, visibility: ["model", "app"] },
        "openai/outputTemplate": OMNI_MALL_WIDGET_URI,
        "openai/toolInvocation/invoking": "Validating merchant mapping...",
        "openai/toolInvocation/invoked": "Merchant mapping validation ready",
      },
    },
    (async (args: unknown) => {
      const input = args as { merchantId?: unknown };
      const result = validateMerchantMappings(asMerchantId(input.merchantId));
      const lines = [
        "Merchant mapping validation:",
        ...result.results.map((item) => `- ${item.merchantId}: score ${item.score}, ${item.onboardingEstimate}${item.ok ? "" : ", missing fields: " + item.missingFields.join(", ")}`),
      ];
      return textResult(lines.join("\n"), result);
    }) as ToolHandler,
  );
}

export function registerOmniMallTools(server: McpServer): void {
  registerSearchProducts(server);
  registerSimilarProducts(server);
  registerCompareProducts(server);
  registerCheckout(server);
  registerAdapterPreview(server);
  registerValidation(server);
}
