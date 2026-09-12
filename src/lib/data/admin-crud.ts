import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { BostaShipment } from "@/lib/bosta";
import { listCustomerTypes } from "@/lib/customers/customer-types";
import type { CustomerType } from "@/lib/customers/types";
export { adminCatalogSearch as adminListCatalogProducts } from "@/lib/catalog/queries";

// ── Products ─────────────────────────────────────────────────────────────────
export interface AdminProduct {
  id: string;
  slug: string;
  sku: string | null;
  legacy_id: string | null;
  category_id: string | null;
  name_en: string;
  name_ar: string;
  short_desc_en: string;
  short_desc_ar: string;
  long_desc_en: string;
  long_desc_ar: string;
  price: number;
  compare_at_price: number | null;
  stock: number;
  is_active: boolean;
  is_featured: boolean;
  images: string[];
  weight: string | null;
  created_at: string;
}

export async function adminListProducts(): Promise<AdminProduct[]> {
  const sb = getSupabaseServiceClient();
  if (!sb) return [];
  const { data, error } = await sb
    .from("products")
    .select(
      "id, slug, sku, legacy_id, category_id, name_en, name_ar, short_desc_en, short_desc_ar, long_desc_en, long_desc_ar, price, compare_at_price, stock, is_active, is_featured, images, weight, created_at",
    )
    .order("created_at", { ascending: false });
  if (error) {
    console.error("adminListProducts:", error.message);
    return [];
  }
  return (data ?? []) as AdminProduct[];
}

export async function adminGetProduct(id: string): Promise<AdminProduct | null> {
  const sb = getSupabaseServiceClient();
  if (!sb) return null;
  const { data } = await sb
    .from("products")
    .select(
      "id, slug, sku, legacy_id, category_id, name_en, name_ar, short_desc_en, short_desc_ar, long_desc_en, long_desc_ar, price, compare_at_price, stock, is_active, is_featured, images, weight, created_at",
    )
    .eq("id", id)
    .maybeSingle();
  return (data as AdminProduct) ?? null;
}

// ── Orders (admin view) ──────────────────────────────────────────────────────
export interface AdminOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  governorate: string;
  city: string;
  items_total: number;
  shipping_cost: number;
  discount: number;
  grand_total: number;
  payment_method: string;
  payment_status: string;
  fulfillment_status: string;
  bosta: BostaShipment | null;
  mylerz: import("@/lib/mylerz").MylerzShipment | null;
  address: string;
  notes: string | null;
  alt_phone: string | null;
  order_items: { id: string; name_en: string; name_ar: string | null; quantity: number; price: number }[];
  created_at: string;
}

export async function adminListOrders(limit = 100): Promise<AdminOrder[]> {
  const sb = getSupabaseServiceClient();
  if (!sb) return [];
  const { data, error } = await sb
    .from("orders")
    .select(
      "id, order_number, customer_name, customer_phone, governorate, city, items_total, shipping_cost, discount, grand_total, payment_method, payment_status, fulfillment_status, bosta, mylerz, address, notes, alt_phone, order_items(id, name_en, name_ar, quantity, price), created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("adminListOrders:", error.message);
    return [];
  }
  return (data ?? []) as AdminOrder[];
}

export async function adminGetOrder(id: string) {
  const sb = getSupabaseServiceClient();
  if (!sb) return null;
  const { data } = await sb
    .from("orders")
    .select(
      "*, order_items(id, product_id, variant_id, sku, name_en, name_ar, variant_label_en, variant_label_ar, price, quantity, image)",
    )
    .eq("id", id)
    .maybeSingle();
  return data;
}

// ── Customers (aggregated from orders — includes guest checkout) ─────────────
export interface AdminCustomer {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  governorate: string;
  city: string;
  order_count: number;
  total_spent: number;
  last_order_at: string;
  first_order_at: string;
  auth_user_id: string | null;
  kind: "customer" | "guest";
  is_persistent: boolean;
  effective_type: CustomerType | null;
  pending_request_id: string | null;
}

/**
 * Aggregate unique customers from the orders table by phone number.
 * This captures ALL customers — both registered and guest checkout.
 */
