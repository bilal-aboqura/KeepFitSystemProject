import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { catalogProductFieldsSchema, catalogProductInputSchema } from "./validation";
import { CatalogError, catalogDatabaseError } from "./errors";

const productUpdateSchema = catalogProductFieldsSchema.partial();

export async function createCatalogProduct(input: unknown, actorId: string | null) {
  const value = catalogProductInputSchema.parse(input);
  const db = getSupabaseServiceClient();
  if (!db) throw new CatalogError("Catalog database is unavailable", 503);
  const [{ data: category }, brandResult] = await Promise.all([
    db.from("categories").select("id").eq("id", value.category_id).eq("is_active", true).maybeSingle(),
    value.brand_id ? db.from("brands").select("id").eq("id", value.brand_id).eq("is_active", true).is("archived_at", null).maybeSingle() : Promise.resolve({ data: { id: null } }),
  ]);
  if (!category) throw new CatalogError("An active category is required", 422);
  if (value.brand_id && !brandResult.data) throw new CatalogError("Brand is inactive or unknown", 422);
  const { data, error } = await db.rpc("catalog_create_product", { p_product: value, p_actor_id: actorId });
  if (error) throw catalogDatabaseError(error);
  return data as { product_id: string; variant_ids: string[] };
}

export async function updateCatalogProduct(id: string, input: unknown, actorId: string | null) {
  const value = productUpdateSchema.parse(input);
  const db = getSupabaseServiceClient();
  if (!db) throw new CatalogError("Catalog database is unavailable", 503);
  if (value.is_active) {
    const { count } = await db.from("product_variants").select("id", { count: "exact", head: true }).eq("product_id", id).eq("is_active", true).is("archived_at", null);
    if (!count) throw new CatalogError("An active product requires an active variant", 409, "product_not_sellable");
  }
  const { data: previous } = await db.from("products").select("*").eq("id", id).maybeSingle();
  if (!previous) throw new CatalogError("Product not found", 404);
  const { data, error } = await db.from("products").update({ ...value, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
  if (error) throw catalogDatabaseError(error);
  await db.from("catalog_audit_events").insert({ actor_id: actorId, action: "product.updated", target_type: "product", target_id: id, previous_state: previous, new_state: data });
  return data;
}

export async function archiveCatalogProduct(id: string, actorId: string | null) {
  const db = getSupabaseServiceClient();
  if (!db) throw new CatalogError("Catalog database is unavailable", 503);
  const archivedAt = new Date().toISOString();
  const { data: previous } = await db.from("products").select("*").eq("id", id).maybeSingle();
  if (!previous) throw new CatalogError("Product not found", 404);
  const { error } = await db.from("products").update({ is_active: false, archived_at: archivedAt, updated_at: archivedAt }).eq("id", id);
  if (error) throw catalogDatabaseError(error);
  await db.from("catalog_audit_events").insert({ actor_id: actorId, action: "product.archived", target_type: "product", target_id: id, previous_state: previous, new_state: { is_active: false, archived_at: archivedAt } });
}
