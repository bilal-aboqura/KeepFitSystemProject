import { describe, expect, it, vi } from "vitest";
import { normalizeCart } from "@/lib/commerce/normalize-cart";
import type { CommerceContext } from "@/lib/commerce/types";
import type { CustomerPricingContext } from "@/lib/pricing/types";

const target = { variantId: "10000000-0000-4000-8000-000000000005", sellableUnitId: "20000000-0000-4000-8000-000000000005", quantity: 1 };
const contexts = [
  ["guest", "public", null], ["retail", "customer_type", "retail"], ["pending", "customer_type", "retail"],
  ["wholesale", "customer_type", "wholesale"], ["gym", "customer_type", "gym_owner"], ["future", "customer_type", "clinic"],
] as const;

describe("B2B commerce context matrix", () => {
  it.each(contexts)("resolves %s with one batch per authority", async (_label, contextKind, code) => {
    const context: CommerceContext = { scopeKind: code ? "customer" : "guest", customerId: code ? "30000000-0000-4000-8000-000000000005" : null, authUserId: null, guestContextHash: code ? null : "a".repeat(64), contextKind, customerTypeId: code ? "40000000-0000-4000-8000-000000000005" : null, directPriceListId: null, customerTypeCode: code ?? "public", customerTypeNameEn: code ?? "Public", customerTypeNameAr: code ?? "عام", profileComplete: true };
    const catalog = vi.fn(async () => new Map([[`${target.variantId}:${target.sellableUnitId}`, { variant_id: target.variantId, product_id: "50000000-0000-4000-8000-000000000005", sellable_unit_id: target.sellableUnitId, sku: "SKU", product_name_en: "Product", product_name_ar: "منتج", variant_label_en: "10 ml", variant_label_ar: "10 مل", unit_code: "BOX", unit_label_en: "Box", unit_label_ar: "علبة", base_quantity: { numerator: 4, denominator: 1 }, is_active: true, is_sellable: true, is_default_sale_unit: true, stock: 20 }]]));
    const prices = vi.fn(async (pricingContext: CustomerPricingContext) => { void pricingContext; return [{ ...target, availability: "priced" as const, amountMinor: BigInt(10000), currency: "EGP" as const, source: "customer_type_price_list" as const, resolutionKind: "derived" as const, priceListId: "60000000-0000-4000-8000-000000000005", priceListItemId: "70000000-0000-4000-8000-000000000005", overrideId: null, derivedFromUnitId: "80000000-0000-4000-8000-000000000005", conversionPath: [target.sellableUnitId], effectiveAt: new Date().toISOString() }]; });
    const rules = vi.fn(async () => new Map([[`${target.variantId}:${target.sellableUnitId}`, { ruleId: null, contextKind, customerTypeId: context.customerTypeId, minimum: 1, increment: 1, eligible: true }]]));
    const result = await normalizeCart([target], context, { catalog, prices, rules });
    expect(result.lines[0].price.resolutionKind).toBe("derived");
    expect(catalog).toHaveBeenCalledOnce(); expect(prices).toHaveBeenCalledOnce(); expect(rules).toHaveBeenCalledOnce();
    expect(prices.mock.calls[0][0].customerTypeCode).toBe(code);
  });
});
