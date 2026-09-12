import { describe, expect, it } from "vitest";
import { resolvePackagingCandidate } from "@/lib/pricing/packaging";
import type { PricingCandidate, PricingCatalogTarget, PricingCatalogUnit } from "@/lib/pricing/types";

function unit(id: string, parentUnitId: string | null, base: number): PricingCatalogUnit {
  return {
    id, variantId: "variant", parentUnitId, code: id, labelEn: id, labelAr: id,
    quantityPerParent: { numerator: BigInt(base), denominator: BigInt(1) },
    baseQuantity: { numerator: BigInt(base), denominator: BigInt(1) },
    isSellable: true, isDefaultSaleUnit: parentUnitId === null, isActive: true,
  };
}

function catalog(units: PricingCatalogUnit[], selected: PricingCatalogUnit): PricingCatalogTarget {
  return { variantId: "variant", productId: "product", sku: "SKU", variantLabelEn: "", variantLabelAr: "", productNameEn: "", productNameAr: "", image: null, isActive: true, stock: 10, selectedUnit: selected, units };
}

function price(unitId: string, amount: number): PricingCandidate {
  return { id: `price-${unitId}`, source: "default_price_list", priceListId: "list", variantId: "variant", sellableUnitId: unitId, amountMinor: BigInt(amount), currency: "EGP", validFrom: null, validUntil: null };
}

describe("packaging price derivation", () => {
  it("prefers an explicit selected-unit price", () => {
    const box = unit("box", null, 4);
    const ampoule = unit("ampoule", "box", 1);
    expect(resolvePackagingCandidate(catalog([box, ampoule], ampoule), [price("box", 100), price("ampoule", 30)])).toMatchObject({ amountMinor: BigInt(30), resolutionKind: "explicit" });
  });

  it("derives Box to Ampoule and nearest Box to Strip to Tablet ancestor", () => {
    const box = unit("box", null, 20);
    const strip = unit("strip", "box", 10);
    const tablet = unit("tablet", "strip", 1);
    expect(resolvePackagingCandidate(catalog([box, strip, tablet], tablet), [price("box", 100)])).toMatchObject({ amountMinor: BigInt(5), derivedFromUnitId: "box" });
    expect(resolvePackagingCandidate(catalog([box, strip, tablet], tablet), [price("box", 100), price("strip", 60)])).toMatchObject({ amountMinor: BigInt(6), derivedFromUnitId: "strip" });
  });

  it("rejects an invalid conversion graph", () => {
    const a = unit("a", "b", 2);
    const b = unit("b", "a", 1);
    expect(() => resolvePackagingCandidate(catalog([a, b], a), [price("b", 100)])).toThrow("invalid");
  });
});
