import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createCheckoutQuote } from "@/lib/commerce/quote";
import type { CommerceContext, CommerceLineSnapshot } from "@/lib/commerce/types";

const variantId = "10000000-0000-4000-8000-000000000005";
const sellableUnitId = "20000000-0000-4000-8000-000000000005";
const cases = [
  { label: "guest", code: "public", scope: "guest", minimum: 1 },
  { label: "Retail", code: "retail", scope: "customer", minimum: 1 },
  { label: "Wholesale", code: "wholesale", scope: "customer", minimum: 6 },
  { label: "Gym", code: "gym_owner", scope: "customer", minimum: 3 },
] as const;

describe("Milestone 1 unified checkout journeys", () => {
  it.each(cases)("quotes the $label journey through the same authoritative path", async ({ code, scope, minimum }) => {
    const customerTypeId = scope === "customer" ? randomUUID() : null;
    const context: CommerceContext = {
      scopeKind: scope, customerId: scope === "customer" ? randomUUID() : null, authUserId: scope === "customer" ? randomUUID() : null,
      guestContextHash: scope === "guest" ? "a".repeat(64) : null, contextKind: scope === "guest" ? "public" : "customer_type",
      customerTypeId, directPriceListId: null, customerTypeCode: code, customerTypeNameEn: code, customerTypeNameAr: code, profileComplete: true,
    };
    const line: CommerceLineSnapshot = {
      variantId, sellableUnitId, quantity: minimum, productId: randomUUID(), productNameEn: "Product", productNameAr: "منتج",
      variantLabelEn: "Variant", variantLabelAr: "نوع", sku: "SKU", unitCode: "BOX", unitLabelEn: "Box", unitLabelAr: "علبة",
      baseQuantityNumerator: "1", baseQuantityDenominator: "1", unitAmountMinor: "10000", lineAmountMinor: String(10000 * minimum), currency: "EGP",
      quantityRule: { ruleId: null, contextKind: context.contextKind, customerTypeId, minimum, increment: 1, eligible: true },
      price: { source: scope === "guest" ? "default_price_list" : "customer_type_price_list", resolutionKind: "explicit", referenceId: randomUUID(), derivedFromUnitId: null },
    };
    const persist = vi.fn(async () => ({ id: randomUUID() }));
    const quote = await createCheckoutQuote({
      lines: [{ variantId, sellableUnitId, quantity: minimum }],
      delivery: { address: { fullName: "Journey User", phone: "01012345678", altPhone: "", governorate: "Cairo", city: "Nasr City", address: "15 Test Street" } },
      contact: null, paymentMethod: "cod", discountCode: null, notes: null,
    }, {
      context,
      normalize: vi.fn(async () => ({ lines: [line], errors: [], correlationId: randomUUID() })),
      shipping: vi.fn(async () => ({ amountMinor: "0", policy: "free_shipping" })),
      discount: vi.fn(async () => []),
      persist,
    });
    expect(quote.context.kind).toBe(context.contextKind);
    expect(quote.lines[0].quantityRule.minimum).toBe(minimum);
    expect(quote.totalMinor).toBe(String(10000 * minimum));
    expect(persist).toHaveBeenCalledOnce();
  });
});
