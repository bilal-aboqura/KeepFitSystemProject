import { describe, expect, it } from "vitest";
import { resolvePricesFromSnapshot } from "@/lib/pricing/resolver";
import type { PricingCandidate, PricingCatalogTarget, PricingSource } from "@/lib/pricing/types";

const variantId = "10000000-0000-4000-8000-000000000001";
const unitId = "20000000-0000-4000-8000-000000000001";
const target: PricingCatalogTarget = {
  variantId,
  productId: "30000000-0000-4000-8000-000000000001",
  sku: "TEST",
  variantLabelEn: "Default",
  variantLabelAr: "افتراضي",
  productNameEn: "Test",
  productNameAr: "اختبار",
  image: null,
  isActive: true,
  stock: 10,
  selectedUnit: {
    id: unitId, variantId, parentUnitId: null, code: "BOX", labelEn: "Box", labelAr: "علبة",
    quantityPerParent: { numerator: BigInt(1), denominator: BigInt(1) },
    baseQuantity: { numerator: BigInt(1), denominator: BigInt(1) }, isSellable: true, isDefaultSaleUnit: true, isActive: true,
  },
  units: [],
};
target.units = [target.selectedUnit];

function candidate(source: PricingSource, amount: number): PricingCandidate {
  return {
    id: `${source}-${amount}`, source, priceListId: source === "customer_override" ? null : `${source}-list`,
    variantId, sellableUnitId: unitId, amountMinor: BigInt(amount), currency: "EGP", validFrom: null, validUntil: null,
  };
}

describe("pricing resolver priority", () => {
  it("uses override, direct, type, and default precedence", () => {
    const candidates = [candidate("default_price_list", 100), candidate("customer_type_price_list", 90), candidate("direct_price_list", 80), candidate("customer_override", 70)];
    expect(resolvePricesFromSnapshot([{ variantId, sellableUnitId: unitId }], new Map([[`${variantId}:${unitId}`, target]]), candidates, "2026-01-01T00:00:00.000Z")[0]).toMatchObject({ availability: "priced", amountMinor: BigInt(70), source: "customer_override" });
  });

  it("falls through missing or expired sources to the default", () => {
    const result = resolvePricesFromSnapshot([{ variantId, sellableUnitId: unitId }], new Map([[`${variantId}:${unitId}`, target]]), [candidate("default_price_list", 100)], "2026-01-01T00:00:00.000Z")[0];
    expect(result).toMatchObject({ availability: "priced", amountMinor: BigInt(100), source: "default_price_list" });
  });

  it("returns unavailable for inactive and unpriced targets", () => {
    expect(resolvePricesFromSnapshot([{ variantId, sellableUnitId: unitId }], new Map(), [], "2026-01-01T00:00:00.000Z")[0]).toMatchObject({ availability: "unavailable", reason: "target_unavailable" });
    expect(resolvePricesFromSnapshot([{ variantId, sellableUnitId: unitId }], new Map([[`${variantId}:${unitId}`, { ...target, isActive: false }]]), [], "2026-01-01T00:00:00.000Z")[0]).toMatchObject({ availability: "unavailable" });
  });
});
