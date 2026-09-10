import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { BostaShipment } from "@/lib/bosta";

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
      "*, order_items(id, product_id, name_en, name_ar, price, quantity, image)",
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
}

/**
 * Aggregate unique customers from the orders table by phone number.
 * This captures ALL customers — both registered and guest checkout.
 */
export async function adminListCustomers(): Promise<AdminCustomer[]> {
  const sb = getSupabaseServiceClient();
  if (!sb) return [];

  const { data: orders, error } = await sb
    .from("orders")
    .select("id, customer_name, customer_phone, governorate, city, grand_total, payment_status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("adminListCustomers:", error.message);
    return [];
  }

  const customerMap = new Map<string, AdminCustomer>();

  for (const o of orders ?? []) {
    const phone = o.customer_phone;
    const existing = customerMap.get(phone);

    if (existing) {
      existing.order_count += 1;
      if (o.payment_status === "paid" || o.payment_status === "pending") {
        existing.total_spent += Number(o.grand_total);
      }
      if (new Date(o.created_at) > new Date(existing.last_order_at)) {
        existing.last_order_at = o.created_at;
        existing.full_name = o.customer_name;
        existing.governorate = o.governorate;
        existing.city = o.city;
      }
      if (new Date(o.created_at) < new Date(existing.first_order_at)) {
        existing.first_order_at = o.created_at;
      }
    } else {
      customerMap.set(phone, {
        id: o.id,
        full_name: o.customer_name,
        phone,
        email: null,
        governorate: o.governorate,
        city: o.city,
        order_count: 1,
        total_spent: (o.payment_status === "paid" || o.payment_status === "pending") ? Number(o.grand_total) : 0,
        last_order_at: o.created_at,
        first_order_at: o.created_at,
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
