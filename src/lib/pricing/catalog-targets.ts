import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { PricingCatalogTarget, PricingCatalogUnit, PricingTarget } from "./types";

function mapUnit(row: Record<string, unknown>): PricingCatalogUnit {
  return {
    id: String(row.id),
    variantId: String(row.variant_id),
    parentUnitId: row.parent_unit_id ? String(row.parent_unit_id) : null,
    code: row.code ? String(row.code) : null,
    labelEn: String(row.label_en),
    labelAr: String(row.label_ar),
    quantityPerParent: { numerator: BigInt(String(row.quantity_per_parent_num)), denominator: BigInt(String(row.quantity_per_parent_den)) },
    baseQuantity: { numerator: BigInt(String(row.base_quantity_num)), denominator: BigInt(String(row.base_quantity_den)) },
    isSellable: Boolean(row.is_sellable),
    isDefaultSaleUnit: Boolean(row.is_default_sale_unit),
    isActive: Boolean(row.is_active) && !row.archived_at,
  };
}

export async function loadPricingCatalogTargets(targets: PricingTarget[]): Promise<Map<string, PricingCatalogTarget>> {
  const result = new Map<string, PricingCatalogTarget>();
  if (targets.length === 0) return result;
  const db = getSupabaseServiceClient();
  if (!db) return result;
  const variantIds = [...new Set(targets.map((target) => target.variantId))];
  const [{ data: variants, error: variantError }, { data: units, error: unitError }] = await Promise.all([
    db.from("product_variants")
      .select("id,product_id,sku,label_en,label_ar,stock,is_active,archived_at,product:products!inner(id,name_en,name_ar,is_active,archived_at,images)")
      .in("id", variantIds),
    db.from("variant_packaging_units")
      .select("id,variant_id,parent_unit_id,code,label_en,label_ar,quantity_per_parent_num,quantity_per_parent_den,base_quantity_num,base_quantity_den,is_sellable,is_default_sale_unit,is_active,archived_at")
      .in("variant_id", variantIds),
  ]);
  if (variantError || unitError) throw new Error("Pricing Catalog targets are unavailable");
  const unitsByVariant = new Map<string, PricingCatalogUnit[]>();
  for (const row of units ?? []) {
    const unit = mapUnit(row as unknown as Record<string, unknown>);
    unitsByVariant.set(unit.variantId, [...(unitsByVariant.get(unit.variantId) ?? []), unit]);
  }
  for (const row of variants ?? []) {
    const product = Array.isArray(row.product) ? row.product[0] : row.product;
    const variantUnits = unitsByVariant.get(row.id) ?? [];
    const variantActive = Boolean(row.is_active) && !row.archived_at && Boolean(product?.is_active) && !product?.archived_at;
    for (const requested of targets.filter((target) => target.variantId === row.id)) {
      const selectedUnit = variantUnits.find((unit) => unit.id === requested.sellableUnitId);
      if (!selectedUnit) continue;
      const key = pricingTargetKey(requested);
      result.set(key, {
        variantId: row.id,
        productId: row.product_id,
        sku: row.sku,
        variantLabelEn: row.label_en,
        variantLabelAr: row.label_ar,
        productNameEn: product?.name_en ?? "",
        productNameAr: product?.name_ar ?? "",
        image: Array.isArray(product?.images) ? product.images[0] ?? null : null,
        isActive: variantActive && selectedUnit.isActive && selectedUnit.isSellable,
        stock: Number(row.stock),
        selectedUnit,
        units: variantUnits,
      });
    }
  }
  return result;
}

export function pricingTargetKey(target: PricingTarget) {
  return `${target.variantId}:${target.sellableUnitId}`;
}
