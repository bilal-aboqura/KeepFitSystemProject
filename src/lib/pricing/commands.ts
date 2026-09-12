import "server-only";
import { randomUUID } from "node:crypto";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import {
  customerPriceOverrideSchema,
  customerTypeMappingSchema,
  defaultPriceListSchema,
  directCustomerPriceListSchema,
  priceListBulkItemsSchema,
  priceListInputSchema,
  priceListItemInputSchema,
  priceListUpdateSchema,
} from "./validation";
import { persistPricingAuditEvent, PRICING_EVENT_NAMES } from "./audit";

export class PricingCommandError extends Error {
  constructor(message: string, public status = 400, public code = "PRICING_COMMAND_FAILED") {
    super(message);
    this.name = "PricingCommandError";
  }
}

function database() {
  const db = getSupabaseServiceClient();
  if (!db) throw new PricingCommandError("Pricing database is unavailable", 503);
  return db;
}

function throwDatabaseError(error: { code?: string; message?: string }) {
  if (error.code === "23P01") throw new PricingCommandError("Price periods overlap", 409, "PRICE_PERIOD_OVERLAP");
  if (error.code === "23514" || error.message?.includes("DEFAULT_PRICE_LIST_INVALID")) throw new PricingCommandError("The default Price List must remain active", 409, "DEFAULT_PRICE_LIST_INVALID");
  if (error.code === "42501") throw new PricingCommandError("Administrator authorization failed", 403, "ADMIN_UNAUTHORIZED");
  if (error.code === "22023") throw new PricingCommandError("Pricing target is invalid", 422, "PRICING_TARGET_INVALID");
  throw new PricingCommandError(error.message ?? "Pricing command failed");
}

export async function listPriceLists() {
  const db = database();
  const { data, error } = await db.from("price_lists")
    .select("id,code,name_en,name_ar,currency,is_active,archived_at,created_at,updated_at,pricing_configuration!pricing_configuration_default_price_list_id_fkey(version)")
    .order("created_at", { ascending: true });
  if (error) throwDatabaseError(error);
  return data ?? [];
}

export async function getPriceList(id: string) {
  const db = database();
  const { data, error } = await db.from("price_lists").select("*").eq("id", id).maybeSingle();
  if (error) throwDatabaseError(error);
  return data;
}

export async function createPriceList(input: unknown, actorId: string) {
  const value = priceListInputSchema.parse(input);
  const db = database();
  const { data, error } = await db.from("price_lists").insert({ ...value, created_by: actorId, updated_by: actorId }).select("*").single();
  if (error) throwDatabaseError(error);
  const correlationId = randomUUID();
  await persistPricingAuditEvent({ action: PRICING_EVENT_NAMES.listChanged, actorId, entityType: "price_list", entityId: data.id, correlationId, newState: { code: data.code, active: data.is_active } });
  return { ...data, correlation_id: correlationId };
}

export async function updatePriceList(id: string, input: unknown, actorId: string) {
  const value = priceListUpdateSchema.parse(input);
  const db = database();
  const { data: previous } = await db.from("price_lists").select("*").eq("id", id).maybeSingle();
  if (!previous) throw new PricingCommandError("Price List not found", 404);
  const archive = value.is_active === false;
  const { data, error } = await db.from("price_lists").update({ ...value, archived_at: archive ? new Date().toISOString() : previous.archived_at, updated_by: actorId }).eq("id", id).select("*").single();
  if (error) throwDatabaseError(error);
  const correlationId = randomUUID();
  await persistPricingAuditEvent({ action: PRICING_EVENT_NAMES.listChanged, actorId, entityType: "price_list", entityId: id, correlationId, previousState: { code: previous.code, active: previous.is_active }, newState: { code: data.code, active: data.is_active } });
  return { ...data, correlation_id: correlationId };
}

export async function setDefaultPriceList(input: unknown, actorId: string) {
  const value = defaultPriceListSchema.parse(input);
  const db = database();
  const { data, error } = await db.rpc("pricing_set_default", { p_actor_id: actorId, p_price_list_id: value.price_list_id, p_expected_version: value.expected_version ?? null, p_reason: value.reason ?? null, p_correlation_id: randomUUID() });
  if (error) throwDatabaseError(error);
  return data;
}

