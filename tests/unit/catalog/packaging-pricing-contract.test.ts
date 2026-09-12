import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { buildPackagingPricingTarget, validatePackagingHierarchy } from "@/lib/catalog/packaging";

describe("Feature 004 catalog packaging seam", () => {
  it("returns exact catalog facts without customer or monetary decisions", () => {
    const variantId = randomUUID();
    const boxId = randomUUID();
    const ampouleId = randomUUID();
    const hierarchy = validatePackagingHierarchy([
      { id: boxId, parent_unit_id: null, code: "BOX-4", barcode: null, label_en: "Box", label_ar: "علبة", quantity_per_parent: { numerator: 1, denominator: 1 }, is_base_unit: false, is_sellable: true, is_default_sale_unit: true, default_price_mode: "explicit", is_active: true },
      { id: ampouleId, parent_unit_id: boxId, code: null, barcode: null, label_en: "Ampoule", label_ar: "أمبول", quantity_per_parent: { numerator: 4, denominator: 1 }, is_base_unit: true, is_sellable: true, is_default_sale_unit: false, default_price_mode: "derived", is_active: true },
    ]);
    const target = buildPackagingPricingTarget(variantId, ampouleId, hierarchy);
    expect(target).toMatchObject({ variant_id: variantId, sellable_unit_id: ampouleId, is_sellable: true, base_quantity: { numerator: 1, denominator: 1 } });
    expect(target.conversion_path).toEqual([{ parent_unit_id: boxId, child_unit_id: ampouleId, quantity: { numerator: 4, denominator: 1 } }]);
    expect(JSON.stringify(target)).not.toMatch(/customer|price_list|amount|round/i);
  });

  it("preserves every nearest-parent edge in a three-level path", () => {
    const variantId = randomUUID();
    const boxId = randomUUID();
    const stripId = randomUUID();
    const tabletId = randomUUID();
    const hierarchy = validatePackagingHierarchy([
      { id: boxId, parent_unit_id: null, code: "BOX-5", barcode: null, label_en: "Box", label_ar: "علبة", quantity_per_parent: { numerator: 1, denominator: 1 }, is_base_unit: false, is_sellable: true, is_default_sale_unit: true, default_price_mode: "explicit", is_active: true },
      { id: stripId, parent_unit_id: boxId, code: "STRIP-10", barcode: null, label_en: "Strip", label_ar: "شريط", quantity_per_parent: { numerator: 5, denominator: 1 }, is_base_unit: false, is_sellable: true, is_default_sale_unit: false, default_price_mode: "derived", is_active: true },
      { id: tabletId, parent_unit_id: stripId, code: null, barcode: null, label_en: "Tablet", label_ar: "قرص", quantity_per_parent: { numerator: 10, denominator: 1 }, is_base_unit: true, is_sellable: true, is_default_sale_unit: false, default_price_mode: "derived", is_active: true },
    ]);
    const target = buildPackagingPricingTarget(variantId, tabletId, hierarchy);
    expect(target.base_quantity).toEqual({ numerator: 1, denominator: 1 });
    expect(target.conversion_path).toEqual([
      { parent_unit_id: stripId, child_unit_id: tabletId, quantity: { numerator: 10, denominator: 1 } },
      { parent_unit_id: boxId, child_unit_id: stripId, quantity: { numerator: 5, denominator: 1 } },
    ]);
    expect(target.code).toBeNull();
  });
});
