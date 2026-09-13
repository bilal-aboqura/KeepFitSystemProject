import { describe, expect, it } from "vitest";
import { canonicalCommercialJson, commercialFingerprint } from "@/lib/commerce/fingerprint";

const document = {
  version: 1,
  currency: "EGP",
  context: { contextKind: "public", customerTypeId: null, customerTypeCode: "public", customerTypeNameEn: "Public" },
  lines: [
    { variantId: "b", sellableUnitId: "u2", quantity: 2, productNameEn: "Second", image: "/b.webp", unitAmountMinor: "200", lineAmountMinor: "400", baseQuantityNumerator: "1", baseQuantityDenominator: "1", quantityRule: { minimum: 1, increment: 1, eligible: true }, price: { source: "default_price_list", referenceId: "secret" } },
    { variantId: "a", sellableUnitId: "u1", quantity: 1, productNameEn: "First", image: "/a.webp", unitAmountMinor: "100", lineAmountMinor: "100", baseQuantityNumerator: "1", baseQuantityDenominator: "1", quantityRule: { minimum: 1, increment: 1, eligible: true }, price: { source: "default_price_list", referenceId: "secret-2" } },
  ],
  adjustments: [{ kind: "coupon", code: "SAVE", amountMinor: "50", eligible: true }],
  shipping: { policy: "exact", governorate: "Cairo", city: "Nasr City", amountMinor: "50" },
  delivery: { fullName: "Name", phone: "01000000000", address: "Street" },
  paymentMethod: "cod",
  subtotalMinor: "500",
  discountMinor: "50",
  shippingMinor: "50",
  totalMinor: "500",
};

describe("commercial fingerprints", () => {
  it("sorts deterministically and serializes money as base-10 strings", () => {
    const json = canonicalCommercialJson(document);
    expect(json.indexOf('"variantId":"a"')).toBeLessThan(json.indexOf('"variantId":"b"'));
    expect(json).toContain('"totalMinor":"500"');
  });

  it("changes for every commercial component including offsetting changes", () => {
    const original = commercialFingerprint(document);
    const offset = { ...document, discountMinor: "60", shippingMinor: "60", adjustments: [{ ...document.adjustments[0], amountMinor: "60" }], shipping: { ...document.shipping, amountMinor: "60" } };
    expect(commercialFingerprint(offset)).not.toBe(original);
  });

  it("excludes names, images, UI order, and protected source references", () => {
    const displayOnly = { ...document, lines: [...document.lines].reverse().map((line) => ({ ...line, productNameEn: "Changed", image: "/changed.webp", price: { source: "customer_override", referenceId: "other-secret" } })) };
    expect(commercialFingerprint(displayOnly)).toBe(commercialFingerprint(document));
  });
});
