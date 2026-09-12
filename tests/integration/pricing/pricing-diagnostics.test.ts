import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ resolvePrices: vi.fn(), getCustomerPricingContext: vi.fn() }));
vi.mock("@/lib/pricing/resolver", () => ({ resolvePrices: mocks.resolvePrices }));
vi.mock("@/lib/pricing/context", () => ({ getCustomerPricingContext: mocks.getCustomerPricingContext, GUEST_PRICING_CONTEXT: { customerId: null, customerTypeId: null, customerTypeCode: null, directPriceListId: null } }));

import { diagnosePrice } from "@/lib/pricing/diagnostics";

describe("pricing diagnostics", () => {
  it("returns a trusted explicit/derived source trace without mutation", async () => {
    mocks.getCustomerPricingContext.mockResolvedValue({ customerId: "customer", customerTypeId: "type", customerTypeCode: "wholesale", directPriceListId: null });
    mocks.resolvePrices.mockResolvedValue([{ variantId: "variant", sellableUnitId: "unit", availability: "priced", amountMinor: BigInt(25), currency: "EGP", source: "customer_type_price_list", resolutionKind: "derived", priceListId: "list", priceListItemId: "item", overrideId: null, derivedFromUnitId: "box", conversionPath: ["box"], effectiveAt: "2026-01-01T00:00:00.000Z" }]);
    const result = await diagnosePrice({ customerId: "customer", variantId: "variant", sellableUnitId: "unit", at: "2026-01-01T00:00:00.000Z" });
    expect(result).toMatchObject({ effectiveAt: "2026-01-01T00:00:00.000Z", result: { source: "customer_type_price_list", resolutionKind: "derived" } });
    expect(result.steps.some((step) => step.source === "customer_type_price_list" && step.result === "derived")).toBe(true);
  });
});
