import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { categoryInputSchema } from "./validation";
import { CatalogError, catalogDatabaseError } from "./errors";

export async function listCategories(includeArchived = false) {
  const db = getSupabaseServiceClient();
  if (!db) return [];
  let query = db.from("categories").select("id,slug,name_en,name_ar,image,parent_id,is_active,sort_order,created_at,updated_at").order("sort_order").order("name_en");
  if (!includeArchived) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw catalogDatabaseError(error);
  return data ?? [];
}

export async function createCategory(input: unknown) {
  const value = categoryInputSchema.parse(input);
  const db = getSupabaseServiceClient();
  if (!db) throw new CatalogError("Catalog database is unavailable", 503);
  const { data, error } = await db.from("categories").insert(value).select("*").single();
  if (error) throw catalogDatabaseError(error);
  return data;
}

export async function updateCategory(id: string, input: unknown) {
  const value = categoryInputSchema.partial().parse(input);
  const db = getSupabaseServiceClient();
  if (!db) throw new CatalogError("Catalog database is unavailable", 503);
  const { data, error } = await db.from("categories").update({ ...value, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
  if (error) throw catalogDatabaseError(error);
  return data;
}
