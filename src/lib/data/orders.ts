import "server-only";
import { newConfirmationGrant } from "@/lib/customers/grants";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { getCheckoutSettings } from "@/lib/data/catalog";
import { calcOnlinePaymentDiscount } from "@/lib/pricing/legacy-adjustments";
import { is450MlDestination, is450MlProduct } from "@/lib/shipping-policy";
import { getCustomerPricingContext, GUEST_PRICING_CONTEXT } from "@/lib/pricing/context";
import { loadPricingCatalogTargets, pricingTargetKey } from "@/lib/pricing/catalog-targets";
import { calculateLineTotalMinor, minorToCompatibilityNumber, parseEgpToMinor } from "@/lib/pricing/money";
import { resolvePrices } from "@/lib/pricing/resolver";
import type { PricingErrorCode } from "@/lib/pricing/types";

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
    variant_id: string;
    sellable_unit_id: string;
    quantity: number;
  }[];
}

export interface CreatedOrder {
  confirmationGrant?: ReturnType<typeof newConfirmationGrant>;
  id: string;
  order_number: string;
  grand_total: number;
  payment_method: string;
}

interface ResolvedOrderItem {
  variant_id: string;
  sellable_unit_id: string;
  product_id: string;
  price: number;
  unit_amount_minor: string;
  line_total_minor: string;
  currency: "EGP";
  pricing_source: string;
  pricing_reference_id: string;
  price_is_derived: boolean;
  derived_from_sellable_unit_id: string | null;
  quantity: number;
}

export class PricingOrderError extends Error {
  constructor(public code: PricingErrorCode, public status = 409, public safeItems: unknown[] = []) {
    super(code);
    this.name = "PricingOrderError";
  }
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

  const checkoutSettings = await getCheckoutSettings();
  const targets = input.items.map((item) => ({ variantId: item.variant_id, sellableUnitId: item.sellable_unit_id }));
  const context = input.customer_id ? await getCustomerPricingContext(input.customer_id) : GUEST_PRICING_CONTEXT;
  const [prices, catalogTargets] = await Promise.all([
    resolvePrices({ customerContext: context, targets }),
    loadPricingCatalogTargets(targets),
  ]);
  const priceByTarget = new Map(prices.map((price) => [pricingTargetKey(price), price]));
  const resolvedItems: ResolvedOrderItem[] = input.items.map((item) => {
    const key = pricingTargetKey({ variantId: item.variant_id, sellableUnitId: item.sellable_unit_id });
    const price = priceByTarget.get(key);
    const catalog = catalogTargets.get(key);
    if (!price || price.availability === "unavailable" || !catalog?.isActive) throw new PricingOrderError("PRICE_UNAVAILABLE");
    const referenceId = price.overrideId ?? price.priceListItemId;
    if (!referenceId) throw new PricingOrderError("PRICE_UNAVAILABLE");
    const lineTotalMinor = calculateLineTotalMinor(price.amountMinor, item.quantity);
    return {
      variant_id: item.variant_id,
      sellable_unit_id: item.sellable_unit_id,
      product_id: catalog.productId,
      price: minorToCompatibilityNumber(price.amountMinor),
      unit_amount_minor: price.amountMinor.toString(),
      line_total_minor: lineTotalMinor.toString(),
      currency: price.currency,
      pricing_source: price.source,
      pricing_reference_id: referenceId,
      price_is_derived: price.resolutionKind === "derived",
      derived_from_sellable_unit_id: price.derivedFromUnitId,
      quantity: item.quantity,
    };
  });

  const itemsTotalMinor = resolvedItems.reduce((sum, item) => sum + BigInt(item.line_total_minor), BigInt(0));
  const itemsTotal = minorToCompatibilityNumber(itemsTotalMinor);
  const onlinePaymentDiscount = calcOnlinePaymentDiscount(
    itemsTotal,
    input.payment_method,
  );
  const [shipping] = await Promise.all([
    getShippingCostForProducts(
      input.governorate,
      input.city,
      resolvedItems.map((item) => item.product_id),
    ),
  ]);
  const shippingCost =
    itemsTotal >= checkoutSettings.freeShippingThreshold ? 0 : shipping.cost;
  const codeDiscount = await resolveDiscount(input.discount_code, itemsTotal);
  const totalDiscount = onlinePaymentDiscount + (codeDiscount?.amount ?? 0);
  const shippingMinor = parseEgpToMinor(String(shippingCost));
  const discountMinor = parseEgpToMinor(String(totalDiscount));
  const grandTotalMinor = itemsTotalMinor + shippingMinor > discountMinor ? itemsTotalMinor + shippingMinor - discountMinor : BigInt(0);
  const grant = input.customer_id ? undefined : newConfirmationGrant();
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await sb.rpc("pricing_create_order", {
      p_order: {
        order_number: generateOrderNumber(), user_id: input.user_id ?? null, customer_id: input.customer_id ?? null,
        customer_name: input.customer_name, customer_phone: input.customer_phone, alt_phone: input.alt_phone,
        governorate: input.governorate, city: input.city, address: input.address, notes: input.notes ?? null,
        items_total_minor: itemsTotalMinor.toString(), shipping_cost_minor: shippingMinor.toString(), discount_minor: discountMinor.toString(),
        discount_code: codeDiscount?.code ?? null, grand_total_minor: grandTotalMinor.toString(), payment_method: input.payment_method,
      },
      p_items: resolvedItems, p_grant_hash: grant?.hash ?? null,
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
    variant_id: string | null;
    sellable_unit_id: string | null;
    sku: string | null;
    sellable_unit_code: string | null;
    variant_label_en: string | null;
    variant_label_ar: string | null;
    unit_label_en: string | null;
    unit_label_ar: string | null;
    base_quantity_per_unit_num: number | null;
    base_quantity_per_unit_den: number | null;
    equivalent_base_quantity_num: number | null;
    equivalent_base_quantity_den: number | null;
    line_total: number | null;
    unit_price_minor: string | null;
    line_total_minor: string | null;
    price_currency: string | null;
    pricing_source: string | null;
    pricing_reference_id: string | null;
    price_is_derived: boolean | null;
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
      "id, order_number, customer_name, customer_phone, alt_phone, governorate, city, address, notes, items_total, shipping_cost, discount, grand_total, payment_method, payment_status, fulfillment_status, created_at, order_items(id, product_id, variant_id, sellable_unit_id, sku, sellable_unit_code, name_en, name_ar, variant_label_en, variant_label_ar, unit_label_en, unit_label_ar, base_quantity_per_unit_num, base_quantity_per_unit_den, equivalent_base_quantity_num, equivalent_base_quantity_den, price, line_total, unit_price_minor, line_total_minor, price_currency, pricing_source, pricing_reference_id, price_is_derived, quantity, image)",
    )
    .eq("order_number", orderNumber)
    .maybeSingle();
  return (data as OrderForConfirmation) ?? null;
}

export interface AdminOrderQuery {
  cursor?: string;
  query?: string;
  fulfillment?: string;
  payment?: string;
  customerType?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

interface AdminOrderCursor {
  createdAt: string;
  id: string;
}

export function encodeAdminOrderCursor(cursor: AdminOrderCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeAdminOrderCursor(value?: string): AdminOrderCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<AdminOrderCursor>;
    if (typeof parsed.createdAt !== "string" || !Number.isFinite(Date.parse(parsed.createdAt))) return null;
    if (typeof parsed.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed.id)) return null;
    return { createdAt: new Date(parsed.createdAt).toISOString(), id: parsed.id };
  } catch {
    return null;
  }
}

