import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { normalizeCart } from "@/lib/commerce/normalize-cart";
import { cartQuoteInputSchema } from "@/lib/commerce/validation";
import type { CommerceContext } from "@/lib/commerce/types";
import type { CustomerPricingContext } from "@/lib/pricing/types";

const context: CommerceContext = {
  scopeKind: "guest", customerId: null, authUserId: null, guestContextHash: "a".repeat(64),
  contextKind: "public", customerTypeId: null, directPriceListId: null, customerTypeCode: "public",
  customerTypeNameEn: "Public", customerTypeNameAr: "عام", profileComplete: true,
};

function dependencies() {
  const catalog = vi.fn(async (targets: { variantId: string; sellableUnitId: string }[]) => new Map(targets.map((target) => [`${target.variantId}:${target.sellableUnitId}`, {
    variant_id: target.variantId, product_id: randomUUID(), sellable_unit_id: target.sellableUnitId, sku: `SKU-${target.variantId}`,
    product_name_en: "Product", product_name_ar: "منتج", variant_label_en: "Variant", variant_label_ar: "نوع",
    unit_code: "BOX", unit_label_en: "Box", unit_label_ar: "علبة", base_quantity: { numerator: 1, denominator: 1 },
    is_active: true, is_sellable: true, is_default_sale_unit: true, stock: 1000,
  }])));
  const prices = vi.fn(async (_context: CustomerPricingContext, targets: { variantId: string; sellableUnitId: string }[]) => targets.map((target) => ({
    ...target, availability: "priced" as const, amountMinor: BigInt(10000), currency: "EGP" as const,
    source: "default_price_list" as const, resolutionKind: "explicit" as const, priceListId: randomUUID(),
    priceListItemId: randomUUID(), overrideId: null, derivedFromUnitId: null, conversionPath: [], effectiveAt: new Date().toISOString(),
  })));
  const rules = vi.fn(async (_context: CommerceContext, lines: { variantId: string; sellableUnitId: string }[]) => new Map(lines.map((line) => [`${line.variantId}:${line.sellableUnitId}`, {
    ruleId: null, contextKind: "public" as const, customerTypeId: null, minimum: 1, increment: 1, eligible: true,
  }])));
  return { catalog, prices, rules };
}

describe("commerce batch and input limits", () => {
  it.each([25, 100])("normalizes %i distinct lines with one call per authority", async (count) => {
    const lines = Array.from({ length: count }, () => ({ variantId: randomUUID(), sellableUnitId: randomUUID(), quantity: 1 }));
    const batch = dependencies();
    const result = await normalizeCart(lines, context, batch);
    expect(result.lines).toHaveLength(count);
    expect(batch.catalog).toHaveBeenCalledOnce();
    expect(batch.prices).toHaveBeenCalledOnce();
    expect(batch.rules).toHaveBeenCalledOnce();
  });

  it("accepts 100 lines and rejects the 101st before any authority call", () => {
    const lines = Array.from({ length: 101 }, () => ({ variantId: randomUUID(), sellableUnitId: randomUUID(), quantity: 1 }));
    expect(cartQuoteInputSchema.safeParse({ lines: lines.slice(0, 100) }).success).toBe(true);
    expect(cartQuoteInputSchema.safeParse({ lines }).success).toBe(false);
  });
});
