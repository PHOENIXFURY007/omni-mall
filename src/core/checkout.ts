import { findProduct } from "./catalog.js";
import { createApiMeta } from "./meta.js";
import type { CheckoutResult } from "../types.js";

function auditId(): string {
  return `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createCheckoutLink(productId: string, confirmed = false): CheckoutResult {
  const product = findProduct(productId) ?? null;
  const createdAt = new Date().toISOString();

  if (!product) {
    return {
      type: "checkout_link",
      ok: false,
      requiresConfirmation: false,
      product: null,
      reason: "Product was not found in the normalized catalog.",
      audit: {
        id: auditId(),
        event: "checkout_blocked",
        policy: "external_redirect_only",
        createdAt,
      },
      apiMeta: createApiMeta("purchase_intent", "session_bound_oauth"),
    };
  }

  if (product.stockStatus === "out_of_stock") {
    return {
      type: "checkout_link",
      ok: false,
      requiresConfirmation: false,
      product,
      reason: "Checkout is blocked because the product is out of stock.",
      audit: {
        id: auditId(),
        event: "checkout_blocked",
        policy: "external_redirect_only",
        createdAt,
      },
      apiMeta: createApiMeta("purchase_intent", "session_bound_oauth"),
    };
  }

  if (!confirmed) {
    return {
      type: "checkout_link",
      ok: true,
      requiresConfirmation: true,
      product,
      reason: "User confirmation is required before opening an external checkout link.",
      audit: {
        id: auditId(),
        event: "checkout_confirmation_required",
        policy: "external_redirect_only",
        createdAt,
      },
      apiMeta: createApiMeta("purchase_intent", "session_bound_oauth"),
    };
  }

  return {
    type: "checkout_link",
    ok: true,
    requiresConfirmation: false,
    product,
    checkoutUrl: product.checkoutUrl ?? product.productUrl,
    reason: "External merchant checkout link created after user confirmation.",
    audit: {
      id: auditId(),
      event: "checkout_link_created",
      policy: "external_redirect_only",
      createdAt,
    },
    apiMeta: createApiMeta("payment_redirect", "session_bound_oauth"),
  };
}