function adminDateBoundary(value: string | undefined, endOfDay: boolean) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export async function listAdminOrders(input: AdminOrderQuery = {}) {
  const sb = getSupabaseServiceClient();
  if (!sb) return { orders: [], nextCursor: null };
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
  let skuOrderIds: string[] | null = null;
  const term = input.query?.trim();
  if (term) {
    const { data } = await sb.from("order_items").select("order_id").ilike("sku", `%${term}%`).limit(100);
    skuOrderIds = [...new Set((data ?? []).map((row) => row.order_id).filter(Boolean))];
  }
  let query = sb.from("orders").select("id,order_number,customer_id,customer_name,customer_phone,alt_phone,governorate,city,address,notes,grand_total,payment_method,payment_status,fulfillment_status,customer_type_code_snapshot,commerce_snapshot_version,shipping_snapshot,bosta,mylerz,order_items(id,sku,name_en,name_ar,quantity,price),created_at")
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit + 1);
  const cursor = decodeAdminOrderCursor(input.cursor);
  if (cursor) query = query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
  if (input.fulfillment) query = query.eq("fulfillment_status", input.fulfillment);
  if (input.payment) query = query.eq("payment_status", input.payment);
  if (input.customerType === "guest") query = query.is("customer_id", null);
  else if (input.customerType) query = query.eq("customer_type_code_snapshot", input.customerType);
  const dateFrom = adminDateBoundary(input.dateFrom, false);
  const dateTo = adminDateBoundary(input.dateTo, true);
  if (dateFrom) query = query.gte("created_at", dateFrom);
  if (dateTo) query = query.lte("created_at", dateTo);
  if (term) {
    const escaped = term.replace(/[%_,]/g, "");
    const clauses = [`order_number.ilike.%${escaped}%`, `customer_name.ilike.%${escaped}%`, `customer_phone.ilike.%${escaped}%`];
    if (skuOrderIds?.length) clauses.push(`id.in.(${skuOrderIds.join(",")})`);
    query = query.or(clauses.join(","));
  }
  const { data, error } = await query;
  if (error) throw error;
  const rows = data ?? [];
  const lastVisible = rows[limit - 1];
  return {
    orders: rows.slice(0, limit),
    nextCursor: rows.length > limit && lastVisible
      ? encodeAdminOrderCursor({ createdAt: lastVisible.created_at, id: lastVisible.id })
      : null,
  };
}

export async function getAdminOrderSnapshot(orderId: string) {
  const sb = getSupabaseServiceClient();
  if (!sb) return null;
  const { data, error } = await sb.from("orders").select("id,order_number,customer_id,customer_name,customer_phone,alt_phone,governorate,city,address,notes,items_total,shipping_cost,discount,grand_total,items_total_minor,shipping_cost_minor,discount_minor,grand_total_minor,payment_method,payment_status,fulfillment_status,created_at,commerce_snapshot_version,commerce_context_kind,customer_type_code_snapshot,customer_type_name_en_snapshot,customer_type_name_ar_snapshot,currency,discount_snapshot,shipping_snapshot,order_items(id,product_id,variant_id,sellable_unit_id,sku,sellable_unit_code,product_name_en,product_name_ar,name_en,name_ar,variant_label_en,variant_label_ar,unit_label_en,unit_label_ar,base_quantity_per_unit_num,base_quantity_per_unit_den,equivalent_base_quantity_num,equivalent_base_quantity_den,price,line_total,unit_price_minor,line_total_minor,price_currency,pricing_source,price_is_derived,quantity,minimum_quantity_snapshot,quantity_increment_snapshot,quantity_rule_context_kind)").eq("id", orderId).maybeSingle();
  if (error) throw error;
  return data;
}
