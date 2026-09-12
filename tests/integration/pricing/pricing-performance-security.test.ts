import { describe, expect, it, vi } from "vitest";
import { PRICING_CACHE_POLICY, resolvePrices } from "@/lib/pricing/resolver";
import type { CustomerPricingContext, PricingCatalogTarget } from "@/lib/pricing/types";

function catalogTarget(index: number): PricingCatalogTarget {
  const variantId = `variant-${index}`;
  const id = `unit-${index}`;
  const selectedUnit = { id, variantId, parentUnitId: null, code: id, labelEn: id, labelAr: id, quantityPerParent: { numerator: BigInt(1), denominator: BigInt(1) }, baseQuantity: { numerator: BigInt(1), denominator: BigInt(1) }, isSellable: true, isDefaultSaleUnit: true, isActive: true };
  return { variantId, productId: `product-${index}`, sku: `SKU-${index}`, variantLabelEn: "", variantLabelAr: "", productNameEn: "", productNameAr: "", image: null, isActive: true, stock: 10, selectedUnit, units: [selectedUnit] };
}

describe("pricing performance and cache isolation", () => {
  it("batch-resolves a price grid with one call per dependency", async () => {
    const catalog = Array.from({ length: 40 }, (_, index) => catalogTarget(index));
    const dependencies = {
      getTime: vi.fn(async () => "2026-01-01T00:00:00.000Z"),
      loadCatalogTargets: vi.fn(async () => new Map(catalog.map((target) => [`${target.variantId}:${target.selectedUnit.id}`, target]))),
      loadSources: vi.fn(async () => [{ source: "default_price_list" as const, priceListId: "default" }]),
      loadListCandidates: vi.fn(async (_sources: unknown, targets: { variantId: string; sellableUnitId: string }[]) => targets.map((target, index) => ({ id: `item-${index}`, source: "default_price_list" as const, priceListId: "default", variantId: target.variantId, sellableUnitId: target.sellableUnitId, amountMinor: BigInt(100 + index), currency: "EGP" as const, validFrom: null, validUntil: null }))),
      loadOverrideCandidates: vi.fn(async () => []),
    };
    const prices = await resolvePrices({ customerContext: { customerId: null, customerTypeId: null, customerTypeCode: null, directPriceListId: null }, targets: catalog.map((target) => ({ variantId: target.variantId, sellableUnitId: target.selectedUnit.id })), dependencies });
    expect(prices).toHaveLength(40);
    for (const dependency of Object.values(dependencies)) expect(dependency).toHaveBeenCalledTimes(1);
  });

  it("does not share personalized results across mixed Customer contexts", async () => {
    const target = catalogTarget(1);
    const seenCustomers: Array<string | null> = [];
    const makeDependencies = (context: CustomerPricingContext) => ({
      getTime: vi.fn(async () => "2026-01-01T00:00:00.000Z"),
      loadCatalogTargets: vi.fn(async () => new Map([[`${target.variantId}:${target.selectedUnit.id}`, target]])),
      loadSources: vi.fn(async () => [{ source: "direct_price_list" as const, priceListId: context.directPriceListId! }]),
      loadListCandidates: vi.fn(async () => [{ id: `item-${context.customerId}`, source: "direct_price_list" as const, priceListId: context.directPriceListId, variantId: target.variantId, sellableUnitId: target.selectedUnit.id, amountMinor: context.customerId === "customer-a" ? BigInt(100) : BigInt(200), currency: "EGP" as const, validFrom: null, validUntil: null }]),
      loadOverrideCandidates: vi.fn(async (customerId: string | null) => { seenCustomers.push(customerId); return []; }),
    });
    const a = { customerId: "customer-a", customerTypeId: null, customerTypeCode: null, directPriceListId: "list-a" };
    const b = { customerId: "customer-b", customerTypeId: null, customerTypeCode: null, directPriceListId: "list-b" };
    const [priceA] = await resolvePrices({ customerContext: a, targets: [{ variantId: target.variantId, sellableUnitId: target.selectedUnit.id }], dependencies: makeDependencies(a) });
    const [priceB] = await resolvePrices({ customerContext: b, targets: [{ variantId: target.variantId, sellableUnitId: target.selectedUnit.id }], dependencies: makeDependencies(b) });
    expect(priceA.availability === "priced" && priceA.amountMinor).toBe(BigInt(100));
    expect(priceB.availability === "priced" && priceB.amountMinor).toBe(BigInt(200));
    expect(seenCustomers).toEqual(["customer-a", "customer-b"]);
    expect(PRICING_CACHE_POLICY).toMatchObject({ scope: "request", personalized: true, sharedCache: false, activationClock: "database" });
  });
});
