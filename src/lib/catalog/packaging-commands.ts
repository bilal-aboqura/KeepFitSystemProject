import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { CatalogError, catalogDatabaseError } from "./errors";
import { validatePackagingHierarchy } from "./packaging";
import type { CatalogPackagingUnit } from "./types";

const packagingColumns = "id,variant_id,parent_unit_id,code,barcode,label_en,label_ar,quantity_per_parent_num,quantity_per_parent_den,base_quantity_num,base_quantity_den,is_base_unit,is_sellable,is_default_sale_unit,default_price_mode,is_active,archived_at";

export function mapPackagingUnit(row: Record<string, unknown>): CatalogPackagingUnit {
  return {
    id: String(row.id), variant_id: String(row.variant_id), parent_unit_id: row.parent_unit_id ? String(row.parent_unit_id) : null,
    code: row.code ? String(row.code) : null, barcode: row.barcode ? String(row.barcode) : null,
    label_en: String(row.label_en), label_ar: String(row.label_ar),
    quantity_per_parent: { numerator: Number(row.quantity_per_parent_num), denominator: Number(row.quantity_per_parent_den) },
    base_quantity: { numerator: Number(row.base_quantity_num), denominator: Number(row.base_quantity_den) },
    is_base_unit: Boolean(row.is_base_unit), is_sellable: Boolean(row.is_sellable), is_default_sale_unit: Boolean(row.is_default_sale_unit),
    default_price_mode: row.default_price_mode as "explicit" | "derived", is_active: Boolean(row.is_active), archived_at: row.archived_at ? String(row.archived_at) : null,
  };
}

export async function listVariantPackaging(variantId: string, includeArchived = true) {
  const db = getSupabaseServiceClient();
  if (!db) throw new CatalogError("Catalog database is unavailable", 503);
  let query = db.from("variant_packaging_units").select(packagingColumns).eq("variant_id", variantId).order("base_quantity_num", { ascending: false });
  if (!includeArchived) query = query.eq("is_active", true).is("archived_at", null);
  const { data, error } = await query;
  if (error) throw catalogDatabaseError(error);
  return (data ?? []).map((row) => mapPackagingUnit(row as unknown as Record<string, unknown>));
}

export async function replaceVariantPackaging(variantId: string, input: unknown, actorId: string | null) {
  const units = validatePackagingHierarchy(input);
  const db = getSupabaseServiceClient();
  if (!db) throw new CatalogError("Catalog database is unavailable", 503);
  const payload = units.map((unit) => ({
    id: unit.id, parent_unit_id: unit.parent_unit_id, code: unit.code, barcode: unit.barcode,
    label_en: unit.label_en, label_ar: unit.label_ar, quantity_per_parent: unit.quantity_per_parent,
    is_base_unit: unit.is_base_unit, is_sellable: unit.is_sellable,
    is_default_sale_unit: unit.is_default_sale_unit, default_price_mode: unit.default_price_mode,
    is_active: unit.is_active,
  }));
  const { error } = await db.rpc("catalog_replace_packaging_units", { p_variant_id: variantId, p_units: payload, p_actor_id: actorId });
  if (error) throw catalogDatabaseError(error);
  return listVariantPackaging(variantId, false);
}

export async function archivePackagingUnit(unitId: string, actorId: string | null) {
  const db = getSupabaseServiceClient();
  if (!db) throw new CatalogError("Catalog database is unavailable", 503);
  const { error } = await db.rpc("catalog_archive_packaging_unit", { p_unit_id: unitId, p_actor_id: actorId });
  if (error) throw catalogDatabaseError(error);
}