export async function adminListCustomers(): Promise<AdminCustomer[]> {
  const sb = getSupabaseServiceClient();
  if (!sb) return [];

  const [customerResult, orderResult, pendingResult, types] = await Promise.all([
    sb
      .from("customers")
      .select("id, auth_user_id, full_name, phone, email, customer_type_id, created_at")
      .order("created_at", { ascending: false }),
    sb
      .from("orders")
      .select("id, customer_id, customer_name, customer_phone, governorate, city, grand_total, payment_status, created_at")
      .order("created_at", { ascending: false }),
    sb.from("customer_type_requests").select("id, customer_id").eq("status", "pending"),
    listCustomerTypes(),
  ]);
  if (customerResult.error || orderResult.error) {
    console.error("adminListCustomers:", customerResult.error?.message ?? orderResult.error?.message);
    return [];
  }

  const typesById = new Map(types.map((type) => [type.id, type]));
  const pendingByCustomer = new Map(
    (pendingResult.data ?? []).map((request) => [request.customer_id, request.id]),
  );
  const customerMap = new Map<string, AdminCustomer>();
  for (const customer of customerResult.data ?? []) {
    customerMap.set(customer.id, {
      id: customer.id,
      full_name: customer.full_name || customer.email || customer.phone || "Customer",
      phone: customer.phone || "",
      email: customer.email,
      governorate: "",
      city: "",
      order_count: 0,
      total_spent: 0,
      last_order_at: customer.created_at,
      first_order_at: customer.created_at,
      auth_user_id: customer.auth_user_id,
      kind: "customer",
      is_persistent: true,
      effective_type: typesById.get(customer.customer_type_id) ?? null,
      pending_request_id: pendingByCustomer.get(customer.id) ?? null,
    });
  }

  for (const order of orderResult.data ?? []) {
    const key = order.customer_id ?? `guest:${order.id}`;
    const existing = customerMap.get(key);

    if (existing) {
      existing.order_count += 1;
      if (order.payment_status === "paid" || order.payment_status === "pending") {
        existing.total_spent += Number(order.grand_total);
      }
      if (existing.order_count === 1 || new Date(order.created_at) > new Date(existing.last_order_at)) {
        existing.last_order_at = order.created_at;
        existing.full_name = existing.is_persistent ? existing.full_name : order.customer_name;
        existing.governorate = order.governorate;
        existing.city = order.city;
      }
      if (existing.order_count === 1 || new Date(order.created_at) < new Date(existing.first_order_at)) {
        existing.first_order_at = order.created_at;
      }
    } else {
      customerMap.set(key, {
        id: order.id,
        full_name: order.customer_name,
        phone: order.customer_phone,
        email: null,
        governorate: order.governorate,
        city: order.city,
        order_count: 1,
        total_spent: (order.payment_status === "paid" || order.payment_status === "pending") ? Number(order.grand_total) : 0,
        last_order_at: order.created_at,
        first_order_at: order.created_at,
        auth_user_id: null,
        kind: "guest",
        is_persistent: false,
        effective_type: null,
        pending_request_id: null,
      });
    }
  }

  return Array.from(customerMap.values()).sort(
    (a, b) => new Date(b.last_order_at).getTime() - new Date(a.last_order_at).getTime(),
  );
}

export interface AdminNewsletterSubscriber {
  id: string;
  email: string;
  created_at: string;
}

export async function adminListNewsletterSubscribers(): Promise<AdminNewsletterSubscriber[]> {
  const sb = getSupabaseServiceClient();
  if (!sb) return [];
  const { data, error } = await sb
    .from("newsletter_subscribers")
    .select("id, email, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("adminListNewsletterSubscribers:", error.message);
    return [];
  }
  return (data ?? []) as AdminNewsletterSubscriber[];
}

// ── Discounts ────────────────────────────────────────────────────────────────
export interface AdminDiscount {
  id: string;
  code: string;
  type: string;
  value: number;
  min_subtotal: number;
  expires_at: string | null;
  usage_limit: number | null;
  used_count: number;
  active: boolean;
  created_at: string;
}

export async function adminListDiscounts(): Promise<AdminDiscount[]> {
  const sb = getSupabaseServiceClient();
  if (!sb) return [];
  const { data, error } = await sb
    .from("discounts")
    .select(
      "id, code, type, value, min_subtotal, expires_at, usage_limit, used_count, active, created_at",
    )
    .order("created_at", { ascending: false });
  if (error) {
    console.error("adminListDiscounts:", error.message);
    return [];
  }
  return (data ?? []) as AdminDiscount[];
}

// ── Shipping rates ───────────────────────────────────────────────────────────
export interface AdminShippingRate {
  id: string;
  governorate: string;
  city: string;
  cost: number;
}

export async function adminListShippingRates(): Promise<AdminShippingRate[]> {
  const sb = getSupabaseServiceClient();
  if (!sb) return [];
  const { data, error } = await sb
    .from("shipping_rates")
    .select("id, governorate, city, cost")
    .order("governorate", { ascending: true });
  if (error) {
    console.error("adminListShippingRates:", error.message);
    return [];
  }
  return (data ?? []) as AdminShippingRate[];
}

// ── Settings ─────────────────────────────────────────────────────────────────
export interface AdminSetting {
  key: string;
  value_en: string;
  value_ar: string;
}

export async function adminListSettings(): Promise<AdminSetting[]> {
  const sb = getSupabaseServiceClient();
  if (!sb) return [];
  const { data, error } = await sb
    .from("settings")
    .select("key, value_en, value_ar")
    .order("key", { ascending: true });
  if (error) {
    console.error("adminListSettings:", error.message);
    return [];
  }
  return (data ?? []) as AdminSetting[];
}
