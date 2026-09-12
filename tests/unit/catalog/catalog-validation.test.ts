import { describe, expect, it } from "vitest";
import { brandInputSchema, catalogProductInputSchema, categoryInputSchema, definingAttributeFingerprint, mediaUploadIntentSchema, skuSchema } from "@/lib/catalog/validation";
import { normalizeCatalogSlug, normalizeCatalogSlugInput } from "@/lib/catalog/slug";
import { catalogApiErrorMessage } from "@/lib/catalog/client-errors";
import { resolveVariantSelection } from "@/components/storefront/variant-selector";
import type { CatalogVariant } from "@/lib/catalog/types";

const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";
const av = "33333333-3333-4333-8333-333333333333";
const bv = "44444444-4444-4444-8444-444444444444";

describe("catalog validation", () => {
  it("normalizes typed slugs and falls back to the English name", () => {
    expect(normalizeCatalogSlug("  Whey Protein 2 LB ")).toBe("whey-protein-2-lb");
    expect(normalizeCatalogSlugInput({ slug: "بروتين", name_en: "Whey Protein" })).toMatchObject({ slug: "whey-protein" });
    expect(normalizeCatalogSlugInput({ name_en: "Changed name" }, false)).toEqual({ name_en: "Changed name" });
    expect(brandInputSchema.parse(normalizeCatalogSlugInput({ slug: "علامة", name_en: "New Brand", name_ar: "علامة جديدة" }))).toMatchObject({ slug: "new-brand" });
    expect(categoryInputSchema.parse(normalizeCatalogSlugInput({ slug: "فئة", name_en: "New Category", name_ar: "فئة جديدة" }))).toMatchObject({ slug: "new-category" });
    expect(catalogApiErrorMessage({ error: "Validation failed", issues: [{ path: ["variants", 0, "sku"], message: "Invalid SKU format" }] }, "ar", "تعذر الحفظ")).toContain("SKU");
  });
  it("normalizes SKU identity and rejects unsafe characters", () => {
    expect(skuSchema.parse(" whey-2lb ")).toBe("WHEY-2LB");
    expect(() => skuSchema.parse("bad sku")).toThrow();
  });

  it("creates a deterministic defining attribute fingerprint", () => {
    const first = definingAttributeFingerprint([{ attribute_definition_id: b, attribute_value_id: bv }, { attribute_definition_id: a, attribute_value_id: av }]);
    const second = definingAttributeFingerprint([{ attribute_definition_id: a, attribute_value_id: av }, { attribute_definition_id: b, attribute_value_id: bv }]);
    expect(first).toBe(second);
    expect(definingAttributeFingerprint([])).toBe("__default__");
  });

  it("requires one active variant for an active product", () => {
    const parsed = catalogProductInputSchema.safeParse({
      slug: "protein-powder", name_en: "Protein Powder", name_ar: "مسحوق بروتين", is_active: true,
      category_id: b,
      variants: [{ sku: "PP-1", base_price: 100, stock: 0, is_active: false }],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects unsupported and oversized media", () => {
    expect(mediaUploadIntentSchema.safeParse({
      product_id: a, file_name: "photo.gif", mime_type: "image/gif",
      byte_size: 11 * 1024 * 1024, width: 100, height: 100,
    }).success).toBe(false);
  });

  it("rejects duplicate definitions and mixed typed values", () => {
    expect(() => definingAttributeFingerprint([
      { attribute_definition_id: a, attribute_value_id: av },
      { attribute_definition_id: a, attribute_value_id: bv },
    ])).toThrow("Duplicate attribute definition");
    expect(() => definingAttributeFingerprint([{ attribute_definition_id: a, attribute_value_id: av, text_value: "also set" }])).toThrow();
  });

  it("resolves only the exact active variant combination", () => {
    const variant = (id: string, valueId: string, active = true) => ({ id, is_active: active, attributes: [{ attribute_definition_id: a, attribute_value_id: valueId }] }) as CatalogVariant;
    const variants = [variant("vanilla", av), variant("chocolate", bv), variant("inactive", "55555555-5555-4555-8555-555555555555", false)];
    expect(resolveVariantSelection(variants, { [a]: bv })?.id).toBe("chocolate");
    expect(resolveVariantSelection(variants, { [a]: "55555555-5555-4555-8555-555555555555" })).toBeNull();
  });
});
