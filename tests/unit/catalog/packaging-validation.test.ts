import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { multiplyRational, normalizeRational, validatePackagingHierarchy } from "@/lib/catalog/packaging";

function unit(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(), parent_unit_id: null, code: null, barcode: null,
    label_en: "Unit", label_ar: "وحدة",
    quantity_per_parent: { numerator: 1, denominator: 1 },
    is_base_unit: false, is_sellable: true, is_default_sale_unit: false,
    default_price_mode: "derived", is_active: true, ...overrides,
  };
}

describe("catalog packaging validation", () => {
  it("normalizes and multiplies exact rationals", () => {
    expect(normalizeRational({ numerator: 10, denominator: 4 })).toEqual({ numerator: 5, denominator: 2 });
    expect(multiplyRational({ numerator: 5, denominator: 2 }, { numerator: 6, denominator: 5 })).toEqual({ numerator: 3, denominator: 1 });
  });

  it("resolves Box -> Strip -> Tablet to exact base quantities", () => {
    const box = unit({ label_en: "Box", is_sellable: true, is_default_sale_unit: true });
    const strip = unit({ label_en: "Strip", parent_unit_id: box.id, quantity_per_parent: { numerator: 5, denominator: 1 }, is_sellable: true });
    const tablet = unit({ label_en: "Tablet", parent_unit_id: strip.id, quantity_per_parent: { numerator: 10, denominator: 1 }, is_base_unit: true, is_sellable: false });
    const result = validatePackagingHierarchy([box, strip, tablet]);
    expect(Object.fromEntries(result.map((item) => [item.label_en, item.base_quantity]))).toEqual({ Box: { numerator: 50, denominator: 1 }, Strip: { numerator: 10, denominator: 1 }, Tablet: { numerator: 1, denominator: 1 } });
  });

  it("requires one base, one root, and one default sellable unit", () => {
    const single = unit({ is_base_unit: true, is_default_sale_unit: true });
    expect(validatePackagingHierarchy([single])[0].base_quantity).toEqual({ numerator: 1, denominator: 1 });
    expect(() => validatePackagingHierarchy([{ ...single, is_sellable: false }])).toThrow(/default.*sellable/i);
    expect(() => validatePackagingHierarchy([{ ...single, quantity_per_parent: { numerator: 0, denominator: 1 } }])).toThrow(/positive/i);
  });

  it("rejects cycles and ambiguous child paths", () => {
    const first = unit({ is_default_sale_unit: true });
    const second = unit({ parent_unit_id: first.id, is_base_unit: true });
    expect(() => validatePackagingHierarchy([{ ...first, parent_unit_id: second.id }, second])).toThrow(/root|cycle/i);
    const other = unit({ parent_unit_id: first.id });
    expect(() => validatePackagingHierarchy([first, second, other])).toThrow(/ambiguous/i);
  });

  it("rejects negative, self-referencing, and disconnected conversions", () => {
    const root = unit({ is_default_sale_unit: true });
    const base = unit({ parent_unit_id: root.id, is_base_unit: true });
    expect(() => validatePackagingHierarchy([{ ...root, quantity_per_parent: { numerator: -1, denominator: 1 } }, base])).toThrow(/positive/i);
    expect(() => validatePackagingHierarchy([root, { ...base, parent_unit_id: base.id }])).toThrow(/itself|root/i);
    expect(() => validatePackagingHierarchy([root, { ...base, parent_unit_id: randomUUID() }])).toThrow(/disconnected/i);
  });
});
