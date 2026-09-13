import { describe, expect, it } from "vitest";
import { calculateLineTotalMinor, deriveUnitAmountMinor, parseMinorAmount } from "@/lib/pricing/money";
import { resolvePricesFromSnapshot } from "@/lib/pricing/resolver";
import type { PricingCandidate, PricingCatalogTarget, PricingSource } from "@/lib/pricing/types";

const variantId = "10000000-0000-4000-8000-000000000005";
const boxId = "20000000-0000-4000-8000-000000000005";

function target(): PricingCatalogTarget {
  const unit = {
    id: boxId,
    variantId,
    parentUnitId: null,
    code: "BOX",
    labelEn: "Box",
    labelAr: "علبة",
    quantityPerParent: { numerator: BigInt(1), denominator: BigInt(1) },
    baseQuantity: { numerator: BigInt(4), denominator: BigInt(1) },
    isSellable: true,
    isDefaultSaleUnit: true,
    isActive: true,
  };
  return {
    variantId,
    productId: "30000000-0000-4000-8000-000000000005",
    sku: "BOX-005",
    variantLabelEn: "10 ml",
    variantLabelAr: "10 مل",
    productNameEn: "Feature 005",
    productNameAr: "الميزة 005",
    image: null,
    isActive: true,
    stock: 100,
    selectedUnit: unit,
    units: [unit],
  };
}

function candidate(source: PricingSource, amountMinor: bigint): PricingCandidate {
  return {
    id: `${source}-candidate`,
    source,
    priceListId: source === "customer_override" ? null : `${source}-list`,
    variantId,
    sellableUnitId: boxId,
    amountMinor,
    currency: "EGP",
    validFrom: null,
    validUntil: null,
  };
}

describe("Feature 004 commerce pricing contract", () => {
  it("uses fixed-point minor units and checked line multiplication", () => {
    expect(parseMinorAmount("10000")).toBe(BigInt(10_000));
    expect(deriveUnitAmountMinor(BigInt(10_000), { numerator: BigInt(4), denominator: BigInt(1) }, { numerator: BigInt(1), denominator: BigInt(1) })).toBe(BigInt(2_500));
    expect(calculateLineTotalMinor(BigInt(2_500), 6)).toBe(BigInt(15_000));
    expect(() => calculateLineTotalMinor(BigInt(2_500), Number.MAX_SAFE_INTEGER)).toThrow(/supported range/);
  });

  it("applies override, direct, type, and public precedence without context fallback", () => {
    const catalog = new Map([[`${variantId}:${boxId}`, target()]]);
    const sources = [
      candidate("default_price_list", BigInt(10_000)),
      candidate("customer_type_price_list", BigInt(9_000)),
      candidate("direct_price_list", BigInt(8_000)),
      candidate("customer_override", BigInt(7_000)),
    ];
    const resolved = resolvePricesFromSnapshot(
      [{ variantId, sellableUnitId: boxId }],
      catalog,
      sources,
      "2026-09-13T00:00:00.000Z",
    )[0];
    expect(resolved).toMatchObject({ availability: "priced", amountMinor: BigInt(7_000), source: "customer_override" });

    const publicOnly = resolvePricesFromSnapshot(
      [{ variantId, sellableUnitId: boxId }],
      catalog,
      [sources[0]],
      "2026-09-13T00:00:00.000Z",
    )[0];
    expect(publicOnly).toMatchObject({ availability: "priced", amountMinor: BigInt(10_000), source: "default_price_list" });
  });
});
