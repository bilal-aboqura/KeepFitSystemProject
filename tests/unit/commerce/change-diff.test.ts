import { describe, expect, it } from "vitest";
import { diffCommercialDocuments } from "@/lib/commerce/fingerprint";

const line = { variantId: "v", sellableUnitId: "u", quantity: 1, unitAmountMinor: "100", lineAmountMinor: "100", baseQuantityNumerator: "1", baseQuantityDenominator: "1", quantityRule: { minimum: 1, increment: 1, eligible: true } };
const base = { context: { contextKind: "public", customerTypeId: null }, lines: [line], adjustments: [], shipping: { amountMinor: "10", policy: "exact" }, paymentMethod: "cod", totalMinor: "110" };

describe("safe commercial change diff", () => {
  it("maps component changes to stable customer-safe codes", () => {
    const next = { ...base, lines: [{ ...line, unitAmountMinor: "90", lineAmountMinor: "90", quantityRule: { minimum: 2, increment: 2, eligible: false } }], adjustments: [{ kind: "coupon", code: "SAVE", amountMinor: "5" }], shipping: { amountMinor: "25", policy: "exact" }, paymentMethod: "card", totalMinor: "110" };
    expect(diffCommercialDocuments(base, next).map((change) => change.kind)).toEqual(expect.arrayContaining([
      "eligibility_changed", "quantity_rule_changed", "unit_price_changed", "adjustment_changed", "shipping_changed", "payment_changed",
    ]));
  });

  it("reports identity and total changes without exposing protected references", () => {
    const changes = diffCommercialDocuments(base, { ...base, lines: [{ ...line, sellableUnitId: "other" }], totalMinor: "120" });
    expect(changes).toEqual(expect.arrayContaining([{ kind: "line_identity_changed" }, { kind: "total_changed" }]));
    expect(JSON.stringify(changes)).not.toContain("source");
  });
});
