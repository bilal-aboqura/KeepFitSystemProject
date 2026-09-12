import { z } from "zod";
import { normalizeCatalogSlug } from "./slug";

const trimmed = (min: number, max: number) => z.string().trim().min(min).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional().default("");
export const catalogSlugSchema = z.string().trim().max(160)
  .transform(normalizeCatalogSlug)
  .pipe(z.string().min(1, "Enter an English name or an English URL slug").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase English letters, numbers, and hyphens only"));

export const skuSchema = trimmed(1, 80)
  .transform((value) => value.toUpperCase())
  .refine((value) => /^[A-Z0-9][A-Z0-9._/-]*$/.test(value), "Invalid SKU format");

export const attributeAssignmentSchema = z.object({
  attribute_definition_id: z.string().uuid(),
  attribute_value_id: z.string().uuid().nullable().optional(),
  text_value: z.string().trim().max(500).nullable().optional(),
  number_value: z.number().finite().nullable().optional(),
  boolean_value: z.boolean().nullable().optional(),
}).superRefine((value, context) => {
  const populated = [
    value.attribute_value_id,
    value.text_value === "" ? null : value.text_value,
    value.number_value,
    value.boolean_value,
  ].filter((item) => item !== null && item !== undefined);
  if (populated.length !== 1) {
    context.addIssue({ code: "custom", message: "Exactly one attribute value is required" });
  }
});

export const catalogVariantInputSchema = z.object({
  id: z.string().uuid().optional(),
  sku: skuSchema,
  barcode: z.string().trim().max(120).nullable().optional(),
  label_en: z.string().trim().max(160).optional().default(""),
  label_ar: z.string().trim().max(160).optional().default(""),
  base_price: z.number().finite().nonnegative(),
  compare_at_price: z.number().finite().nonnegative().nullable().optional(),
  stock: z.number().int().nonnegative(),
  is_default: z.boolean().optional().default(false),
  is_active: z.boolean().optional().default(true),
  attributes: z.array(attributeAssignmentSchema).max(20).optional().default([]),
});

export const catalogRationalSchema = z.object({
  numerator: z.number().int().positive("Packaging conversion values must be positive").max(1_000_000_000),
  denominator: z.number().int().positive("Packaging conversion values must be positive").max(1_000_000_000),
});

export const packagingUnitInputSchema = z.object({
  id: z.string().uuid(),
  parent_unit_id: z.string().uuid().nullable().default(null),
  code: z.string().trim().min(1).max(80).transform((value) => value.toUpperCase()).nullable().optional().default(null),
  barcode: z.string().trim().min(1).max(120).nullable().optional().default(null),
  label_en: trimmed(1, 120),
  label_ar: trimmed(1, 120),
  quantity_per_parent: catalogRationalSchema,
  is_base_unit: z.boolean().default(false),
  is_sellable: z.boolean().default(false),
  is_default_sale_unit: z.boolean().default(false),
  default_price_mode: z.enum(["explicit", "derived"]).default("derived"),
  is_active: z.boolean().default(true),
});

export const packagingHierarchyInputSchema = z.array(packagingUnitInputSchema).min(1).max(32);

export const catalogProductFieldsSchema = z.object({
  slug: catalogSlugSchema,
  category_id: z.string().uuid(),
  brand_id: z.string().uuid().nullable().optional(),
  name_en: trimmed(1, 200),
  name_ar: trimmed(1, 200),
  short_desc_en: optionalText(500),
  short_desc_ar: optionalText(500),
  long_desc_en: optionalText(10_000),
  long_desc_ar: optionalText(10_000),
  is_active: z.boolean().optional().default(true),
  is_featured: z.boolean().optional().default(false),
  seo_title_en: z.string().trim().max(200).nullable().optional(),
  seo_title_ar: z.string().trim().max(200).nullable().optional(),
  seo_description_en: z.string().trim().max(500).nullable().optional(),
  seo_description_ar: z.string().trim().max(500).nullable().optional(),
});

export const catalogProductInputSchema = catalogProductFieldsSchema.extend({
  specifications: z.array(attributeAssignmentSchema).max(50).optional().default([]),
  variants: z.array(catalogVariantInputSchema).min(1).max(250),
}).superRefine((value, context) => {
  if (value.is_active && !value.variants.some((variant) => variant.is_active)) {
    context.addIssue({ code: "custom", path: ["variants"], message: "An active product requires an active variant" });
  }
  if (value.variants.filter((variant) => variant.is_default && variant.is_active).length > 1) {
    context.addIssue({ code: "custom", path: ["variants"], message: "Only one active default variant is allowed" });
  }
});

export const categoryInputSchema = z.object({
  slug: catalogSlugSchema,
  name_en: trimmed(1, 160),
  name_ar: trimmed(1, 160),
  parent_id: z.string().uuid().nullable().optional(),
  image: z.string().trim().max(2_000).nullable().optional(),
  is_active: z.boolean().optional().default(true),
  sort_order: z.number().int().min(0).optional().default(0),
});

export const brandInputSchema = z.object({
  slug: catalogSlugSchema,
  name_en: trimmed(1, 160),
  name_ar: trimmed(1, 160),
  description_en: optionalText(2_000),
  description_ar: optionalText(2_000),
  is_active: z.boolean().optional().default(true),
});

export const attributeDefinitionInputSchema = z.object({
  code: trimmed(1, 80).regex(/^[a-z][a-z0-9_]*$/),
  label_en: trimmed(1, 160),
  label_ar: trimmed(1, 160),
  value_type: z.enum(["option", "text", "number", "boolean"]),
  unit: z.string().trim().max(40).nullable().optional(),
  is_variant_defining: z.boolean().optional().default(false),
  is_filterable: z.boolean().optional().default(false),
  is_visible: z.boolean().optional().default(true),
  is_active: z.boolean().optional().default(true),
  sort_order: z.number().int().min(0).optional().default(0),
});

export const attributeValueInputSchema = z.object({
  attribute_definition_id: z.string().uuid(),
  code: trimmed(1, 80).regex(/^[a-z0-9][a-z0-9_-]*$/),
  label_en: trimmed(1, 160),
  label_ar: trimmed(1, 160),
  sort_order: z.number().int().min(0).optional().default(0),
  is_active: z.boolean().optional().default(true),
});

export const mediaUploadIntentSchema = z.object({
  product_id: z.string().uuid(),
  variant_id: z.string().uuid().nullable().optional(),
  file_name: trimmed(1, 240),
  mime_type: z.enum(["image/jpeg", "image/png", "image/webp", "image/avif"]),
  byte_size: z.number().int().positive().max(10 * 1024 * 1024),
  width: z.number().int().min(64).max(8_000),
  height: z.number().int().min(64).max(8_000),
});

export const mediaConfirmSchema = mediaUploadIntentSchema.extend({
  media_id: z.string().uuid(),
  object_key: trimmed(1, 1_000),
  alt_en: z.string().trim().max(300).optional().default(""),
  alt_ar: z.string().trim().max(300).optional().default(""),
  sort_order: z.number().int().min(0).optional().default(0),
  is_primary: z.boolean().optional().default(false),
}).omit({ file_name: true });

function assignmentIdentity(value: z.infer<typeof attributeAssignmentSchema>) {
  if (value.attribute_value_id) return `o:${value.attribute_value_id}`;
  if (value.number_value !== null && value.number_value !== undefined) return `n:${value.number_value}`;
  if (value.boolean_value !== null && value.boolean_value !== undefined) return `b:${value.boolean_value ? 1 : 0}`;
  return `t:${(value.text_value ?? "").normalize("NFKC").trim().toLocaleLowerCase("en-US")}`;
}

export function definingAttributeFingerprint(
  assignments: z.infer<typeof attributeAssignmentSchema>[],
): string {
  if (assignments.length === 0) return "__default__";
  const seen = new Set<string>();
  const parts = assignments.map((assignment) => {
    const parsed = attributeAssignmentSchema.parse(assignment);
    if (seen.has(parsed.attribute_definition_id)) throw new Error("Duplicate attribute definition");
    seen.add(parsed.attribute_definition_id);
    return `${parsed.attribute_definition_id}:${assignmentIdentity(parsed)}`;
  });
  return parts.sort((a, b) => a.localeCompare(b)).join("|");
}
