import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ resolvePrices: vi.fn(), getCurrentPricingContext: vi.fn() }));
vi.mock("@/lib/pricing/resolver", () => ({ resolvePrices: mocks.resolvePrices }));
vi.mock("@/lib/pricing/context", () => ({ getCurrentPricingContext: mocks.getCurrentPricingContext }));

import { POST } from "@/app/api/pricing/reprice/route";

describe("public pricing reprice API", () => {
  const variantId = "10000000-0000-4000-8000-000000000001";
  const sellableUnitId = "20000000-0000-4000-8000-000000000001";

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentPricingContext.mockResolvedValue({ customerId: null, customerTypeId: null, customerTypeCode: null, directPriceListId: null });
    mocks.resolvePrices.mockResolvedValue([{ variantId, sellableUnitId, availability: "priced", amountMinor: BigInt(100), currency: "EGP", source: "default_price_list", resolutionKind: "explicit", priceListId: "protected", priceListItemId: "protected", overrideId: null, derivedFromUnitId: null, conversionPath: [], effectiveAt: "2026-01-01T00:00:00.000Z" }]);
  });

  it("rejects browser Customer, type, List, price, and timestamp authority", async () => {
    for (const extra of [{ customer_id: variantId }, { customer_type_id: variantId }, { price_list_id: variantId }, { at: "2026-01-01T00:00:00.000Z" }]) {
      const response = await POST(new Request("http://localhost/api/pricing/reprice", { method: "POST", body: JSON.stringify({ items: [{ variant_id: variantId, sellable_unit_id: sellableUnitId, quantity: 1 }], ...extra }) }));
      expect(response.status).toBe(422);
    }
  });

  it("returns only a safe current-context projection", async () => {
    const response = await POST(new Request("http://localhost/api/pricing/reprice", { method: "POST", body: JSON.stringify({ items: [{ variant_id: variantId, sellable_unit_id: sellableUnitId, quantity: 2 }] }) }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items[0]).toMatchObject({ amountMinor: "100", lineAmountMinor: "200", availability: "priced" });
    expect(JSON.stringify(body)).not.toContain("protected");
  });
});
