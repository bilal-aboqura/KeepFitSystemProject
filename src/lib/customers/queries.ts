import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { OrderForConfirmation } from "@/lib/data/orders";
import { hashConfirmationSecret } from "./grants";
export { confirmationGrantCookieName } from "./grants";
const detailFields = "id, order_number, customer_name, customer_phone, alt_phone, governorate, city, address, notes, items_total, shipping_cost, discount, grand_total, payment_method, payment_status, fulfillment_status, created_at, order_items(id, product_id, variant_id, sku, name_en, name_ar, variant_label_en, variant_label_ar, price, quantity, image)";
export async function hasGuestConfirmationGrant(orderId: string, secret?: string) {
  if (!secret || !/^[A-Za-z0-9_-]{43}$/.test(secret)) return false;
  const sb = getSupabaseServiceClient();
  if (!sb) return false;
  const { data, error } = await sb.from("order_confirmation_grants").select("id").eq("order_id", orderId)
    .eq("secret_hash", hashConfirmationSecret(secret)).is("revoked_at", null).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}
export async function listCustomerOrders(customerId: string, page = 1) {
  const sb = getSupabaseServiceClient();
  if (!sb) return [];
  const offset = (Math.max(1, Math.min(10000, Math.floor(page) || 1)) - 1) * 20;
  const { data, error } = await sb.from("orders")
    .select("order_number, grand_total, payment_method, payment_status, fulfillment_status, created_at")
    .eq("customer_id", customerId).order("created_at", { ascending: false }).range(offset, offset + 19);
  if (error) throw error;
  return data ?? [];
}
export async function getCustomerOrder(customerId: string, orderNumber: string): Promise<OrderForConfirmation | null> {
  const sb = getSupabaseServiceClient();
  if (!sb) return null;
  const { data, error } = await sb.from("orders").select(detailFields).eq("customer_id", customerId).eq("order_number", orderNumber).maybeSingle();
  if (error) throw error;
  return data as OrderForConfirmation | null;
}
export async function getConfirmationOrder(orderNumber: string, customerId?: string, secret?: string): Promise<OrderForConfirmation | null> {
  if (customerId) {
    const owned = await getCustomerOrder(customerId, orderNumber);
    if (owned) return owned;
  }
  if (!secret) return null;
  const sb = getSupabaseServiceClient();
  if (!sb) return null;
  const { data: reference, error } = await sb.from("orders").select("id").eq("order_number",orderNumber).is("customer_id",null).maybeSingle();
  if (error) throw error;
  if (!reference || !await hasGuestConfirmationGrant(reference.id, secret)) return null;
  const { data, error: detailError } = await sb.from("orders").select(detailFields).eq("id",reference.id).is("customer_id",null).maybeSingle();
  if (detailError) throw detailError;
  return data as OrderForConfirmation | null;
}
