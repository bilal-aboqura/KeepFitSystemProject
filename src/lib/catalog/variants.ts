import "server-only";
import { z } from "zod";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { catalogVariantInputSchema, skuSchema } from "./validation";
import { CatalogError, catalogDatabaseError } from "./errors";

const safeVariantUpdateSchema = z.object({
  sku: skuSchema.optional(),
  barcode: z.string().trim().max(120).nullable().optional(),
  label_en: z.string().trim().max(160).optional(),
  label_ar: z.string().trim().max(160).optional(),
  base_price: z.number().nonnegative().optional(),
  compare_at_price: z.number().nonnegative().nullable().optional(),
  stock: z.number().int().nonnegative().optional(),
  is_default: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

export async function createCatalogVariant(productId: string, input: unknown, actorId: string | null) {
  const value = catalogVariantInputSchema.parse(input);
  const db = getSupabaseServiceClient();
  if (!db) throw new CatalogError("Catalog database is unavailable", 503);
  const { data, error } = await db.rpc("catalog_create_variant", { p_product_id: productId, p_variant: value, p_actor_id: actorId });
  if (error) throw catalogDatabaseError(error);
  return data as string;
}

export async function updateCatalogVariant(id: string, input: unknown, actorId: string | null) {
  const value = safeVariantUpdateSchema.parse(input);
  const db = getSupabaseServiceClient();
  if (!db) throw new CatalogError("Catalog database is unavailable", 503);
  const { data: previous } = await db.from("product_variants").select("*").eq("id", id).maybeSingle();
  if (!previous) throw new CatalogError("Variant not found", 404);
  if (value.sku && value.sku !== previous.sku) {
    const { count } = await db.from("order_items").select("id", { count: "exact", head: true }).eq("variant_id", id);
    if (count) throw new CatalogError("A purchased variant must be archived and replaced before changing its SKU", 409, "variant_identity_conflict");
  }
  const { data, error } = await db.from("product_variants").update({ ...value, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
  if (error) throw catalogDatabaseError(error);
  await db.from("catalog_audit_events").insert({ actor_id: actorId, action: "variant.updated", target_type: "variant", target_id: id, previous_state: previous, new_state: data });
  return data;
}

export async function archiveCatalogVariant(id: string, actorId: string | null) {
  const db = getSupabaseServiceClient();
  if (!db) throw new CatalogError("Catalog database is unavailable", 503);
  const { error } = await db.rpc("catalog_archive_variant", { p_variant_id: id, p_actor_id: actorId });
  if (error) throw catalogDatabaseError(error);
}

export async function resolvePurchasableVariants(ids: string[]) {
  const db = getSupabaseServiceClient();
  if (!db || ids.length === 0) return [];
  const { data, error } = await db.from("product_variants")
    .select("id,product_id,sku,label_en,label_ar,base_price,compare_at_price,stock,is_active,archived_at,product:products!inner(id,slug,name_en,name_ar,is_active,archived_at,images)")
    .in("id", ids).eq("is_active", true).is("archived_at", null).eq("product.is_active", true).is("product.archived_at", null);
  if (error) throw catalogDatabaseError(error);
  return data ?? [];
}
