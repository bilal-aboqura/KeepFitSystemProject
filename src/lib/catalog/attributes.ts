import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { z } from "zod";
import { attributeAssignmentSchema, attributeDefinitionInputSchema, attributeValueInputSchema } from "./validation";
import { CatalogError, catalogDatabaseError } from "./errors";

export async function listAttributes(includeArchived = false) {
  const db = getSupabaseServiceClient();
  if (!db) return [];
  let query = db.from("attribute_definitions").select("*, values:attribute_values(*)").order("sort_order").order("code");
  if (!includeArchived) query = query.eq("is_active", true).is("archived_at", null);
  const { data, error } = await query;
  if (error) throw catalogDatabaseError(error);
  return data ?? [];
}

export async function createAttributeDefinition(input: unknown) {
  const value = attributeDefinitionInputSchema.parse(input);
  const db = getSupabaseServiceClient();
  if (!db) throw new CatalogError("Catalog database is unavailable", 503);
  const { data, error } = await db.from("attribute_definitions").insert(value).select("*").single();
  if (error) throw catalogDatabaseError(error);
  return data;
}

export async function createAttributeValue(input: unknown) {
  const value = attributeValueInputSchema.parse(input);
  const db = getSupabaseServiceClient();
  if (!db) throw new CatalogError("Catalog database is unavailable", 503);
  const { data: definition } = await db.from("attribute_definitions").select("value_type,is_active").eq("id", value.attribute_definition_id).maybeSingle();
  if (!definition?.is_active || definition.value_type !== "option") throw new CatalogError("Controlled values require an active option attribute", 422);
  const { data, error } = await db.from("attribute_values").insert(value).select("*").single();
  if (error) throw catalogDatabaseError(error);
  return data;
}

export async function archiveAttributeDefinition(id: string) {
  const db = getSupabaseServiceClient();
  if (!db) throw new CatalogError("Catalog database is unavailable", 503);
  const { error } = await db.from("attribute_definitions").update({ is_active: false, archived_at: new Date().toISOString() }).eq("id", id);
  if (error) throw catalogDatabaseError(error);
}

export async function replaceProductSpecifications(productId: string, input: unknown, actorId: string) {
  const specifications = z.array(attributeAssignmentSchema.extend({ sort_order: z.number().int().min(0).optional().default(0) })).max(50).parse(input);
  const db = getSupabaseServiceClient();
  if (!db) throw new CatalogError("Catalog database is unavailable", 503);
  const { error } = await db.rpc("catalog_replace_product_specifications", { p_product_id: productId, p_specifications: specifications, p_actor_id: actorId });
  if (error) throw catalogDatabaseError(error);
}
