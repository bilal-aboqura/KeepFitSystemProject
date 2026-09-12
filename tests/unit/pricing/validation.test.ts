import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  customerPriceOverrideSchema,
  priceListInputSchema,
  priceListItemInputSchema,
  pricingDiagnosticInputSchema,
  pricingIntervalSchema,
  repriceInputSchema,
} from "@/lib/pricing/validation";

describe("pricing validation", () => {
  const variantId = randomUUID();
  const unitId = randomUUID();

  it("accepts positive bounded EGP prices", () => {
    expect(priceListInputSchema.parse({ code: "wholesale", name_en: "Wholesale", name_ar: "جملة", currency: "EGP", is_active: true }).currency).toBe("EGP");
    expect(priceListItemInputSchema.parse({ variant_id: variantId, sellable_unit_id: unitId, amount_minor: "100" }).amount_minor).toBe("100");
    expect(() => priceListItemInputSchema.parse({ variant_id: variantId, sellable_unit_id: unitId, amount_minor: "0" })).toThrow();
    expect(() => priceListInputSchema.parse({ code: "bad", name_en: "Bad", name_ar: "سيء", currency: "USD" })).toThrow();
  });

  it("requires valid target UUIDs", () => {
    expect(() => priceListItemInputSchema.parse({ variant_id: "variant", sellable_unit_id: unitId, amount_minor: "100" })).toThrow();
    expect(() => customerPriceOverrideSchema.parse({ customer_id: randomUUID(), variant_id: variantId, sellable_unit_id: "unit", amount_minor: "100" })).toThrow();
  });

  it("accepts half-open intervals and rejects reversed bounds", () => {
    expect(pricingIntervalSchema.parse({ valid_from: "2026-01-01T00:00:00.000Z", valid_until: "2026-02-01T00:00:00.000Z" })).toBeTruthy();
    expect(() => pricingIntervalSchema.parse({ valid_from: "2026-02-01T00:00:00.000Z", valid_until: "2026-01-01T00:00:00.000Z" })).toThrow();
  });

  it("rejects client pricing context and timestamps", () => {
    expect(repriceInputSchema.safeParse({ items: [{ variant_id: variantId, sellable_unit_id: unitId, quantity: 2 }], customer_id: randomUUID() }).success).toBe(false);
    expect(pricingDiagnosticInputSchema.parse({ customer_id: randomUUID(), variant_id: variantId, sellable_unit_id: unitId, at: "2026-01-01T00:00:00.000Z" })).toBeTruthy();
  });
});
