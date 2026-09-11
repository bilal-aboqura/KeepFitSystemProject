import "server-only";
import { newConfirmationGrant } from "@/lib/customers/grants";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { getCheckoutSettings } from "@/lib/data/catalog";
import { calcItemsSubtotal, calcOnlinePaymentDiscount } from "@/lib/pricing";
import { is450MlDestination, is450MlProduct } from "@/lib/shipping-policy";

export interface CreateOrderInput {
  customer_name: string;
  customer_phone: string;
  alt_phone: string;
  governorate: string;
  city: string;
  address: string;
  notes?: string;
  payment_method: "card" | "cod";
  discount_code?: string | null;
  user_id?: string | null;
  customer_id?: string | null;
  items: {
    product_id: string;
    name_en: string;
    name_ar?: string;
    price: number;
    quantity: number;
    image?: string;
  }[];
}

export interface CreatedOrder {
  confirmationGrant?: ReturnType<typeof newConfirmationGrant>;
  id: string;
  order_number: string;
  grand_total: number;
  payment_method: string;
}

/** Generate a short, human-friendly order number like XE-1A2B3C-240624 */
export function generateOrderNumber(): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `XE-${rand}-${yy}${mm}${dd}`;
}

export interface ShippingQuote {
  cost: number;
  matched: "exact" | "governorate" | "default" | "450ml";
}

/** Resolve shipping cost: exact (gov,city) → (gov,'*') → ('*','*'). */
export async function getShippingCost(
  governorate: string,
  city: string,
): Promise<ShippingQuote> {
  const sb = getSupabaseServiceClient();
  if (!sb) return { cost: 120, matched: "default" };

  // 1) exact
  let { data, error } = await sb
    .from("shipping_rates")
    .select("cost")
    .eq("governorate", governorate)
    .eq("city", city)
    .maybeSingle();
  if (error) throw error;
  if (data) return { cost: Number(data.cost), matched: "exact" };

  // 2) governorate wildcard
  ({ data, error } = await sb
    .from("shipping_rates")
    .select("cost")
    .eq("governorate", governorate)
    .eq("city", "*")
    .maybeSingle());
  if (error) throw error;
  if (data) return { cost: Number(data.cost), matched: "governorate" };

  // 3) global default
  ({ data, error } = await sb
    .from("shipping_rates")
    .select("cost")
    .eq("governorate", "*")
    .eq("city", "*")
    .maybeSingle());
  if (error) throw error;
  return { cost: Number(data?.cost ?? 120), matched: "default" };
}

export async function getShippingCostForProducts(
  governorate: string,
  city: string,
  productIds: (string | null)[],
): Promise<ShippingQuote> {
  const standardShipping = await getShippingCost(governorate, city);
  if (productIds.some((id) => !id)) return standardShipping;
  const ids = [...new Set(productIds.filter((id): id is string => Boolean(id)))];
  if (!ids.length || !is450MlDestination(governorate)) {
    return standardShipping;
  }
  const sb = getSupabaseServiceClient();
  if (!sb) return standardShipping;
  const { data, error } = await sb
    .from("products")
    .select("id, weight, name_en, name_ar")
    .in("id", ids);
  if (error) throw error;
  if (!data || data.length !== ids.length) throw new Error("Shipping products not found");
  if (!data.every(is450MlProduct)) {
    return standardShipping;
  }
  return { cost: 80, matched: "450ml" };
}

/** Look up + validate a discount code; returns the discount amount for a subtotal. */
export async function resolveDiscount(
  code: string | null | undefined,
  subtotal: number,
): Promise<{ amount: number; code: string } | null> {
  if (!code) return null;
  const sb = getSupabaseServiceClient();
  if (!sb) return null;
  const { data } = await sb
    .from("discounts")
    .select("id, code, type, value, min_subtotal, expires_at, usage_limit, used_count, active")
    .eq("code", code.toUpperCase())
    .eq("active", true)
    .maybeSingle();
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
  if (data.usage_limit && data.used_count >= data.usage_limit) return null;
  if (subtotal < Number(data.min_subtotal ?? 0)) return null;

  let amount = 0;
  if (data.type === "percent") {
    amount = Math.round(subtotal * (Number(data.value) / 100) * 100) / 100;
  } else {
    amount = Math.min(Number(data.value), subtotal);
  }
  return { amount, code: data.code };
}

/**
 * Create an order (with line items + snapshot). Uses the service role.
 * For COD the order is immediately "pending payment / pending fulfillment".
 * For card it stays pending until the Kashier webhook marks it paid.
 */
export async function createOrder(
  input: CreateOrderInput,
): Promise<CreatedOrder | null> {
  const sb = getSupabaseServiceClient();
  if (!sb || input.items.length === 0) return null;

  const itemsTotal = calcItemsSubtotal(input.items);
  const onlinePaymentDiscount = calcOnlinePaymentDiscount(
    itemsTotal,
    input.payment_method,
  );
  const [shipping, checkoutSettings] = await Promise.all([
    getShippingCostForProducts(
      input.governorate,
      input.city,
      input.items.map((item) => item.product_id),
    ),
    getCheckoutSettings(),
  ]);
  const shippingCost =
    itemsTotal >= checkoutSettings.freeShippingThreshold ? 0 : shipping.cost;
  const codeDiscount = await resolveDiscount(input.discount_code, itemsTotal);
  const totalDiscount = onlinePaymentDiscount + (codeDiscount?.amount ?? 0);
  const grandTotal = Math.max(
    0,
    itemsTotal + shippingCost - totalDiscount,
  );

  const grant = input.customer_id ? undefined : newConfirmationGrant();
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await sb.rpc("customer_create_order", {
      p_order: {
        order_number: generateOrderNumber(), user_id: input.user_id ?? null, customer_id: input.customer_id ?? null,
        customer_name: input.customer_name, customer_phone: input.customer_phone, alt_phone: input.alt_phone,
        governorate: input.governorate, city: input.city, address: input.address, notes: input.notes ?? null,
        items_total: itemsTotal, shipping_cost: shippingCost, discount: totalDiscount,
        discount_code: codeDiscount?.code ?? null, grand_total: grandTotal, payment_method: input.payment_method,
      },
      p_items: input.items, p_grant_hash: grant?.hash ?? null,
    });
    if (!error && data) return { ...data, confirmationGrant: grant } as CreatedOrder;
    if (error?.code !== "23505") return null;
  }
  return null;
}

export interface OrderForConfirmation {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  alt_phone: string | null;
  governorate: string;
  city: string;
  address: string;
  notes: string | null;
  items_total: number;
  shipping_cost: number;
  discount: number;
  grand_total: number;
  payment_method: string;
  payment_status: string;
  fulfillment_status: string;
  created_at: string;
  order_items: {
    id: string;
    product_id: string;
    name_en: string;
    name_ar: string | null;
    price: number;
    quantity: number;
    image: string | null;
  }[];
}

export async function getOrderByNumber(
  orderNumber: string,
): Promise<OrderForConfirmation | null> {
  const sb = getSupabaseServiceClient();
  if (!sb) return null;
  const { data } = await sb
    .from("orders")
    .select(
      "id, order_number, customer_name, customer_phone, alt_phone, governorate, city, address, notes, items_total, shipping_cost, discount, grand_total, payment_method, payment_status, fulfillment_status, created_at, order_items(id, product_id, name_en, name_ar, price, quantity, image)",
    )
    .eq("order_number", orderNumber)
    .maybeSingle();
  return (data as OrderForConfirmation) ?? null;
}
