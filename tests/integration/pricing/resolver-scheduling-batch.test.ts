import { describe, expect, it, vi } from "vitest";
import { resolvePrices } from "@/lib/pricing/resolver";
import type { PricingCatalogTarget } from "@/lib/pricing/types";

describe("scheduled pricing and batching", () => {
  it("loads every resolver dependency once for duplicate targets", async () => {
    const target = { variantId: "variant", sellableUnitId: "unit" };
    const catalog: PricingCatalogTarget = {
      variantId: "variant", productId: "product", sku: "SKU", variantLabelEn: "", variantLabelAr: "", productNameEn: "", productNameAr: "", image: null, isActive: true, stock: 10,
      selectedUnit: { id: "unit", variantId: "variant", parentUnitId: null, code: null, labelEn: "Unit", labelAr: "وحدة", quantityPerParent: { numerator: BigInt(1), denominator: BigInt(1) }, baseQuantity: { numerator: BigInt(1), denominator: BigInt(1) }, isSellable: true, isDefaultSaleUnit: true, isActive: true }, units: [],
    };
    catalog.units = [catalog.selectedUnit];
    const dependencies = {
      getTime: vi.fn(async () => "2026-01-01T00:00:00.000Z"),
      loadCatalogTargets: vi.fn(async () => new Map([["variant:unit", catalog]])),
      loadSources: vi.fn(async () => [{ source: "default_price_list" as const, priceListId: "list" }]),
      loadListCandidates: vi.fn(async () => [{ id: "item", source: "default_price_list" as const, priceListId: "list", variantId: "variant", sellableUnitId: "unit", amountMinor: BigInt(100), currency: "EGP" as const, validFrom: null, validUntil: null }]),
      loadOverrideCandidates: vi.fn(async () => []),
    };
    const result = await resolvePrices({ customerContext: { customerId: null, customerTypeId: null, customerTypeCode: null, directPriceListId: null }, targets: [target, target], dependencies });
    expect(result).toHaveLength(1);
    for (const dependency of Object.values(dependencies)) expect(dependency).toHaveBeenCalledTimes(1);
  });
});
