import "server-only";
import { randomUUID } from "node:crypto";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { CommerceContext, CommerceLineIntent, QuantityRuleResolution } from "./types";
import { CommerceError } from "./errors";
import { quantityRuleArchiveSchema, quantityRuleMutationSchema } from "./validation";

export function isQuantityEligible(quantity: number, minimum: number, increment: number) {
  return Number.isSafeInteger(quantity)
    && Number.isSafeInteger(minimum)
    && Number.isSafeInteger(increment)
    && quantity >= minimum
    && minimum > 0
    && increment > 0
    && (quantity - minimum) % increment === 0;
}

export async function resolveQuantityRules(
  context: CommerceContext,
  lines: CommerceLineIntent[],
): Promise<Map<string, QuantityRuleResolution>> {
  const result = new Map<string, QuantityRuleResolution>();
  const unique = [...new Map(lines.map((line) => [`${line.variantId}:${line.sellableUnitId}`, line])).values()];
  if (unique.length === 0) return result;
  const db = getSupabaseServiceClient();
  if (!db) throw new CommerceError("CHECKOUT_UNAVAILABLE");

  let query = db.from("commerce_quantity_rules")
    .select("id,context_kind,customer_type_id,variant_id,sellable_unit_id,minimum_quantity,quantity_increment")
    .in("variant_id", [...new Set(unique.map((line) => line.variantId))])
    .in("sellable_unit_id", [...new Set(unique.map((line) => line.sellableUnitId))])
    .eq("is_active", true)
    .is("archived_at", null)
    .eq("context_kind", context.contextKind);
  query = context.contextKind === "public"
    ? query.is("customer_type_id", null)
    : query.eq("customer_type_id", context.customerTypeId!);
  const { data, error } = await query;
  if (error) throw new CommerceError("CHECKOUT_UNAVAILABLE");

  const stored = new Map((data ?? []).map((rule) => [`${rule.variant_id}:${rule.sellable_unit_id}`, rule]));
  for (const line of unique) {
    const key = `${line.variantId}:${line.sellableUnitId}`;
    const rule = stored.get(key);
    const minimum = Number(rule?.minimum_quantity ?? 1);
    const increment = Number(rule?.quantity_increment ?? 1);
    if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(increment) || minimum <= 0 || increment <= 0) {
      throw new CommerceError("QUANTITY_RULE_INVALID");
    }
    result.set(key, {
      ruleId: rule?.id ?? null,
      contextKind: context.contextKind,
      customerTypeId: context.customerTypeId,
      minimum,
      increment,
      eligible: isQuantityEligible(line.quantity, minimum, increment),
    });
  }
  return result;
}

function database() {
  const db = getSupabaseServiceClient();
  if (!db) throw new CommerceError("CHECKOUT_UNAVAILABLE");
  return db;
}

function throwRuleError(error: { code?: string; message?: string }) {
  if (error.code === "42501") throw new CommerceError("ADMIN_UNAUTHORIZED");
  if (error.code === "P0002") throw new CommerceError("QUANTITY_RULE_INVALID", { status: 404 });
  if (error.code === "23505" || error.code === "40001") throw new CommerceError("QUANTITY_RULE_CONFLICT");
  if (error.code === "22023") throw new CommerceError("QUANTITY_RULE_INVALID");
  throw new CommerceError("CHECKOUT_UNAVAILABLE");
}

export async function listQuantityRules(options: { cursor?: string; limit?: number; variantId?: string } = {}) {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  let query = database().from("commerce_quantity_rules")
    .select("id,context_kind,customer_type_id,variant_id,sellable_unit_id,minimum_quantity,quantity_increment,is_active,archived_at,created_at,updated_at,customer_type:customer_types(code,name_en,name_ar),variant:product_variants(sku,label_en,label_ar,product:products(name_en,name_ar)),unit:variant_packaging_units(code,label_en,label_ar,is_sellable,is_active)")
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit + 1);
  if (options.variantId) query = query.eq("variant_id", options.variantId);
  if (options.cursor) query = query.lt("created_at", options.cursor);
  const { data, error } = await query;
  if (error) throwRuleError(error);
  const rows = data ?? [];
  return { rules: rows.slice(0, limit), nextCursor: rows.length > limit ? rows[limit - 1]?.created_at ?? null : null };
}

export async function listQuantityRuleTargets() {
  const db = database();
  const [catalog, customerTypes] = await Promise.all([
    db.from("products").select("id,name_en,name_ar,variants:product_variants(id,sku,label_en,label_ar,units:variant_packaging_units(id,code,label_en,label_ar,is_sellable,is_active,archived_at))").eq("is_active", true).is("archived_at", null).order("name_en").limit(200),
    db.from("customer_types").select("id,code,name_en,name_ar").eq("is_active", true).order("sort_order"),
  ]);
  if (catalog.error || customerTypes.error) throw new CommerceError("CHECKOUT_UNAVAILABLE");
  return { products: catalog.data ?? [], customerTypes: customerTypes.data ?? [] };
}

export async function setQuantityRule(input: unknown, actorId: string) {
  const value = quantityRuleMutationSchema.parse(input);
  const correlationId = randomUUID();
  const { data, error } = await database().rpc("commerce_set_quantity_rule", {
    p_actor_id: actorId,
    p_context_kind: value.context.kind,
    p_customer_type_id: value.context.kind === "customer_type" ? value.context.customerTypeId : null,
    p_variant_id: value.variantId,
    p_sellable_unit_id: value.sellableUnitId,
    p_minimum_quantity: value.minimumQuantity,
    p_quantity_increment: value.quantityIncrement,
    p_reason: value.reason,
    p_correlation_id: correlationId,
  });
  if (error) throwRuleError(error);
  return data;
}

export async function archiveQuantityRule(ruleId: string, input: unknown, actorId: string) {
  const value = quantityRuleArchiveSchema.parse(input);
  const { data, error } = await database().rpc("commerce_archive_quantity_rule", {
    p_actor_id: actorId,
    p_rule_id: ruleId,
    p_reason: value.reason,
    p_correlation_id: randomUUID(),
  });
  if (error) throwRuleError(error);
  return data;
}