export async function listPriceListItems(priceListId: string) {
  const db = database();
  const { data, error } = await db.from("price_list_items")
    .select("id,price_list_id,variant_id,sellable_unit_id,amount_minor,currency,valid_from,valid_until,is_active,archived_at,variant:product_variants(sku,label_en,label_ar,product:products(name_en,name_ar,brand_id)),unit:variant_packaging_units(code,label_en,label_ar,is_sellable,is_default_sale_unit)")
    .eq("price_list_id", priceListId).order("valid_from", { ascending: true, nullsFirst: true });
  if (error) throwDatabaseError(error);
  return data ?? [];
}

export async function bulkSavePriceListItems(priceListId: string, input: unknown, actorId: string) {
  const value = priceListBulkItemsSchema.parse(input);
  const db = database();
  const { data, error } = await db.rpc("pricing_bulk_upsert_items", { p_actor_id: actorId, p_price_list_id: priceListId, p_items: value.items, p_correlation_id: value.correlation_id ?? randomUUID() });
  if (error) throwDatabaseError(error);
  return data;
}

export async function schedulePriceListItem(priceListId: string, input: unknown, actorId: string) {
  const item = priceListItemInputSchema.parse(input);
  return bulkSavePriceListItems(priceListId, { items: [item] }, actorId);
}

export async function listCustomerTypeMappings() {
  const db = database();
  const { data, error } = await db.from("customer_types").select("id,code,name_en,name_ar,is_active,mapping:customer_type_price_list_mappings(id,price_list_id,is_active,archived_at,price_list:price_lists(id,code,name_en,name_ar,is_active,archived_at))").order("sort_order");
  if (error) throwDatabaseError(error);
  return data ?? [];
}

export async function setCustomerTypeMapping(input: unknown, actorId: string) {
  const value = customerTypeMappingSchema.parse(input);
  const db = database();
  const { data, error } = await db.rpc("pricing_set_customer_type_mapping", { p_actor_id: actorId, p_customer_type_id: value.customer_type_id, p_price_list_id: value.price_list_id, p_reason: value.reason ?? null, p_correlation_id: randomUUID() });
  if (error) throwDatabaseError(error);
  return data;
}

export async function assignCustomerPriceList(customerId: string, input: unknown, actorId: string) {
  const value = directCustomerPriceListSchema.parse(input);
  return setCustomerPriceList(customerId, value.price_list_id, value.reason ?? null, actorId);
}

export async function removeCustomerPriceList(customerId: string, actorId: string) {
  return setCustomerPriceList(customerId, null, null, actorId);
}

async function setCustomerPriceList(customerId: string, priceListId: string | null, reason: string | null, actorId: string) {
  const db = database();
  const { data, error } = await db.rpc("pricing_assign_customer_list", { p_actor_id: actorId, p_customer_id: customerId, p_price_list_id: priceListId, p_reason: reason, p_correlation_id: randomUUID() });
  if (error) throwDatabaseError(error);
  return data;
}

export async function listCustomerPriceOverrides(customerId: string) {
  const db = database();
  const { data, error } = await db.from("customer_unit_price_overrides").select("*,variant:product_variants(sku,label_en,label_ar),unit:variant_packaging_units(code,label_en,label_ar)").eq("customer_id", customerId).order("created_at", { ascending: false });
  if (error) throwDatabaseError(error);
  return data ?? [];
}

export async function createCustomerPriceOverride(customerId: string, input: unknown, actorId: string) {
  const value = customerPriceOverrideSchema.omit({ customer_id: true }).parse(input);
  const db = database();
  const { data, error } = await db.rpc("pricing_upsert_customer_override", { p_actor_id: actorId, p_customer_id: customerId, p_override: value, p_correlation_id: randomUUID() });
  if (error) throwDatabaseError(error);
  return data;
}

export async function archiveCustomerPriceOverride(customerId: string, overrideId: string, actorId: string) {
  const db = database();
  const { data: previous } = await db.from("customer_unit_price_overrides").select("id,variant_id,sellable_unit_id,is_active").eq("id", overrideId).eq("customer_id", customerId).maybeSingle();
  if (!previous) throw new PricingCommandError("Override not found", 404);
  const { error } = await db.from("customer_unit_price_overrides").update({ is_active: false, archived_at: new Date().toISOString(), updated_by: actorId }).eq("id", overrideId).eq("customer_id", customerId);
  if (error) throwDatabaseError(error);
  const correlationId = randomUUID();
  await persistPricingAuditEvent({ action: PRICING_EVENT_NAMES.customerOverrideChanged, actorId, entityType: "customer_unit_price_override", entityId: overrideId, customerId, variantId: previous.variant_id, sellableUnitId: previous.sellable_unit_id, correlationId, previousState: { active: true }, newState: { active: false } });
  return { id: overrideId, correlation_id: correlationId };
}
