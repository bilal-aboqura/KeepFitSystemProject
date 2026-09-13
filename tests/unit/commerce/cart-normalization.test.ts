import { describe, expect, it } from "vitest";
import { mergeCartIntent, parseCartStorage } from "@/lib/cart";

const base = {
  id: "variant:box",
  variant_id: "10000000-0000-4000-8000-000000000005",
  sellable_unit_id: "20000000-0000-4000-8000-000000000005",
  slug: "product",
  name_en: "Product",
  name_ar: "منتج",
  price: 100,
  image: "/test.webp",
  quantity: 1,
};

describe("browser cart intent normalization", () => {
  it("merges only the same Variant and Sellable Unit", () => {
    const box = mergeCartIntent([], base);
    const merged = mergeCartIntent(box, { ...base, id: "ignored", quantity: 2 });
    const ampoule = mergeCartIntent(merged, { ...base, id: "variant:ampoule", sellable_unit_id: "30000000-0000-4000-8000-000000000005", quantity: 4 });
    expect(ampoule).toHaveLength(2);
    expect(ampoule.map((item) => item.quantity)).toEqual([3, 4]);
  });

  it("uses checked quantity addition", () => {
    expect(() => mergeCartIntent([{ ...base, quantity: Number.MAX_SAFE_INTEGER }], base)).toThrow();
  });

  it("retains legacy and unavailable rows as blocked recovery intent", () => {
    const [legacy] = parseCartStorage(JSON.stringify([{ ...base, variant_id: undefined, sellable_unit_id: undefined }]));
    expect(legacy.intent_status).toBe("legacy_selection_required");
    const [unavailable] = parseCartStorage(JSON.stringify([{ ...base, intent_status: "unavailable" }]));
    expect(unavailable.intent_status).toBe("unavailable");
  });

  it("rejects malformed storage without inventing an identity", () => {
    expect(parseCartStorage("not json")).toEqual([]);
    expect(parseCartStorage(JSON.stringify({ items: "bad" }))).toEqual([]);
  });
});
