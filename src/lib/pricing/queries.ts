import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { CustomerPricingContext, PricingCandidate, PricingSource, PricingTarget } from "./types";

export interface PricingConfigurationSnapshot {
  defaultPriceListId: string;
  version: string;
}

export interface PricingSourceList {
  source: Exclude<PricingSource, "customer_override">;
  priceListId: string;
}

function effectiveAt(row: { valid_from?: string | null; valid_until?: string | null }, at: string) {
  const instant = Date.parse(at);
  return (!row.valid_from || Date.parse(row.valid_from) <= instant) && (!row.valid_until || instant < Date.parse(row.valid_until));
}

export async function getPricingConfiguration(): Promise<PricingConfigurationSnapshot | null> {
  const db = getSupabaseServiceClient();
  if (!db) return null;
  const { data, error } = await db.from("pricing_configuration").select("default_price_list_id,version").eq("singleton", true).maybeSingle();
  if (error) throw new Error("Pricing configuration is unavailable");
  return data ? { defaultPriceListId: data.default_price_list_id, version: String(data.version) } : null;
}

export async function getTrustedPricingTime(at?: string) {
  if (at) return new Date(at).toISOString();
  const db = getSupabaseServiceClient();
  if (!db) return new Date().toISOString();
  const { data, error } = await db.rpc("pricing_current_time");
  if (error || !data) throw new Error("Pricing clock is unavailable");
  return new Date(String(data)).toISOString();
}

export async function getActivePricingSources(context: CustomerPricingContext): Promise<PricingSourceList[]> {
  const db = getSupabaseServiceClient();
  if (!db) return [];
  const configuration = await getPricingConfiguration();
  if (!configuration) return [];
  const sources: PricingSourceList[] = [];
  if (context.directPriceListId) sources.push({ source: "direct_price_list", priceListId: context.directPriceListId });
  if (context.customerTypeId) {
    const { data, error } = await db.from("customer_type_price_list_mappings")
      .select("price_list_id,price_list:price_lists!inner(id,is_active,archived_at)")
      .eq("customer_type_id", context.customerTypeId).eq("is_active", true).is("archived_at", null).maybeSingle();
    if (error) throw new Error("Pricing type mapping is unavailable");
    const priceList = data ? (Array.isArray(data.price_list) ? data.price_list[0] : data.price_list) : null;
    if (data && priceList?.is_active && !priceList.archived_at) {
      sources.push({ source: "customer_type_price_list", priceListId: data.price_list_id });
    }
  }
  sources.push({ source: "default_price_list", priceListId: configuration.defaultPriceListId });
  const ids = [...new Set(sources.map((source) => source.priceListId))];
  const { data, error } = await db.from("price_lists").select("id").in("id", ids).eq("is_active", true).is("archived_at", null);
  if (error) throw new Error("Pricing lists are unavailable");
  const active = new Set((data ?? []).map((list) => list.id));
  return sources.filter((source, index) => active.has(source.priceListId) && sources.findIndex((item) => item.source === source.source && item.priceListId === source.priceListId) === index);
}

export async function loadPriceListCandidates(
  sources: PricingSourceList[],
  targets: PricingTarget[],
  at: string,
): Promise<PricingCandidate[]> {
  const db = getSupabaseServiceClient();
  if (!db || sources.length === 0 || targets.length === 0) return [];
  const listIds = [...new Set(sources.map((source) => source.priceListId))];
  const variantIds = [...new Set(targets.map((target) => target.variantId))];
  const { data, error } = await db.from("price_list_items")
    .select("id,price_list_id,variant_id,sellable_unit_id,amount_minor,currency,valid_from,valid_until")
    .in("price_list_id", listIds).in("variant_id", variantIds).eq("is_active", true).is("archived_at", null);
  if (error) throw new Error("Price candidates are unavailable");
  return (data ?? []).filter((row) => effectiveAt(row, at)).flatMap((row) =>
    sources.filter((source) => source.priceListId === row.price_list_id).map((source) => ({
      id: row.id,
      source: source.source,
      priceListId: row.price_list_id,
      variantId: row.variant_id,
      sellableUnitId: row.sellable_unit_id,
      amountMinor: BigInt(row.amount_minor),
      currency: "EGP" as const,
      validFrom: row.valid_from,
      validUntil: row.valid_until,
    })),
  );
}

export async function loadCustomerOverrideCandidates(
  customerId: string | null,
  targets: PricingTarget[],
  at: string,
): Promise<PricingCandidate[]> {
  const db = getSupabaseServiceClient();
  if (!db || !customerId || targets.length === 0) return [];
  const variantIds = [...new Set(targets.map((target) => target.variantId))];
  const { data, error } = await db.from("customer_unit_price_overrides")
    .select("id,variant_id,sellable_unit_id,amount_minor,currency,valid_from,valid_until")
    .eq("customer_id", customerId).in("variant_id", variantIds).eq("is_active", true).is("archived_at", null);
  if (error) throw new Error("Customer price overrides are unavailable");
  return (data ?? []).filter((row) => effectiveAt(row, at)).map((row) => ({
    id: row.id,
    source: "customer_override",
    priceListId: null,
    variantId: row.variant_id,
    sellableUnitId: row.sellable_unit_id,
    amountMinor: BigInt(row.amount_minor),
    currency: "EGP",
    validFrom: row.valid_from,
    validUntil: row.valid_until,
  }));
}
