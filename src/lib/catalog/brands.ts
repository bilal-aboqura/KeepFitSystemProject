import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { brandInputSchema } from "./validation";
import { CatalogError, catalogDatabaseError } from "./errors";

export async function listBrands(includeArchived = false) {
  const db = getSupabaseServiceClient();
  if (!db) return [];
  let query = db.from("brands").select("*").order("name_en");
  if (!includeArchived) query = query.eq("is_active", true).is("archived_at", null);
  const { data, error } = await query;
  if (error) throw catalogDatabaseError(error);
  return data ?? [];
}

export async function createBrand(input: unknown) {
  const value = brandInputSchema.parse(input);
  const db = getSupabaseServiceClient();
  if (!db) throw new CatalogError("Catalog database is unavailable", 503);
  const { data, error } = await db.from("brands").insert(value).select("*").single();
  if (error) throw catalogDatabaseError(error);
  return data;
}

export async function updateBrand(id: string, input: unknown) {
  const value = brandInputSchema.partial().parse(input);
  const db = getSupabaseServiceClient();
  if (!db) throw new CatalogError("Catalog database is unavailable", 503);
  const { data, error } = await db.from("brands").update({ ...value, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
  if (error) throw catalogDatabaseError(error);
  return data;
}
