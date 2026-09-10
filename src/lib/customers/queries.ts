import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { getOrderByNumber, type OrderForConfirmation } from "@/lib/data/orders";

const grantCookiePrefix = "xeemo_order_grant_";
function hash(secret: string) { return createHash("sha256").update(secret).digest("hex"); }
export function confirmationGrantCookieName(orderNumber: string) { return `${grantCookiePrefix}${orderNumber}`; }

export async function issueGuestConfirmationGrant(orderId: string, orderNumber: string) {
  const sb = getSupabaseServiceClient(); if (!sb) return null;
  const secret = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await sb.from("order_confirmation_grants").insert({ order_id: orderId, secret_hash: hash(secret), expires_at: expiresAt });
  return error ? null : { name: confirmationGrantCookieName(orderNumber), value: secret, expiresAt };
}

export async function hasGuestConfirmationGrant(orderId: string, secret?: string) {
  if (!secret) return false; const sb = getSupabaseServiceClient(); if (!sb) return false;
  const { data } = await sb.from("order_confirmation_grants").select("id").eq("order_id", orderId).eq("secret_hash", hash(secret)).is("revoked_at", null).gt("expires_at", new Date().toISOString()).maybeSingle();
  return Boolean(data);
}

export async function listCustomerOrders(customerId: string) {
  const sb = getSupabaseServiceClient(); if (!sb) return [];
  const { data } = await sb.from("orders").select("order_number, grand_total, payment_method, payment_status, fulfillment_status, created_at").eq("customer_id", customerId).order("created_at", { ascending: false });
  return data ?? [];
}

export async function getCustomerOrder(customerId: string, orderNumber: string): Promise<OrderForConfirmation | null> {
  const sb = getSupabaseServiceClient(); if (!sb) return null;
  const { data } = await sb.from("orders").select("id").eq("customer_id", customerId).eq("order_number", orderNumber).maybeSingle();
  return data ? getOrderByNumber(orderNumber) : null;
}
